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

const normalizza = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const formatData = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filtrate.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {r.farmaco || '—'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.collega} · {formatData(r.created_at)}
                  </p>
                </div>
                                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                    {/^\d$/.test(r.piano) ? `Piano ${r.piano}` : r.piano}
                  </span>
                  <span className="w-10 text-right text-sm font-bold text-red-600">
                    −{r.scatole}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}