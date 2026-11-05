import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Filter, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Prelievo = {
  id: number;
  created_at: string;
  collega: string;
  medication_id: string;
  farmaco: string | null;
  piano: string;
  scatole: number;
};

type MedInfo = {
  id: string;
  active_ingredient: string;
  dosage: string | null;
  item_type: string | null;
  commercial_name: string | null;
};

const PIANI = ['PT', '1', '2', '3', 'MC', 'PL'];

const ETICHETTE_FILTRO: Record<string, string> = {
  PT: 'Solo Piano Terra (PT)',
  '1': 'Solo Piano 1',
  '2': 'Solo Piano 2',
  '3': 'Solo Piano 3',
  MC: 'Magazzino Centrale (MC)',
  PL: 'Solo Palestra (PL)',
};

const normalizza = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const giorno = (iso: string): string =>
  new Date(iso)
    .toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();

const testoOTrattino = (v: string | null | undefined) =>
  v && v !== '—' && v.trim() !== '' ? v : '—';

export default function PrelieviTab() {
  const [righe, setRighe] = useState<Prelievo[]>([]);
  const [meds, setMeds] = useState<Map<string, MedInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroPiano, setFiltroPiano] = useState('all');

  const carica = useCallback(async () => {
    const [log, farmaci] = await Promise.all([
      supabase
        .from('prelievi_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('medications')
        .select('id, active_ingredient, dosage, item_type, commercial_name'),
    ]);

    if (log.error) {
      setErrore('Errore nel caricamento dei prelievi: ' + log.error.message);
      return;
    }
    setErrore(null);
    setRighe((log.data as Prelievo[]) ?? []);

    if (!farmaci.error) {
      const map = new Map<string, MedInfo>();
      ((farmaci.data as MedInfo[]) ?? []).forEach((m) => map.set(m.id, m));
      setMeds(map);
    }
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
    const parole = normalizza(search).split(/\s+/).filter(Boolean);
    return righe.filter((r) => {
      if (filtroPiano !== 'all' && r.piano !== filtroPiano) return false;
      if (parole.length === 0) return true;
      const m = meds.get(r.medication_id);
      const testo = normalizza(
        `${r.collega} ${r.farmaco || ''} ${r.piano} ${m?.active_ingredient || ''} ${
          m?.commercial_name || ''
        } ${m?.item_type || ''} ${m?.dosage || ''}`
      );
      return parole.every((p) => testo.includes(p));
    });
  }, [righe, meds, search, filtroPiano]);

  // MC compare solo se c'è almeno un prelievo da lì
  const pianiVisibili = useMemo(() => {
    const haMC = righe.some((r) => r.piano === 'MC');
    return PIANI.filter((p) => p !== 'MC' || haMC);
  }, [righe]);

  const colSpanCount = 4 + pianiVisibili.length + 2;

  return (
    <div className="space-y-4">
      <div className="sticky top-[105px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-y-2">
          <div className="relative flex-1 sm:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 pr-8 w-full text-xs"
              placeholder="Cerca per farmaco, collega, tipo, dosaggio..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                title="Pulisci ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-sm">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={filtroPiano}
              onChange={(e) => setFiltroPiano(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="all">Tutte le aree</option>
              {PIANI.filter((p) => pianiVisibili.includes(p)).map((p) => (
                <option key={p} value={p}>
                  {ETICHETTE_FILTRO[p]}
                </option>
              ))}
            </select>
          </div>

          <button onClick={aggiorna} className="btn-secondary whitespace-nowrap" title="Aggiorna">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Prelievi dei colleghi</h2>
        <span className="text-sm text-slate-500">
          {filtrate.length} {filtrate.length === 1 ? 'prelievo' : 'prelievi'}
          {righe.length >= 500 ? ' (ultimi 500)' : ''}
        </span>
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
        <div className="card p-12 text-center">
          <p className="text-sm text-slate-500">
            {righe.length === 0
              ? 'Nessun prelievo registrato.'
              : 'Nessun prelievo trovato per la selezione attuale.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-xs border-collapse table-auto min-w-[760px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-2 py-1.5 font-semibold text-slate-600 w-[170px]">
                    Principio Attivo
                  </th>
                  <th className="px-2 py-1.5 font-semibold text-slate-600 w-[75px]">Dosaggio</th>
                  <th className="px-2 py-1.5 font-semibold text-slate-600 w-[105px]">Tipo</th>
                  <th className="px-2 py-1.5 font-semibold text-slate-600 w-[110px]">
                    Nome Commerciale
                  </th>
                  {pianiVisibili.map((p) => (
                    <th
                      key={p}
                      className={`px-2 py-1.5 font-semibold text-center w-10 ${
                        filtroPiano === p ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {p}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 font-semibold text-slate-600 w-[110px]">Collega</th>
                  <th className="px-2 py-1.5 font-semibold text-slate-500 text-center w-[110px]">
                    <span className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> Data
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrate.map((r, index) => {
                  const m = meds.get(r.medication_id);
                  const sezione = giorno(r.created_at);
                  const sezionePrec = index > 0 ? giorno(filtrate[index - 1].created_at) : null;
                  const mostraFascia = sezione !== sezionePrec;

                  return (
                    <React.Fragment key={r.id}>
                      {mostraFascia && (
                        <tr className="bg-teal-700 text-white font-bold">
                          <td colSpan={colSpanCount} className="px-3 py-1.5 text-xs tracking-wider">
                            {sezione}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50">
                        <td className="px-2 py-1 font-medium text-slate-800">
                          {m?.active_ingredient || r.farmaco || '—'}
                        </td>
                        <td className="px-2 py-1 text-slate-700 whitespace-nowrap">
                          {testoOTrattino(m?.dosage)}
                        </td>
                        <td className="px-2 py-1 text-slate-700 whitespace-nowrap">
                          {testoOTrattino(m?.item_type)}
                        </td>
                        <td
                          className="px-2 py-1 text-slate-700 max-w-[110px] truncate"
                          title={m?.commercial_name || ''}
                        >
                          {testoOTrattino(m?.commercial_name)}
                        </td>
                        {pianiVisibili.map((p) => (
                          <td
                            key={p}
                            className={`px-2 py-1 text-center tabular-nums ${
                              filtroPiano === p ? 'bg-teal-50/60' : ''
                            }`}
                          >
                            {r.piano === p ? (
                              <span className="font-bold text-red-600">−{r.scatole}</span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-slate-700 whitespace-nowrap">{r.collega}</td>
                        <td className="px-2 py-1 text-center text-[10px] text-slate-600 whitespace-nowrap">
                          {formatDateTime(r.created_at)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}