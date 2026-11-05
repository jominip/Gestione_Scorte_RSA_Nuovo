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
  const [cerca, setCerca] = useState('');

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
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
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
                {filtrate.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}