import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, Plus, Minus, Zap } from 'lucide-react';

/** Dati extra letti dalla scatola. Opzionali: chi non li usa continua a funzionare come prima. */
export type ScanDetails = {
  dosage?: string;
  form?: string;
  aic?: string;
  activeIngredient?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  // il terzo argomento è nuovo e opzionale: le chiamate esistenti restano valide
  onConfirm: (name: string, scannedQty?: number, details?: ScanDetails) => void;
  mode?: 'search' | 'count'; // 'search' per trovare/aggiungere, 'count' per conteggio rapido
  itemFound?: any; // Eventuale farmaco trovato nell'inventario
  showActiveIngredient?: boolean; // mostra il campo "Principio attivo" (solo farmaci)
};

type Word = {
  text: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type Parsed = Pick<ScanDetails, 'aic'>;

const JUNK_PATTERNS = [
  /^compresse?$/i,
  /^capsule?$/i,
  /^soluzione$/i,
  /^sciroppo$/i,
  /^uso\s+orale$/i,
  /^uso$/i,
  /^orale$/i,
  /^scatola$/i,
  /^aic$/i,
  /^mg$/i,
  /^g$/i,
  /^ml$/i,
  /^mcg$/i,
  /^\d+\s*(?:mg|g|ml|mcg)$/i,
  /^comp$/i,
  /^cpr$/i,
  /^rivestita$/i,
  /^rivestite$/i,
  /^gastroresistenti$/i,
  /^gastroresistente$/i,
  /^eccipienti$/i,
  /^principio$/i,
  /^attivo$/i,
  /^[®™]+$/,
  // aggiunte
  /^(?:lotto|scad|scadenza|exp|lot)\.?$/i,
  /^(?:foglio|illustrativo|medicinale|farmaco|confezione|blister|film|bustine?)$/i,
  /^(?:conservare|tenere|fuori|portata|bambini|leggere|attentamente|prima|dell'uso)$/i,
  /^(?:per|di|da|il|la|le|con|del|della|dei|delle|e|in|a)$/i,
  /^(?:aifa|ssn|otc|sop)$/i,
];

const GUIDE_INSET = 16; // px, uguale a "inset-4" del rettangolo guida

/* ---------------------------------- barcode --------------------------------- */

const B32 = '0123456789BCDFGHJKLMNPQRSTUVWXYZ';

/** Converte il contenuto del Code 39 del bollino (o un AIC testuale) in AIC a 9 cifre. */
function toAic(raw: string): string | undefined {
  const t = raw.trim().toUpperCase().replace(/^A(?=\d{9}$)/, '');
  if (/^\d{9}$/.test(t)) return t;
  if (/^[0-9BCDFGHJKLMNPQRSTUVWXYZ]{8,9}$/.test(t)) {
    let n = 0;
    for (const c of t.slice(0, 8)) n = n * 32 + B32.indexOf(c);
    return String(n).padStart(9, '0');
  }
  return undefined;
}

/** DataMatrix GS1 dei farmaci: dal GTIN (01) si ricava l'AIC. */
function parseGs1(raw: string): Parsed | undefined {
  const m = raw.replace(/^\]d2/, '').match(/^01(\d{14})/);
  if (!m || !m[1].startsWith('0380')) return undefined;
  return { aic: m[1].slice(4, 13) };
}

function parseBarcode(raw: string): Parsed | undefined {
  if (!raw) return undefined;
  const gs1 = parseGs1(raw);
  if (gs1) return gs1;
  const aic = toAic(raw);
  return aic ? { aic } : undefined;
}

/* ------------------------------------ OCR ----------------------------------- */

function parseLabel(text: string): ScanDetails {
  const dosage = text.match(/\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|µg|ui)\b/i);
  const pct = text.match(/(\d+(?:[.,]\d+)?\s*%(?:\s*\/\s*\d+(?:[.,]\d+)?\s*%)?)/);
  const aic = text.match(/\b(0\d{8})\b/);
  const form = text.match(
    /\b(compress[ae]|capsul[ae]|bustine?|sciroppo|gocce|fiale?|supposte?|crema|cerotti?|pomata|spray|collirio)\b/i
  );
  return {
    dosage: dosage
      ? `${dosage[1].replace(',', '.')} ${dosage[2].toLowerCase()}`
      : pct
        ? pct[1].replace(/\s+/g, '')
        : undefined,
    aic: aic?.[1],
    form: form?.[1].toLowerCase(),
  };
}

