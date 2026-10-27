import { useEffect, useMemo, useState } from 'react';
import { X, Camera, Plus, Minus, Search, Check, ShoppingCart } from 'lucide-react';
import ScannerModal from '@/components/ScannerModal';

type Props = {
  open: boolean;
  onClose: () => void;
  medications: any[]; // elenco già filtrato per categoria (farmaci o presidi)
  category: 'farmaco' | 'presidio';
  onReceive: (med: any, qty: number, field: string, completeOrder: boolean) => Promise<void>;
};

const LOCATIONS = [
  { field: 'qty_mc', label: 'Magazzino Centrale (MC)', short: 'MC', onlyPresidio: true },
  { field: 'qty_pt', label: 'Piano Terra (PT)', short: 'PT' },
  { field: 'qty_1', label: 'Piano 1', short: '1' },
  { field: 'qty_2', label: 'Piano 2', short: '2' },
  { field: 'qty_3', label: 'Piano 3', short: '3' },
  { field: 'qty_pl', label: 'Palestra (PL)', short: 'PL' },
];

/* ---------- ricerca "approssimata", tollera piccoli errori dell'OCR ---------- */

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function lev(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const tokenSim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length);

function similarity(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q || !t) return 0;
  if ((q.length >= 4 && t.includes(q)) || (t.length >= 5 && q.includes(t))) return 0.9;
  const qt = q.split(' ').filter((x) => x.length >= 3);
  const tt = t.split(' ').filter((x) => x.length >= 3);
  if (!qt.length || !tt.length) return 0;
  let hit = 0;
  for (const a of qt) if (tt.some((b) => tokenSim(a, b) >= 0.75)) hit++;
  return ((hit / qt.length + hit / tt.length) / 2) * 0.85;
}

const hasText = (v: any) => !!v && v !== '—';

export default function ReceiveModal({ open, onClose, medications, category, onReceive }: Props) {
  const locations = LOCATIONS.filter((l) => !l.onlyPresidio || category === 'presidio');

  const [query, setQuery] = useState('');
  const [hint, setHint] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [qty, setQty] = useState('1');
  const [field, setField] = useState(category === 'presidio' ? 'qty_mc' : 'qty_pt');
  const [complete, setComplete] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHint('');
      setShowAll(false);
      setSelected(null);
      setError(null);
      setDone(null);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    const terms = [q, hint.trim()].filter(Boolean);
    const rows = medications
      .filter((m) => !m.hidden)
      .map((m) => {
        const targets = [
          m.commercial_name,
          m.active_ingredient,
          `${m.commercial_name ?? ''} ${m.active_ingredient ?? ''}`,
        ].filter(hasText);
        const score = terms.length
          ? Math.max(0, ...terms.flatMap((t) => targets.map((x: string) => similarity(t, x))))
          : 0;
        return { m, score };
      });

    if (terms.length) {
      return rows
        .filter((r) => r.score >= 0.4)
        .sort((a, b) => b.score + (b.m.is_ordered ? 0.15 : 0) - (a.score + (a.m.is_ordered ? 0.15 : 0)))
        .slice(0, 30);
    }
    const base = showAll ? rows : rows.filter((r) => r.m.is_ordered);
    return [...base]
      .sort((a, b) => (a.m.active_ingredient || '').localeCompare(b.m.active_ingredient || ''))
      .slice(0, 60);
  }, [medications, query, hint, showAll]);

  const orderedCount = useMemo(
    () => medications.filter((m) => !m.hidden && m.is_ordered).length,
    [medications]
  );

  const pick = (m: any) => {
    setSelected(m);
    setQty('1');
    setComplete(true);
    setError(null);
    setDone(null);
  };

  const confirm = async () => {
    if (!selected) return;
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 1) {
      setError('Inserisci una quantità maggiore di zero.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onReceive(selected, n, field, selected.is_ordered ? complete : false);
      const short = locations.find((l) => l.field === field)?.short ?? '';
      setDone(`Registrato: +${n} ${selected.active_ingredient} (${short})`);
      setSelected(null);
      setQuery('');
      setHint('');
    } catch (e) {
      console.error('Errore carico:', e);
      setError('Salvataggio non riuscito. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
        <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Carico da ordine</h2>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {done && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-700" />
              <p className="text-sm text-emerald-800 font-medium">{done}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!selected && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setHint('');
                    }}
                    className="input pl-9"
                    placeholder="Cerca o scansiona la scatola"
                  />
                </div>
                <button onClick={() => setScannerOpen(true)} className="btn-secondary whitespace-nowrap">
                  <Camera className="h-4 w-4" />
                  <span className="hidden sm:inline">Scanner</span>
                </button>
              </div>

              {!query.trim() && !hint && (
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {showAll
                      ? 'Tutti gli articoli'
                      : orderedCount > 0
                        ? `In ordine: ${orderedCount}`
                        : 'Nessun articolo segnato "In Ordine"'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="font-semibold text-teal-700 underline"
                  >
                    {showAll ? 'Mostra solo in ordine' : 'Mostra tutti'}
                  </button>
                </div>
              )}

              {results.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  {query.trim() || hint
                    ? 'Nessun articolo trovato. Prova a scrivere il nome in modo diverso.'
                    : 'Scansiona una scatola o cerca per nome.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {results.map(({ m }: { m: any }) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => pick(m)}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{m.active_ingredient}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {[hasText(m.commercial_name) && m.commercial_name, hasText(m.dosage) && m.dosage, m.item_type]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {m.is_ordered && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 border border-sky-300 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                            <ShoppingCart className="h-3 w-3" /> In Ordine
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
                <p className="text-base font-bold text-slate-900">{selected.active_ingredient}</p>
                <p className="text-xs text-slate-600">
                  {[hasText(selected.commercial_name) && selected.commercial_name, hasText(selected.dosage) && selected.dosage, selected.item_type]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {locations.map((l) => (
                    <span
                      key={l.field}
                      className="rounded-md bg-white border border-teal-100 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {l.short}: <b>{selected[l.field] || 0}</b>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Quantità arrivata</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty(String(Math.max(1, (parseInt(qty, 10) || 1) - 1)))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700 font-bold"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="input w-24 text-center text-xl font-bold tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(String((parseInt(qty, 10) || 0) + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Dove la metti?</p>
                <select
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  className="input text-sm cursor-pointer"
                >
                  {locations.map((l) => (
                    <option key={l.field} value={l.field}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {selected.is_ordered && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={complete}
                    onChange={(e) => setComplete(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-200"
                  />
                  Ordine arrivato: togli "In Ordine"
                </label>
              )}

              <div className="flex gap-3">
                <button onClick={() => setSelected(null)} disabled={saving} className="btn-secondary flex-1">
                  Indietro
                </button>
                <button onClick={confirm} disabled={saving} className="btn-primary flex-1">
                  <Check className="h-4 w-4" />
                  {saving ? 'Salvataggio...' : 'Registra carico'}
                </button>
              </div>
            </div>
          )}

          {!selected && (
            <div className="pt-4">
              <button onClick={onClose} className="btn-secondary w-full">
                Chiudi
              </button>
            </div>
          )}
        </div>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirm={(name, _qty, details) => {
          setQuery(name);
          setHint(details?.activeIngredient ?? '');
          setScannerOpen(false);
        }}
        mode="search"
        showActiveIngredient={category === 'farmaco'}
      />
    </>
  );
}
