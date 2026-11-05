import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Prelievo = {
  id: number;
  created_at: string;
  collega: string;
  farmaco: string | null;
  piano: string;
  scatole: number;
};

const PIANI = ['PT', '1', '2', '3', 'MC', 'PL'];

const normalizza = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const formatData = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function PrelieviTab() {
  const [righe, setRighe] = useState<Prelievo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');

  const [selezionati, setSelezionati] = useState<Set<number>>(new Set());
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [pin, setPin] = useState('');
  const [eliminando, setEliminando] = useState(false);

  const carica = useCallback(async () => {
    const { data, error } = await supabase
      .from('prelievi_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      setErrore('Errore nel caricamento dei prelievi: ' + error.message);
      return;
    }
    setErrore(null);
    setRighe((data as Prelievo[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carica();
      setLoading(false);
    })();
  }, [carica]);

  const aggiorna = async () => {
    setRefreshing(true);
    await carica();
    setRefreshing(false);
  };

  const filtrate = useMemo(() => {
    const parole = normalizza(cerca).split(/\s+/).filter(Boolean);
    if (parole.length === 0) return righe;
    return righe.filter((r) => {
      const testo = normalizza(`${r.collega} ${r.farmaco || ''} ${r.piano}`);
      return parole.every((p) => testo.includes(p));
    });
  }, [righe, cerca]);

  // MC compare solo se c'è almeno un prelievo da lì
  const pianiVisibili = useMemo(() => {
    const haMC = righe.some((r) => r.piano === 'MC');
    return PIANI.filter((p) => p !== 'MC' || haMC);
  }, [righe]);

  // si eliminano solo le righe scelte che si vedono in questo momento
  const idDaEliminare = useMemo(
    () => filtrate.filter((r) => selezionati.has(r.id)).map((r) => r.id),
    [filtrate, selezionati]
  );

  const tuttiScelti = filtrate.length > 0 && idDaEliminare.length === filtrate.length;

  const toggle = (id: number) => {
    setSelezionati((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTutti = () => {
    if (tuttiScelti) setSelezionati(new Set());
    else setSelezionati(new Set(filtrate.map((r) => r.id)));
  };

  const annullaSelezione = () => {
    setSelezionati(new Set());
    setConfermaAperta(false);
    setPin('');
  };

  const elimina = async () => {
    if (idDaEliminare.length === 0) return;
    if (!pin.trim()) {
      setErrore('Scrivi il PIN.');
      return;
    }
    setEliminando(true);
    setErrore(null);
    setOkMsg(null);
    const { data, error } = await supabase.rpc('elimina_prelievi', {
      p_ids: idDaEliminare,
      p_pin: pin.trim(),
    });
    setEliminando(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    annullaSelezione();
    setOkMsg(`Eliminati ${data ?? idDaEliminare.length} prelievi dal registro.`);
    await carica();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Prelievi dei colleghi</h2>
        <button
          onClick={aggiorna}
          className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-600"
          title="Aggiorna"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per collega, farmaco o piano"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {okMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {okMsg}
        </div>
      )}

      {errore && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errore}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        </div>
      ) : filtrate.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {righe.length === 0 ? 'Nessun prelievo registrato.' : 'Nessun prelievo trovato.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {filtrate.length} {filtrate.length === 1 ? 'prelievo' : 'prelievi'}
            {righe.length >= 500 ? ' (mostrati gli ultimi 500)' : ''}
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[660px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="w-8 px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={tuttiScelti}
                      onChange={toggleTutti}
                      className="cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-200"
                      title="Seleziona tutti quelli che vedi"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">Farmaco</th>
                  {pianiVisibili.map((p) => (
                    <th key={p} className="w-12 px-2 py-2.5 text-center">
                      {p}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left">Collega</th>
                  <th className="px-3 py-2.5 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtrate.map((r) => {
                  const scelto = selezionati.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 last:border-b-0 ${
                        scelto ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={scelto}
                          onChange={() => toggle(r.id)}
                          className="cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-200"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {r.farmaco || '—'}
                      </td>
                      {pianiVisibili.map((p) => (
                        <td key={p} className="px-2 py-2.5 text-center tabular-nums">
                          {r.piano === p ? (
                            <span className="font-bold text-red-600">−{r.scatole}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{r.collega}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                        {formatData(r.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {idDaEliminare.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white px-4 py-3 shadow-lg sm:mx-0 sm:rounded-xl sm:border">
          {!confermaAperta ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Scelti: <b>{idDaEliminare.length}</b>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={annullaSelezione}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Annulla
                </button>
                <button
                  onClick={() => setConfermaAperta(true)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Elimina selezionati
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">
                Stai per eliminare <b>{idDaEliminare.length}</b>{' '}
                {idDaEliminare.length === 1 ? 'prelievo' : 'prelievi'} dal registro.{' '}
                <b>Le scatole NON tornano nell'inventario</b>: si cancella solo la riga
                dell'elenco.
              </p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Scrivi il PIN"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setConfermaAperta(false);
                    setPin('');
                  }}
                  disabled={eliminando}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Indietro
                </button>
                <button
                  onClick={elimina}
                  disabled={eliminando || !pin.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {eliminando ? 'Elimino...' : 'Conferma eliminazione'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}