function extractWords(data: any): Word[] {
  if (Array.isArray(data?.words) && data.words.length) return data.words as Word[];
  if (Array.isArray(data?.blocks)) {
    return data.blocks.flatMap((b: any) =>
      (b.paragraphs ?? []).flatMap((p: any) => (p.lines ?? []).flatMap((l: any) => l.words ?? []))
    );
  }
  return [];
}

const CONNECTORS = /^(?:e|di|da|con|del|della|dei|delle|in|a|per|il|la)$/i;

function cleanWord(w: Word): Word | null {
  const text = w.text
    .trim()
    .replace(/[®™]/g, '')
    .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, '');
  if (text.length < 2) return null;
  if (w.confidence !== undefined && w.confidence < 55) return null;
  if (JUNK_PATTERNS.some((p) => p.test(text))) return null;
  if (/^\d+$/.test(text)) return null;
  return { ...w, text };
}

/** Raggruppa le parole per riga, separando anche colonne distanti. */
function groupLines(words: Word[]): Word[][] {
  const cy = (w: Word) => (w.bbox.y0 + w.bbox.y1) / 2;
  const hh = (w: Word) => w.bbox.y1 - w.bbox.y0;
  const sorted = [...words].sort((a, b) => cy(a) - cy(b));
  const rows: Word[][] = [];
  for (const w of sorted) {
    const last = rows[rows.length - 1];
    if (last) {
      const avgCy = last.reduce((s, x) => s + cy(x), 0) / last.length;
      const avgH = last.reduce((s, x) => s + hh(x), 0) / last.length;
      if (Math.abs(cy(w) - avgCy) < Math.max(avgH, hh(w)) * 0.5) {
        last.push(w);
        continue;
      }
    }
    rows.push([w]);
  }
  const lines: Word[][] = [];
  for (const row of rows) {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let cur: Word[] = [];
    for (const w of row) {
      const prev = cur[cur.length - 1];
      if (prev && w.bbox.x0 - prev.bbox.x1 > Math.max(hh(prev), hh(w)) * 2) {
        lines.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) lines.push(cur);
  }
  return lines;
}

function prettify(text: string) {
  const t = text.replace(/[^A-Za-zÀ-ÿ0-9'\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > 3 && t === t.toUpperCase()) {
    return t.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
  }
  return t;
}

/** Restituisce i nomi candidati ordinati per probabilità. */
function rankNames(words: Word[], imgH: number): string[] {
  const scored: { text: string; score: number }[] = [];
  for (const line of groupLines(words)) {
    const stripped = line.map((w) => ({
      ...w,
      text: w.text
        .trim()
        .replace(/[®™]/g, '')
        .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, ''),
    }));
    const kept = stripped.map((w) => cleanWord(w));
    const clean: Word[] = [];
    stripped.forEach((w, i) => {
      const k = kept[i];
      if (k) clean.push(k);
      else if (CONNECTORS.test(w.text) && kept[i - 1] && kept[i + 1]) {
        clean.push({ ...w, confidence: w.confidence ?? 80 });
      }
    });
    if (clean.length === 0) continue;
    const text = clean.map((w) => w.text).join(' ');
    const compact = text.replace(/\s/g, '');
    const letters = (compact.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
    const ratio = letters / Math.max(1, compact.length);
    if (ratio < 0.7) continue;
    const heights = clean.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
    const height = heights[Math.floor(heights.length / 2)];
    const conf = clean.reduce((s, w) => s + (w.confidence ?? 80), 0) / clean.length / 100;
    const yc = clean.reduce((s, w) => s + (w.bbox.y0 + w.bbox.y1) / 2, 0) / clean.length / imgH;
    const score =
      height * ratio * conf * (yc < 0.6 ? 1.15 : 1) * (clean.length > 4 ? 0.7 : 1);
    scored.push({ text: prettify(text), score });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return scored
    .map((s) => s.text)
    .filter((t) => {
      const k = t.toLowerCase();
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

const INN_SUFFIX =
  /(?:ina|ine|olo|one|ide|ato|ile|ene|ano|ico|ium|mab|nib|pril|sartan|statina|azolo|cillina|micina|dipina|zepam|tidina|terolo|asone|olone|etina|ilina|oxina|ammina|ac|uro)$/i;

const NOT_ACTIVE =
  /^(?:medico|sterile|confezione|medicinale|farmacista|farmaco|farmaci|cutaneo|cutanea|orale|vaginale|nasale|oftalmico|auricolare|rettale|unico|singolo|monodose|dose|dosi|ogni|contiene|tubo|crema|pomata|gel|gocce|spray|compresse|compressa|capsule|capsula|bustine|bustina|soluzione|sciroppo|unguento|polvere|scatola|lotto|scadenza|uso|per|con|senza|dopo|prima|pasti|giorno|giorni|bambini|adulti|portata|conservare|temperatura|ambiente|luce|leggere|attentamente|foglio|illustrativo|eccipienti|principio|attivo|rivestite|rivestita|film|gastroresistenti|generico|equivalente)$/i;

/**
 * Cerca il principio attivo: sulle confezioni italiane compare di solito in minuscolo
 * sotto il nome commerciale (es. "gentamicina/betametasone"). Se non è sicuro restituisce undefined.
 */
function findActiveIngredient(words: Word[], name: string, fullText: string): string | undefined {
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  const good = words.filter((w) => (w.confidence ?? 80) >= 50);
  const lines = groupLines(good).map((line) => {
    const hs = line.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
    return {
      text: line.map((w) => w.text).join(' ').trim(),
      cy: line.reduce((s, w) => s + (w.bbox.y0 + w.bbox.y1) / 2, 0) / line.length,
      h: hs[Math.floor(hs.length / 2)],
      conf: line.reduce((s, w) => s + (w.confidence ?? 80), 0) / line.length,
    };
  });

  const firstWord = (name.toLowerCase().split(/\s+/)[0] ?? '').replace(/[^a-zà-ÿ]/g, '');
  const nameLine =
    firstWord.length >= 4
      ? lines
          .filter((l) => l.text.toLowerCase().includes(firstWord))
          .sort((a, b) => b.h - a.h)[0]
      : undefined;

  let best: { value: string; score: number } | undefined;
  for (const l of lines) {
    if (l === nameLine) continue;
    const stripped = l.text
      .replace(/\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|µg|ui|%)/gi, ' ')
      .replace(/[®™]/g, ' ');
    if (/\d/.test(stripped)) continue;
    const tokens = stripped.replace(/[^A-Za-zÀ-ÿ\/\-\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 6) continue;
    const parts = tokens.flatMap((t) => t.split('/')).filter(Boolean);
    const content = parts.filter((p) => p.length >= 3 && !NOT_ACTIVE.test(p) && !CONNECTORS.test(p));
    const innHits = content.filter((p) => p.length >= 5 && INN_SUFFIX.test(p)).length;
    if (innHits === 0) continue;
    if (content.length < parts.length * 0.6) continue;

    const value = tokens
      .filter((t) => !NOT_ACTIVE.test(t))
      .join(' ')
      .replace(/^[\/\-\s]+|[\/\-\s]+$/g, '')
      .toLowerCase();
    if (value.length < 5) continue;

    let score = innHits * 3 + l.conf / 100;
    if (nameLine) {
      const dy = l.cy - nameLine.cy;
      if (dy > 0 && dy < nameLine.h * 6) score += 3;
      if (l.h <= nameLine.h) score += 1;
    }
    if (!best || score > best.score) best = { value, score };
  }
  if (best) return cap(best.value);

  // ripiego: "Principio attivo: paracetamolo" / "Ogni compressa contiene: ..."
  const m = fullText.match(
    /(?:principio\s+attivo|contiene)\s*:?\s*([A-Za-zÀ-ÿ\-]{5,})/i
  );
  if (m && INN_SUFFIX.test(m[1]) && !NOT_ACTIVE.test(m[1])) return cap(m[1].toLowerCase());
  return undefined;
}

/* ---------------------------------- component -------------------------------- */

export default function ScannerModal({ open, onClose, onConfirm, mode = 'search', itemFound, showActiveIngredient = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerPromiseRef = useRef<Promise<any> | null>(null);
  const openRef = useRef(open);
  const barcodeRef = useRef<Parsed | null>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [editableName, setEditableName] = useState('');
  const [editableActive, setEditableActive] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [details, setDetails] = useState<ScanDetails>({});
  const [scannedQty, setScannedQty] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [barcode, setBarcode] = useState<Parsed | null>(null);

  openRef.current = open;

  /* camera */

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    stopCamera(); // evita stream duplicati
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (!openRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps: any = track?.getCapabilities?.() ?? {};
      setTorchAvailable(!!caps.torch);
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        } catch {
          /* non supportato */
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      const name = e?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Permesso fotocamera negato. Abilitalo nelle impostazioni del browser.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('Nessuna fotocamera trovata su questo dispositivo.');
      } else if (name === 'NotReadableError') {
        setError('La fotocamera è in uso da un’altra app. Chiudila e riprova.');
      } else {
        setError('Impossibile accedere alla fotocamera. Verifica i permessi del browser.');
      }
    }
  }, [stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  useEffect(() => {
    if (open) {
      setResult(null);
      setEditableName('');
      setEditableActive('');
      setSuggestions([]);
      setDetails({});
      setScannedQty(1);
      setBarcode(null);
      barcodeRef.current = null;
      void startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  /* worker OCR: creato una volta, precaricato all'apertura, terminato alla chiusura */

  const getWorker = useCallback(() => {
    if (!workerPromiseRef.current) {
      workerPromiseRef.current = import('tesseract.js').then((m) => m.createWorker('ita+eng'));
    }
    return workerPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!open) return;
    void getWorker().catch(() => {
      workerPromiseRef.current = null;
    });
    return () => {
      const p = workerPromiseRef.current;
      workerPromiseRef.current = null;
      void p?.then((w) => w.terminate()).catch(() => undefined);
    };
  }, [open, getWorker]);

  /* barcode continuo (Chrome/Android; altrove si usa solo l'OCR) */

  const mergeBarcode = useCallback((p: Parsed) => {
    const prev = barcodeRef.current;
    const merged = { ...prev, ...p };
    barcodeRef.current = merged;
    if (!prev?.aic && merged.aic) navigator.vibrate?.(40);
    setBarcode(merged);
  }, []);

  useEffect(() => {
    if (!open || result || scanning) return;
    const BD = (window as any).BarcodeDetector;
    if (!BD) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      let detector: any;
      try {
        const supported: string[] = await BD.getSupportedFormats();
        const formats = ['code_39', 'data_matrix', 'ean_13'].filter((f) => supported.includes(f));
        if (!formats.length) return;
        detector = new BD({ formats });
      } catch {
        return;
      }
      if (cancelled) return;
      let busy = false;
      timer = setInterval(async () => {
        const v = videoRef.current;
        if (busy || !v || v.readyState < 2) return;
        busy = true;
        try {
          const codes = await detector.detect(v);
          for (const c of codes) {
            const p = parseBarcode(c.rawValue ?? '');
            if (p) mergeBarcode(p);
          }
        } catch {
          /* frame non valido */
        } finally {
          busy = false;
        }
      }, 350);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [open, result, scanning, mergeBarcode]);

  /* acquisizione: ritaglio sul riquadro guida + scala di grigi + contrasto */

  const grabFrame = () => {
    const video = videoRef.current;
    const box = frameRef.current;
    if (!video || !box || !video.videoWidth) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = box.clientWidth;
    const ch = box.clientHeight;
    const scale = Math.max(cw / vw, ch / vh); // object-cover
    const ox = (vw * scale - cw) / 2;
    const oy = (vh * scale - ch) / 2;
    const sx = Math.max(0, (GUIDE_INSET + ox) / scale);
    const sy = Math.max(0, (GUIDE_INSET + oy) / scale);
    const sw = Math.min(vw - sx, (cw - 2 * GUIDE_INSET) / scale);
    const sh = Math.min(vh - sy, (ch - 2 * GUIDE_INSET) / scale);

    const outW = Math.round(Math.min(2000, Math.max(sw, 1400)));
    const k = outW / sw;
    const outH = Math.round(sh * k);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

    const img = ctx.getImageData(0, 0, outW, outH);
    const d = img.data;
    const n = outW * outH;
    const gray = new Uint8ClampedArray(n);
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      const g = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) | 0;
      gray[i] = g;
      hist[g]++;
    }

    // nitidezza = varianza del laplaciano (per scegliere il frame migliore)
    let sum = 0;
    let sumSq = 0;
    let cnt = 0;
    for (let y = 1; y < outH - 1; y += 2) {
      for (let x = 1; x < outW - 1; x += 2) {
        const i = y * outW + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - outW] - gray[i + outW];
        sum += lap;
        sumSq += lap * lap;
        cnt++;
      }
    }
    const sharpness = sumSq / cnt - (sum / cnt) ** 2;

    // stiramento del contrasto tra 2° e 98° percentile
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= n * 0.02) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= n * 0.02) {
        hi = v;
        break;
      }
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < n; i++) {
      const v = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / range));
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, sharpness };
  };

  const captureAndScan = async () => {
    if (!videoRef.current) return;
    setScanning(true);
    setError(null);

    try {
      // 3 frame ravvicinati: si usa il più nitido
      let best: { canvas: HTMLCanvasElement; sharpness: number } | null = null;
      for (let i = 0; i < 3; i++) {
        const f = grabFrame();
        if (f && (!best || f.sharpness > best.sharpness)) best = f;
        if (i < 2) await new Promise((r) => setTimeout(r, 140));
      }
      if (!best) {
        setError('Fotocamera non pronta. Riprova tra un istante.');
        setScanning(false);
        return;
      }

      // eventuale barcode sul frame catturato
      const BD = (window as any).BarcodeDetector;
      if (BD && !barcodeRef.current?.aic) {
        try {
          const det = new BD({ formats: ['code_39', 'data_matrix', 'ean_13'] });
          for (const c of await det.detect(best.canvas)) {
            const p = parseBarcode(c.rawValue ?? '');
            if (p) mergeBarcode(p);
          }
        } catch {
          /* ignora */
        }
      }

      const worker = await getWorker();
      let ret = await worker.recognize(best.canvas);
      let words = extractWords(ret.data);
      if (words.length === 0) {
        // versioni recenti di tesseract.js restituiscono le parole solo se richieste
        try {
          ret = await worker.recognize(best.canvas, {}, { blocks: true });
          words = extractWords(ret.data);
        } catch {
          /* ignora */
        }
      }

      const bc = barcodeRef.current;
      if (words.length === 0 && !bc) {
        setError('Nessun testo rilevato. Riprova avvicinando la confezione.');
        setScanning(false);
        return;
      }

      const names = rankNames(words, best.canvas.height);
      if (names.length === 0 && !bc) {
        setError('Testo illeggibile. Assicurati che il nome sulla scatola sia a fuoco.');
        setScanning(false);
        return;
      }

      const parsed = parseLabel(words.map((w) => w.text).join(' ') + ' ' + (ret.data.text ?? ''));
      setDetails({
        dosage: parsed.dosage,
        form: parsed.form,
        aic: bc?.aic ?? parsed.aic,
      });

      const finalDetected = names[0] ?? '';
      setSuggestions(names.slice(1, 4));
      setResult(finalDetected);
      setEditableName(finalDetected);
      setEditableActive(findActiveIngredient(words, finalDetected, ret.data.text ?? '') ?? '');
      navigator.vibrate?.(40);
      stopCamera();
    } catch (err) {
      console.error('Errore OCR:', err);
      setError('Errore durante la lettura della confezione. Riprova.');
    }
    setScanning(false);
  };

  const handleConfirm = () => {
    if (editableName.trim()) {
      const cleanDetails = Object.fromEntries(
        Object.entries(details).filter(([, v]) => v !== undefined)
      ) as ScanDetails;
      const active = editableActive.trim();
      onConfirm(
        editableName.trim(),
        scannedQty,
        active ? { ...cleanDetails, activeIngredient: active } : cleanDetails
      );
      onClose();
    }
  };

  const handleRetry = () => {
    setResult(null);
    setEditableName('');
    setEditableActive('');
    setSuggestions([]);
    setDetails({});
    setScannedQty(1);
    setBarcode(null);
    barcodeRef.current = null;
    void startCamera();
  };

  if (!open) return null;

  const chips = [
    details.dosage && ['Dosaggio', details.dosage],
    details.form && ['Forma', details.form],
    details.aic && ['AIC', details.aic],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'count' ? 'Conteggio Rapido da Scanner' : 'Scanner Confezione'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* il video resta sempre montato: così la camera si riavvia correttamente */}
        <div className={result !== null ? 'hidden' : 'space-y-4'}>
          <div
            ref={frameRef}
            className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video"
          >
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-sm text-white">Riconoscimento etichetta...</span>
                </div>
              </div>
            )}
            <div
              className={`pointer-events-none absolute inset-4 border-2 rounded-lg ${
                barcode?.aic ? 'border-emerald-400' : 'border-teal-400/60'
              }`}
            />
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full ${
                  torchOn ? 'bg-yellow-400 text-slate-900' : 'bg-slate-900/60 text-white'
                }`}
                aria-label="Torcia"
              >
                <Zap className="h-4 w-4" />
              </button>
            )}
            {barcode?.aic && (
              <div className="absolute bottom-6 left-6 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white">
                Codice AIC rilevato
              </div>
            )}
          </div>
          <p className="text-sm text-slate-600 text-center">
            Inquadra la scatola del farmaco all'interno del rettangolo.
          </p>
          <button onClick={captureAndScan} disabled={scanning} className="btn-primary w-full">
            {scanning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Lettura in corso...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Scatta e Riconosci
              </>
            )}
          </button>
        </div>

        {result !== null && (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
              <div>
                <p className="text-xs text-teal-600 font-medium mb-1">Nome rilevato dalla scatola:</p>
                <input
                  type="text"
                  value={editableName}
                  onChange={(e) => setEditableName(e.target.value)}
                  placeholder="Scrivi il nome del farmaco"
                  className="input text-lg font-semibold bg-white"
                  autoFocus
                />
              </div>

              {showActiveIngredient && (
                <div>
                  <p className="text-xs text-teal-600 font-medium mb-1">Principio attivo:</p>
                  <input
                    type="text"
                    value={editableActive}
                    onChange={(e) => setEditableActive(e.target.value)}
                    placeholder="Scrivi il principio attivo"
                    className="input font-semibold bg-white"
                  />
                  {!editableActive.trim() && (
                    <p className="mt-1 text-[11px] text-teal-700">
                      Non rilevato dalla scatola: puoi scriverlo qui o nel modulo.
                    </p>
                  )}
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-teal-700 mb-1">Altre letture possibili:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditableName(s)}
                        className="rounded-full border border-teal-300 bg-white px-3 py-1 text-sm text-teal-800"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-teal-200">
                  {chips.map(([label, value]) => (
                    <span
                      key={label}
                      className="rounded-lg bg-white px-2 py-1 text-xs text-slate-700 border border-teal-100"
                    >
                      <span className="text-teal-600">{label}:</span> {value}
                    </span>
                  ))}
                </div>
              )}

              {/* Se siamo in modalità conteggio, permette di aggiungere direttamente i pezzi */}
              {mode === 'count' && (
                <div className="pt-2 border-t border-teal-200">
                  <p className="text-xs text-teal-700 font-medium mb-2">Quante scatole vuoi aggiungere al piano?</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setScannedQty((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700 font-bold"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="text-2xl font-bold text-slate-900 w-16 text-center tabular-nums">
                      {scannedQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScannedQty((q) => q + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleRetry} className="btn-secondary flex-1">
                <RefreshCw className="h-4 w-4" />
                Scatta di nuovo
              </button>
              <button
                onClick={handleConfirm}
                disabled={!editableName.trim()}
                className="btn-primary flex-1"
              >
                <Check className="h-4 w-4" />
                {mode === 'count' ? 'Registra nel Piano' : 'Conferma Nome'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
