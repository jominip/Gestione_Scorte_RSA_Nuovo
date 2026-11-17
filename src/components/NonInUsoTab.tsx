import { useEffect, useState } from 'react';
import { supabase, ITEM_TYPES } from '@/lib/supabase';

type Riga = {
  id: string;
  principio_attivo: string;
  dosaggio: string | null;
  tipo: string | null;
  nome_commerciale: string | null;
  quantita: number;
    updated_at: string;
  scadenze: { data: string; qta: number }[] | null;
};

type Props = {
  medications: any[];
  onAdd: (med: any) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onBack: () => void;
};

const PIANI = [
  { key: 'qty_pt', label: 'Piano Terra (PT)' },
  { key: 'qty_1', label: 'Piano 1' },
  { key: 'qty_2', label: 'Piano 2' },
  { key: 'qty_3', label: 'Piano 3' },
  { key: 'qty_pl', label: 'Palestra (PL)' },
];

const norm = (s?: string | null) => {
  const t = (s || '').trim().toLowerCase();
  return t === '—' ? '' : t;
};

const sbloccato = () => {
  try {
    return sessionStorage.getItem('rsa_unlocked') === '1';
  } catch {
    return false;
  }
};

export default function NonInUsoTab({ medications, onAdd, onUpdate, onBack }: Props) {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [errore, setErrore] = useState('');
  const [cerca, setCerca] = useState('');
  const [mostraForm, setMostraForm] = useState(false);
  const [nuovo, setNuovo] = useState({
    principio_attivo: '',
    dosaggio: '',
    tipo: 'Compresse',
    nome_commerciale: '',
    quantita: 0,
  });

  const [trasferisci, setTrasferisci] = useState<Riga | null>(null);
  const [piano, setPiano] = useState('qty_pt');
  const [qta, setQta] = useState('1');
  const [trErr, setTrErr] = useState('');
    const [saving, setSaving] = useState(false);

  const [scadRiga, setScadRiga] = useState<Riga | null>(null);
  const [scadLista, setScadLista] = useState<{ data: string; qta: string }[]>([]);
    const [scadErr, setScadErr] = useState('');

  const [modRiga, setModRiga] = useState<Riga | null>(null);
  const [modForm, setModForm] = useState({
    principio_attivo: '',
    dosaggio: '',
    tipo: 'Compresse',
    nome_commerciale: '',
    quantita: '0',
  });
    const [modErr, setModErr] = useState('');

  const [piuRiga, setPiuRiga] = useState<Riga | null>(null);
  const [piuScelta, setPiuScelta] = useState('nuova');
  const [piuData, setPiuData] = useState('');
    const [piuErr, setPiuErr] = useState('');

  const [menoRiga, setMenoRiga] = useState<Riga | null>(null);
  const [menoScelta, setMenoScelta] = useState('senza');
  const [menoErr, setMenoErr] = useState('');

  const carica = async () => {
    const { data, error } = await supabase
      .from('farmaci_non_in_uso')
      .select('*')
      .order('principio_attivo', { ascending: true });
    if (error) {
      setErrore('Errore nel caricamento: ' + error.message);
      return;
    }
    setErrore('');
    setRighe((data as Riga[]) || []);
  };

  useEffect(() => {
    carica();
  }, []);

  const aggiungi = async () => {
    if (!nuovo.principio_attivo.trim()) {
      setErrore('Scrivi il principio attivo.');
      return;
    }
    const { error } = await supabase.from('farmaci_non_in_uso').insert({
      principio_attivo: nuovo.principio_attivo.trim(),
      dosaggio: nuovo.dosaggio.trim() || null,
      tipo: nuovo.tipo || null,
      nome_commerciale: nuovo.nome_commerciale.trim() || null,
      quantita: Number(nuovo.quantita) || 0,
    });
    if (error) {
      setErrore('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setNuovo({ principio_attivo: '', dosaggio: '', tipo: 'Compresse', nome_commerciale: '', quantita: 0 });
    setMostraForm(false);
    carica();
  };

  const cambiaQuantita = async (r: Riga, nuova: number) => {
    const q = Math.max(0, nuova);
    const { error } = await supabase
      .from('farmaci_non_in_uso')
      .update({ quantita: q, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) {
      setErrore('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setErrore('');
    carica();
  };

  const elimina = async (r: Riga) => {
    if (!window.confirm('Eliminare ' + r.principio_attivo + ' ' + (r.dosaggio || '') + '?')) return;
    const { error } = await supabase.from('farmaci_non_in_uso').delete().eq('id', r.id);
    if (error) {
      setErrore('Eliminazione NON riuscita: ' + error.message);
      return;
    }
    carica();
  };

  const apriTrasferimento = (r: Riga) => {
    if (!sbloccato()) {
      setErrore("Per trasferire serve il PIN: torna all'Armadio Farmacia, premi \"Sblocca Modifiche\" e riprova.");
      return;
    }
    setErrore('');
    setPiano('qty_pt');
    setQta('1');
    setTrErr('');
    setTrasferisci(r);
  };

  const trovaInArmadio = (r: Riga) =>
    medications.find(
      (m) =>
        m.category === 'farmaco' &&
        norm(m.active_ingredient) === norm(r.principio_attivo) &&
        norm(m.dosage) === norm(r.dosaggio) &&
        norm(m.item_type) === norm(r.tipo)
    );

  const confermaTrasferimento = async () => {
    if (!trasferisci) return;
    const r = trasferisci;
    const n = parseInt(qta, 10);
    const pianoLabel = PIANI.find((p) => p.key === piano)?.label || '';

    if (isNaN(n) || n < 1) { setTrErr('Scrivi una quantità di almeno 1.'); return; }
    if (n > r.quantita) { setTrErr('In non in uso ci sono solo ' + r.quantita + ' scatole.'); return; }

    try {
      setSaving(true);
      const adesso = new Date().toISOString();
      const esistente = trovaInArmadio(r);

      if (esistente) {
        await onUpdate(esistente.id, {
          [piano]: (esistente[piano] || 0) + n,
          updated_at: adesso,
        });
      } else {
        await onAdd({
          active_ingredient: r.principio_attivo,
          dosage: r.dosaggio || '',
          item_type: r.tipo || 'Compresse',
          commercial_name: r.nome_commerciale || '',
          pack_size: 1,
          qty_mc: 0,
          qty_pt: piano === 'qty_pt' ? n : 0,
          qty_1: piano === 'qty_1' ? n : 0,
          qty_2: piano === 'qty_2' ? n : 0,
          qty_3: piano === 'qty_3' ? n : 0,
          qty_pl: piano === 'qty_pl' ? n : 0,
          category: 'farmaco',
          updated_at: adesso,
        });
      }

      const { error } = await supabase
        .from('farmaci_non_in_uso')
        .update({ quantita: r.quantita - n, updated_at: adesso })
        .eq('id', r.id);
      if (error) {
        setTrErr('Le scatole sono nell\'Armadio (' + pianoLabel + ') ma NON sono state tolte da qui: ' + error.message);
        return;
      }

      setTrasferisci(null);
      setTrErr('');
      carica();
    } catch (err) {
      console.error('Errore trasferimento verso armadio:', err);
      setTrErr('Trasferimento non riuscito. Controlla le quantità prima di riprovare.');
    } finally {
      setSaving(false);
    }
  };

      const adesso0 = new Date();
  const mesiOggi = adesso0.getFullYear() * 12 + adesso0.getMonth() + 1;
  const MESI_AVVISO = 1;

  const statoScad = (s: string) => {
    const [a, m] = s.split('-');
    const diff = parseInt(a, 10) * 12 + parseInt(m, 10) - mesiOggi;
    if (diff < 0) return 'scaduta';
    if (diff <= MESI_AVVISO) return 'in_scadenza';
    return 'ok';
  };

  const formattaScad = (s: string) => {
    const [a, m] = s.split('-');
    return m + '/' + a.slice(2);
  };

  const scriviMeseAnno = (v: string) => {
    const cifre = v.replace(/\D/g, '').slice(0, 4);
    return cifre.length > 2 ? cifre.slice(0, 2) + '/' + cifre.slice(2) : cifre;
  };

        const apriMeno = (r: Riga) => {
    if (r.quantita <= 0) return;
    const lista = [...(r.scadenze || [])].sort((a, b) => a.data.localeCompare(b.data));
    if (lista.length === 0) {
      cambiaQuantita(r, r.quantita - 1);
      return;
    }
    setMenoScelta(lista[0].data);
    setMenoErr('');
    setMenoRiga(r);
  };

  const confermaMeno = async () => {
    if (!menoRiga) return;
    let lista = (menoRiga.scadenze || []).map((s) => ({ ...s }));

    if (menoScelta !== 'senza') {
      const esiste = lista.find((s) => s.data === menoScelta);
      if (esiste) esiste.qta -= 1;
      lista = lista.filter((s) => s.qta > 0);
    }

    const { error } = await supabase
      .from('farmaci_non_in_uso')
      .update({
        quantita: Math.max(0, menoRiga.quantita - 1),
        scadenze: lista,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menoRiga.id);
    if (error) {
      setMenoErr('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setMenoRiga(null);
    setMenoErr('');
    carica();
  };

  const apriPiu = (r: Riga) => {
    const lista = [...(r.scadenze || [])].sort((a, b) => a.data.localeCompare(b.data));
    setPiuScelta(lista.length > 0 ? lista[0].data : 'nuova');
    setPiuData('');
    setPiuErr('');
    setPiuRiga(r);
  };

  const confermaPiu = async () => {
    if (!piuRiga) return;
    const lista = (piuRiga.scadenze || []).map((s) => ({ ...s }));

    if (piuScelta === 'nuova') {
      const m = piuData.match(/^(\d{2})\/(\d{2})$/);
      const mese = m ? parseInt(m[1], 10) : 0;
      if (!m || mese < 1 || mese > 12) {
        setPiuErr('Scrivi la scadenza come MM/AA, per esempio 03/27.');
        return;
      }
      const chiave = '20' + m[2] + '-' + m[1];
      const esiste = lista.find((s) => s.data === chiave);
      if (esiste) esiste.qta += 1;
      else lista.push({ data: chiave, qta: 1 });
    } else if (piuScelta !== 'senza') {
      const esiste = lista.find((s) => s.data === piuScelta);
      if (esiste) esiste.qta += 1;
    }

    lista.sort((a, b) => a.data.localeCompare(b.data));

    const { error } = await supabase
      .from('farmaci_non_in_uso')
      .update({
        quantita: piuRiga.quantita + 1,
        scadenze: lista,
        updated_at: new Date().toISOString(),
      })
      .eq('id', piuRiga.id);
    if (error) {
      setPiuErr('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setPiuRiga(null);
    setPiuErr('');
    carica();
  };

  const apriModifica = (r: Riga) => {
    setModForm({
      principio_attivo: r.principio_attivo || '',
      dosaggio: r.dosaggio || '',
      tipo: r.tipo || 'Compresse',
      nome_commerciale: r.nome_commerciale || '',
      quantita: String(r.quantita),
    });
    setModErr('');
    setModRiga(r);
  };

  const salvaModifica = async () => {
    if (!modRiga) return;
    const pa = modForm.principio_attivo.trim();
    const n = parseInt(modForm.quantita, 10);
    if (!pa) { setModErr('Scrivi il principio attivo.'); return; }
    if (isNaN(n) || n < 0) { setModErr('La quantità deve essere 0 o più.'); return; }
    const doppione = righe.find(
      (x) =>
        x.id !== modRiga.id &&
        norm(x.principio_attivo) === norm(pa) &&
        norm(x.dosaggio) === norm(modForm.dosaggio) &&
        norm(x.tipo) === norm(modForm.tipo)
    );
    if (doppione) {
      setModErr('Esiste già un\'altra riga con stesso principio attivo, dosaggio e tipo.');
      return;
    }
    const { error } = await supabase
      .from('farmaci_non_in_uso')
      .update({
        principio_attivo: pa,
        dosaggio: modForm.dosaggio.trim() || null,
        tipo: modForm.tipo || null,
        nome_commerciale: modForm.nome_commerciale.trim() || null,
        quantita: n,
        updated_at: new Date().toISOString(),
      })
      .eq('id', modRiga.id);
    if (error) {
      setModErr('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setModRiga(null);
    setModErr('');
    carica();
  };

  const apriScadenze = (r: Riga) => {
        setScadLista((r.scadenze || []).map((s) => ({ data: formattaScad(s.data), qta: String(s.qta) })));
    setScadErr('');
    setScadRiga(r);
  };

  const salvaScadenze = async () => {
    if (!scadRiga) return;
    const pulita: { data: string; qta: number }[] = [];
    for (const s of scadLista) {
      const n = parseInt(s.qta, 10);
            const m = s.data.match(/^(\d{2})\/(\d{2})$/);
      const mese = m ? parseInt(m[1], 10) : 0;
      if (!m || mese < 1 || mese > 12) { setScadErr('Scrivi la scadenza come MM/AA, per esempio 03/27.'); return; }
      if (isNaN(n) || n < 1) { setScadErr('In ogni riga scrivi almeno 1 scatola.'); return; }
      pulita.push({ data: '20' + m[2] + '-' + m[1], qta: n });
    }
    pulita.sort((a, b) => a.data.localeCompare(b.data));
    const { error } = await supabase
      .from('farmaci_non_in_uso')
      .update({ scadenze: pulita })
      .eq('id', scadRiga.id);
    if (error) {
      setScadErr('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setScadRiga(null);
    setScadErr('');
    carica();
  };

  const visibili = righe.filter((r) => {
    const t = cerca.trim().toLowerCase();
    if (!t) return true;
    return (
      r.principio_attivo.toLowerCase().includes(t) ||
      (r.nome_commerciale || '').toLowerCase().includes(t)
    );
  });

  const formatta = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ', ' +
      d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">Armadio Farmacia non in uso</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{righe.length} voci</span>
          <button
            onClick={() => setMostraForm(!mostraForm)}
            className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
          >
            + Aggiungi
          </button>
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium"
          >
            ← Torna all'Armadio Farmacia
          </button>
        </div>
      </div>

      {errore && (
        <div className="mb-3 p-3 rounded-lg bg-red-100 text-red-700 text-sm font-medium">{errore}</div>
      )}

      {mostraForm && (
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 grid grid-cols-2 md:grid-cols-5 gap-2">
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Principio attivo"
            value={nuovo.principio_attivo}
            onChange={(e) => setNuovo({ ...nuovo, principio_attivo: e.target.value })}
          />
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Dosaggio"
            value={nuovo.dosaggio}
            onChange={(e) => setNuovo({ ...nuovo, dosaggio: e.target.value })}
          />
          <select
            className="border rounded px-2 py-2 text-sm"
            value={nuovo.tipo}
            onChange={(e) => setNuovo({ ...nuovo, tipo: e.target.value })}
          >
            {ITEM_TYPES.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Nome commerciale"
            value={nuovo.nome_commerciale}
            onChange={(e) => setNuovo({ ...nuovo, nome_commerciale: e.target.value })}
          />
          <input
            type="number"
            min={0}
            className="border rounded px-2 py-2 text-sm"
            placeholder="Quantità"
            value={nuovo.quantita}
            onChange={(e) => setNuovo({ ...nuovo, quantita: Number(e.target.value) })}
          />
          <div className="col-span-2 md:col-span-5 flex gap-2">
            <button onClick={aggiungi} className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium">
              Salva
            </button>
            <button
              onClick={() => setMostraForm(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <input
        className="mb-3 w-full md:w-80 border rounded-lg px-3 py-2 text-sm"
        placeholder="Cerca principio attivo o nome commerciale"
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="p-3">Principio Attivo</th>
              <th className="p-3">Dosaggio</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Nome Commerciale</th>
                            <th className="p-3 text-center">Non in uso</th>
              <th className="p-3">Scadenze</th>
              <th className="p-3">Aggiornato</th>
              <th className="p-3 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {visibili.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">
                  Nessun farmaco. Premi "+ Aggiungi".
                </td>
              </tr>
            )}
            {visibili.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 font-semibold">{r.principio_attivo}</td>
                <td className="p-3">{r.dosaggio || '—'}</td>
                <td className="p-3">{r.tipo || '—'}</td>
                <td className="p-3">{r.nome_commerciale || '—'}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => cambiaQuantita(r, r.quantita - 1)}
                      className="w-7 h-7 rounded border border-gray-300"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold">{r.quantita}</span>
                    <button
                                            onClick={() => apriPiu(r)}
                      className="w-7 h-7 rounded border border-gray-300"
                    >
                      +
                    </button>
                  </div>
                </td>
                                <td className="p-3 text-xs">
                  {(r.scadenze || []).length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    [...(r.scadenze || [])]
                      .sort((a, b) => a.data.localeCompare(b.data))
                      .map((s, i) => (
                        <div
                          key={i}
                                                    className={
                            statoScad(s.data) === 'scaduta'
                              ? 'text-red-700 font-bold bg-red-100 rounded px-1 mb-0.5'
                              : statoScad(s.data) === 'in_scadenza'
                              ? 'text-orange-800 font-bold bg-orange-200 rounded px-1 mb-0.5'
                              : 'text-gray-700'
                          }
                        >
                          {formattaScad(s.data)} · {s.qta} scat.
                        </div>
                      ))
                  )}
                </td>
                <td className="p-3 text-xs text-gray-500">{formatta(r.updated_at)}</td>
                                <td className="p-3 text-center whitespace-nowrap">
                                    <button
                    onClick={() => apriModifica(r)}
                    className="mr-2 text-gray-400 hover:text-teal-700"
                    title="Modifica riga"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => apriScadenze(r)}
                    className="mr-2 text-gray-400 hover:text-teal-700"
                    title="Scadenze"
                  >
                    📅
                  </button>
                  <button
                    onClick={() => apriTrasferimento(r)}
                    className="mr-2 text-gray-400 hover:text-teal-700"
                    title="Trasferisci nell'Armadio Farmacia"
                  >
                    ⇄
                  </button>
                  <button onClick={() => elimina(r)} className="text-gray-400 hover:text-red-600" title="Elimina">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

                 {piuRiga && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Aggiungi una scatola</h3>
              <button onClick={() => setPiuRiga(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {piuRiga.principio_attivo} {piuRiga.dosaggio || ''}
            </p>
            <p className="text-xs text-slate-600">Scegli la scadenza della scatola:</p>

            {[...(piuRiga.scadenze || [])]
              .sort((a, b) => a.data.localeCompare(b.data))
              .map((s) => (
                <label key={s.data} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="piu"
                    checked={piuScelta === s.data}
                    onChange={() => { setPiuScelta(s.data); setPiuErr(''); }}
                  />
                  <span>
                    {formattaScad(s.data)} <span className="text-gray-500">(già {s.qta} scat.)</span>
                  </span>
                </label>
              ))}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="piu"
                checked={piuScelta === 'nuova'}
                onChange={() => { setPiuScelta('nuova'); setPiuErr(''); }}
              />
              <span>Nuova scadenza</span>
              {piuScelta === 'nuova' && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/AA"
                  maxLength={5}
                  value={piuData}
                  onChange={(e) => { setPiuData(scriviMeseAnno(e.target.value)); setPiuErr(''); }}
                  className="border rounded px-2 py-1 text-sm w-20"
                />
              )}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="piu"
                checked={piuScelta === 'senza'}
                onChange={() => { setPiuScelta('senza'); setPiuErr(''); }}
              />
              <span>Senza scadenza</span>
            </label>

            {piuErr && <p className="text-xs font-semibold text-red-600">{piuErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPiuRiga(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm"
              >
                Annulla
              </button>
              <button
                onClick={confermaPiu}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
              >
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}

      {modRiga && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Modifica riga</h3>
              <button onClick={() => setModRiga(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Principio attivo</label>
              <input
                className="border rounded px-2 py-2 text-sm w-full"
                value={modForm.principio_attivo}
                onChange={(e) => { setModForm({ ...modForm, principio_attivo: e.target.value }); setModErr(''); }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dosaggio</label>
              <input
                className="border rounded px-2 py-2 text-sm w-full"
                value={modForm.dosaggio}
                onChange={(e) => { setModForm({ ...modForm, dosaggio: e.target.value }); setModErr(''); }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
              <select
                className="border rounded px-2 py-2 text-sm w-full"
                value={modForm.tipo}
                onChange={(e) => { setModForm({ ...modForm, tipo: e.target.value }); setModErr(''); }}
              >
                {!ITEM_TYPES.includes(modForm.tipo) && <option value={modForm.tipo}>{modForm.tipo}</option>}
                {ITEM_TYPES.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome commerciale</label>
              <input
                className="border rounded px-2 py-2 text-sm w-full"
                value={modForm.nome_commerciale}
                onChange={(e) => { setModForm({ ...modForm, nome_commerciale: e.target.value }); setModErr(''); }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantità (scatole)</label>
              <input
                type="number"
                min={0}
                className="border rounded px-2 py-2 text-sm w-full"
                value={modForm.quantita}
                onChange={(e) => { setModForm({ ...modForm, quantita: e.target.value }); setModErr(''); }}
              />
            </div>
            {modErr && <p className="text-xs font-semibold text-red-600">{modErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModRiga(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm"
              >
                Annulla
              </button>
              <button
                onClick={salvaModifica}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {scadRiga && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Scadenze</h3>
              <button onClick={() => setScadRiga(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {scadRiga.principio_attivo} {scadRiga.dosaggio || ''}
            </p>
            <p className="text-xs text-slate-600">
              Scatole in totale: {scadRiga.quantita} · con scadenza indicata:{' '}
              {scadLista.reduce((somma, s) => somma + (parseInt(s.qta, 10) || 0), 0)}
            </p>
            <div className="space-y-2">
              {scadLista.length === 0 && (
                <p className="text-xs text-slate-400">Nessuna scadenza. Premi "+ Aggiungi scadenza".</p>
              )}
              {scadLista.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                                    <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    maxLength={5}
                    value={s.data}
                    onChange={(e) => {
                      const copia = [...scadLista];
                      copia[i] = { ...copia[i], data: scriviMeseAnno(e.target.value) };
                      setScadLista(copia);
                      setScadErr('');
                    }}
                    className="border rounded px-2 py-2 text-sm flex-1"
                  />
                  <input
                    type="number"
                    min={1}
                    value={s.qta}
                    onChange={(e) => {
                      const copia = [...scadLista];
                      copia[i] = { ...copia[i], qta: e.target.value };
                      setScadLista(copia);
                      setScadErr('');
                    }}
                    className="border rounded px-2 py-2 text-sm w-16"
                    title="Scatole"
                  />
                  <button
                    onClick={() => setScadLista(scadLista.filter((_, k) => k !== i))}
                    className="text-gray-400 hover:text-red-600"
                    title="Togli riga"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setScadLista([...scadLista, { data: '', qta: '1' }])}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              + Aggiungi scadenza
            </button>
            {scadErr && <p className="text-xs font-semibold text-red-600">{scadErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setScadRiga(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm"
              >
                Annulla
              </button>
              <button
                onClick={salvaScadenze}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {trasferisci && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Trasferisci nell'Armadio Farmacia</h3>
              <button onClick={() => setTrasferisci(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {trasferisci.principio_attivo} {trasferisci.dosaggio || ''}
            </p>
            <p className="text-xs text-slate-600">In non in uso: {trasferisci.quantita} scatole</p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">In quale piano</label>
              <select
                value={piano}
                onChange={(e) => { setPiano(e.target.value); setTrErr(''); }}
                className="border rounded px-2 py-2 text-sm w-full"
              >
                {PIANI.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quante scatole</label>
              <input
                type="number"
                min={1}
                value={qta}
                onChange={(e) => { setQta(e.target.value); setTrErr(''); }}
                className="border rounded px-2 py-2 text-sm w-full"
              />
            </div>
            {trErr && <p className="text-xs font-semibold text-red-600">{trErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTrasferisci(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm"
              >
                Annulla
              </button>
              <button
                onClick={confermaTrasferimento}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
              >
                {saving ? 'Salvataggio...' : 'Trasferisci'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}