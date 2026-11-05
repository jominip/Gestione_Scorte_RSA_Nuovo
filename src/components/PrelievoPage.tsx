import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Medication } from '@/lib/supabase';

const PIANI = ['PT', '1', '2', '3', 'MC', 'PL'];
const QTY_PER_PIANO: Record<string, string> = {
  PT: 'qty_pt',
  '1': 'qty_1',
  '2': 'qty_2',
  '3': 'qty_3',
  MC: 'qty_mc',
  PL: 'qty_pl',
};
const NAME_KEY = 'prelievo_collega';

type Riga = {
  key: number;
  query: string;
  medId: string | null;
  scatole: string;
  piano: string;
  errore: string | null;
};

type Messaggio = { tipo: 'ok' | 'errore'; testo: string };

const nuovaRiga = (key: number): Riga => ({
  key,
  query: '',
  medId: null,
  scatole: '',
  piano: '',
  errore: null,
});

const normalizza = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const etichetta = (m: Medication) => {
  const dos = m.dosage && m.dosage !== '—' ? ' ' + m.dosage : '';
  return m.active_ingredient + dos;
};

const commerciale = (m: Medication) =>
  m.commercial_name && m.commercial_name !== '—' ? m.commercial_name : '';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500';

export default function PrelievoPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nome, setNome] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [righe, setRighe] = useState<Riga[]>([nuovaRiga(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState<Messaggio | null>(null);
  const [apertaKey, setApertaKey] = useState<number | null>(null);

  const carica = useCallback(async () => {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('active_ingredient', { ascending: true });
    if (error) {
      setLoadError('Errore nel caricamento dei farmaci: ' + error.message);
      return;
    }
    setLoadError(null);
    setMeds(((data as Medication[]) ?? []).filter((m) => !m.hidden));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carica();
      setLoading(false);
    })();
  }, [carica]);

  const medById = useMemo(() => {
    const map = new Map<string, Medication>();
    meds.forEach((m) => map.set(m.id, m));
    return map;
  }, [meds]);

  const suggerimenti = (query: string): Medication[] => {
    const q = normalizza(query).trim();
    if (q.length < 2) return [];
    const parole = q.split(/\s+/).filter(Boolean);
    return meds
      .filter((m) => {
        const testo = normalizza(
          `${m.active_ingredient} ${m.dosage || ''} ${m.commercial_name || ''}`
        );
        return parole.every((p) => testo.includes(p));
      })
      .slice(0, 8);
  };

  const aggiorna = (key: number, patch: Partial<Riga>) => {
    setRighe((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch, errore: null } : r))
    );
  };

  const aggiungiRiga = () => {
    setRighe((prev) => [...prev, nuovaRiga(nextKey)]);
    setNextKey((k) => k + 1);
  };

  const togliRiga = (key: number) => {
    setRighe((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const salva = async () => {
    setMessaggio(null);
    const nomePulito = nome.trim();
    if (!nomePulito) {
      setMessaggio({ tipo: 'errore', testo: 'Scrivi il tuo nome in alto.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    let tuttoOk = true;
    const controllate = righe.map((r) => {
      let errore: string | null = null;
      if (!r.medId) errore = 'Scegli il farmaco dall\'elenco.';
      else if (!/^\d+$/.test(r.scatole.trim()) || parseInt(r.scatole, 10) < 1)
        errore = 'Scrivi quante scatole (almeno 1).';
      else if (!r.piano) errore = 'Scegli il piano.';
      if (errore) tuttoOk = false;
      return { ...r, errore };
    });

    if (!tuttoOk) {
      setRighe(controllate);
      setMessaggio({ tipo: 'errore', testo: 'Controlla le righe in rosso.' });
      return;
    }

    try {
      localStorage.setItem(NAME_KEY, nomePulito);
    } catch {
      // niente: il nome non verrà ricordato
    }

    setSaving(true);
    const nonSalvate: Riga[] = [];
    let salvate = 0;

    for (const r of righe) {
      const m = r.medId ? medById.get(r.medId) : undefined;
      const { error } = await supabase.rpc('prelievo_scatole', {
        p_collega: nomePulito,
        p_medication_id: r.medId,
        p_farmaco: m ? etichetta(m) : r.query,
        p_piano: r.piano,
        p_scatole: parseInt(r.scatole, 10),
      });
      if (error) nonSalvate.push({ ...r, errore: error.message });
      else salvate++;
    }

    await carica();
    setSaving(false);

    if (nonSalvate.length === 0) {
      setRighe([nuovaRiga(nextKey)]);
      setNextKey((k) => k + 1);
      setMessaggio({
        tipo: 'ok',
        testo: `Prelievo salvato (${salvate} ${salvate === 1 ? 'riga' : 'righe'}).`,
      });
    } else {
      setRighe(nonSalvate);
      setMessaggio({
        tipo: 'errore',
        testo:
          salvate > 0
            ? `${salvate} righe salvate. Le righe in rosso NON sono state salvate.`
            : 'Nessuna riga salvata. Controlla le righe in rosso.',
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-5">
        <h1 className="text-xl font-bold text-slate-900">Prelievo scatole</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scrivi il farmaco, le scatole e il piano da cui le hai prese.
        </p>

        {messaggio && (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              messaggio.tipo === 'ok'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {messaggio.testo}
          </div>
        )}

        {loadError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Il tuo nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome e cognome"
            autoComplete="name"
            className={inputClass}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-4">
              {righe.map((r, i) => {
                const lista = suggerimenti(r.query);
                const med = r.medId ? medById.get(r.medId) : undefined;
                const disponibili =
                  med && r.piano ? ((med as any)[QTY_PER_PIANO[r.piano]] ?? 0) : null;
                const mostraLista = apertaKey === r.key && !r.medId && r.query.trim().length >= 2;

                return (
                  <div
                    key={r.key}
                    className={`rounded-xl border bg-white p-3 shadow-sm ${
                      r.errore ? 'border-red-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Riga {i + 1}</span>
                      {righe.length > 1 && (
                        <button
                          type="button"
                          onClick={() => togliRiga(r.key)}
                          className="text-sm text-slate-500 underline"
                        >
                          Togli riga
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Farmaco
                      </label>
                      <input
                        type="text"
                        value={r.query}
                        onChange={(e) => {
                          aggiorna(r.key, { query: e.target.value, medId: null });
                          setApertaKey(r.key);
                        }}
                        onFocus={() => setApertaKey(r.key)}
                        placeholder="Scrivi il nome del farmaco"
                        autoComplete="off"
                        autoCorrect="off"
                        className={inputClass}
                      />
                      {med && commerciale(med) && (
                        <p className="mt-1 text-xs text-slate-500">{commerciale(med)}</p>
                      )}

                      {mostraLista && (
                        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {lista.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-slate-500">
                              Nessun farmaco trovato
                            </p>
                          ) : (
                            lista.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  aggiorna(r.key, { query: etichetta(m), medId: m.id });
                                  setApertaKey(null);
                                }}
                                className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-b-0 active:bg-slate-100"
                              >
                                <span className="block text-base text-slate-900">
                                  {etichetta(m)}
                                </span>
                                {commerciale(m) && (
                                  <span className="block text-xs text-slate-500">
                                    {commerciale(m)}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Scatole
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={r.scatole}
                          onChange={(e) =>
                            aggiorna(r.key, { scatole: e.target.value.replace(/\D/g, '') })
                          }
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Piano
                        </label>
                        <select
                          value={r.piano}
                          onChange={(e) => aggiorna(r.key, { piano: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Scegli</option>
                          {PIANI.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {disponibili !== null && (
                      <p className="mt-2 text-xs text-slate-500">
                        Scatole presenti in questo piano: {disponibili}
                      </p>
                    )}

                    {r.errore && <p className="mt-2 text-sm text-red-600">{r.errore}</p>}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={aggiungiRiga}
              className="mt-4 w-full rounded-xl border-2 border-dashed border-teal-500 px-4 py-3 text-base font-medium text-teal-700 active:bg-teal-50"
            >
              + Aggiungi riga
            </button>

            <button
              type="button"
              onClick={salva}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-4 text-base font-bold text-white shadow-sm active:bg-teal-700 disabled:opacity-60"
            >
              {saving ? 'Salvataggio...' : 'Salva prelievo'}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              Questa pagina può solo togliere scatole. Ogni prelievo viene registrato con il tuo
              nome, la data e l'ora.
            </p>
          </>
        )}
      </div>
    </div>
  );
}