import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Riga = {
  id: string;
  principio_attivo: string;
  dosaggio: string | null;
  tipo: string | null;
  nome_commerciale: string | null;
  quantita: number;
  updated_at: string;
};

export default function NonInUsoTab({ onBack }: { onBack: () => void }) {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [errore, setErrore] = useState('');
  const [cerca, setCerca] = useState('');
  const [mostraForm, setMostraForm] = useState(false);
  const [nuovo, setNuovo] = useState({
    principio_attivo: '',
    dosaggio: '',
    tipo: '',
    nome_commerciale: '',
    quantita: 0,
  });

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
      principio_attivo: nuovo.principio_attivo.trim().toUpperCase(),
      dosaggio: nuovo.dosaggio.trim() || null,
      tipo: nuovo.tipo.trim() || null,
      nome_commerciale: nuovo.nome_commerciale.trim().toUpperCase() || null,
      quantita: Number(nuovo.quantita) || 0,
    });
    if (error) {
      setErrore('Salvataggio NON riuscito: ' + error.message);
      return;
    }
    setNuovo({ principio_attivo: '', dosaggio: '', tipo: '', nome_commerciale: '', quantita: 0 });
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
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ', ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Tipo (es. Compresse)"
            value={nuovo.tipo}
            onChange={(e) => setNuovo({ ...nuovo, tipo: e.target.value })}
          />
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
              <th className="p-3">Aggiornato</th>
              <th className="p-3 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {visibili.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
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
                      onClick={() => cambiaQuantita(r, r.quantita + 1)}
                      className="w-7 h-7 rounded border border-gray-300"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="p-3 text-xs text-gray-500">{formatta(r.updated_at)}</td>
                <td className="p-3 text-center">
                  <button onClick={() => elimina(r)} className="text-gray-400 hover:text-red-600" title="Elimina">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}