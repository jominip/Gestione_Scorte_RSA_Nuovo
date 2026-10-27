import { useCallback, useEffect, useState } from 'react';
import { Package, Warehouse, Bandage, ShoppingCart, RefreshCw } from 'lucide-react';
import { supabase, type Medication, type MedicationInsert, needsOrder } from '@/lib/supabase';
import InventoryTab from '@/components/InventoryTab';
import OrdiniTab from '@/components/OrdiniTab';

type Tab = 'farmacia' | 'presidi' | 'ordini';

export default function App() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('farmacia');
  const [refreshing, setRefreshing] = useState(false);

  const fetchMedications = useCallback(async () => {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('active_ingredient', { ascending: true });

    if (error) {
      setError('Errore nel caricamento dei dati: ' + error.message);
      return;
    }
    setMedications((data as Medication[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchMedications();
      setLoading(false);
    })();
  }, [fetchMedications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  const handleAdd = async (med: MedicationInsert) => {
    setError(null);

    const activeClean = med.active_ingredient.trim().toUpperCase();
    const dosageClean = (med.dosage || '').trim().toLowerCase();

    const esisteGia = medications.find(m => 
      m.category === med.category &&
      m.active_ingredient.trim().toUpperCase() === activeClean &&
      (m.dosage || '').trim().toLowerCase() === dosageClean
    );

    if (esisteGia) {
      if (esisteGia.hidden) {
        setError(`ATTENZIONE: "${med.active_ingredient.toUpperCase()} (${med.dosage || 'senza dosaggio'})" esiste già nel sistema ma è NASCOSTO. Riattivalo dalla lista.`);
      } else {
        setError(`BLOCCO: "${med.active_ingredient.toUpperCase()} (${med.dosage || 'senza dosaggio'})" è già presente in inventario.`);
      }
      return;
    }

    const cleanMed: any = {
      active_ingredient: med.active_ingredient,
      dosage: med.dosage || '—',
      item_type: med.item_type || 'Compresse',
      commercial_name: med.commercial_name || '—',
      pack_size: med.pack_size || 1,
      qty_pt: 0,
      qty_1: 0,
      qty_2: 0,
      qty_3: 0,
      category: med.category,
      hidden: false
    };

    const { data, error } = await supabase.from('medications').insert([cleanMed]).select();
    if (error) {
      console.error('Errore Supabase insert:', error);
      setError(`Errore durante l'aggiunta: ${error.message}`);
      return;
    }

    if (data && data[0]) {
      setMedications(prev => [data[0], ...prev]);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (error) {
      setError("Errore durante l'eliminazione: " + error.message);
      return;
    }
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const QTY_FIELDS = ['qty_pt', 'qty_1', 'qty_2', 'qty_3', 'qty_mc', 'qty_pl'];

  const handleUpdate = async (id: string, updates: Partial<Medication>) => {
    const cleanUpdates: any = { ...updates };
    delete cleanUpdates.daily_consumption;
    delete cleanUpdates.order_target;

    const updateKeys = Object.keys(cleanUpdates);
    const qtyKeysInUpdate = updateKeys.filter((k) => QTY_FIELDS.includes(k));
    const nonQtyKeys = updateKeys.filter((k) => !QTY_FIELDS.includes(k) && k !== 'updated_at');

    if (qtyKeysInUpdate.length > 0 && nonQtyKeys.length === 0) {
      const currentMed = medications.find((m) => m.id === id);
      if (currentMed) {
        const updatedFields: any = { updated_at: new Date().toISOString() };
        for (const field of qtyKeysInUpdate) {
          const oldValue = (currentMed as any)[field] || 0;
          const newValue = (cleanUpdates as any)[field];
          const delta = newValue - oldValue;
          if (delta !== 0) {
            const { data, error } = await supabase.rpc('adjust_qty', {
              p_id: id,
              p_field: field,
              p_delta: delta,
            });
            if (error) {
              setError("Errore durante l'aggiornamento: " + error.message);
              return;
            }
            updatedFields[field] = data;
          } else {
            updatedFields[field] = oldValue;
          }
        }
        setMedications((prev) =>
          prev.map((m) => (m.id === id ? { ...m, ...updatedFields } : m))
        );
        return;
      }
    }

    const { data, error } = await supabase
      .from('medications')
      .update(cleanUpdates)
      .eq('id', id)
      .select();

    if (error) {
      setError("Errore durante l'aggiornamento: " + error.message);
      return;
    }

    if (data && data[0]) {
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? data[0] : m))
      );
    } else {
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...cleanUpdates } : m))
      );
    }
  };

  const lowStockCount = medications.filter((m) => !m.hidden && needsOrder(m)).length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'farmacia', label: 'Armadio Farmacia', icon: <Warehouse className="h-4 w-4" /> },
    { id: 'presidi', label: 'Magazzino Presidi', icon: <Bandage className="h-4 w-4" /> },
    { id: 'ordini', label: 'Ordini', icon: <ShoppingCart className="h-4 w-4" />, badge: lowStockCount },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Gestione scorte</h1>
                <p className="text-xs text-slate-500">Le Residenze — Gestione condivisa</p>
              </div>
            </div>
            <button onClick={handleRefresh} className="btn-secondary !p-2.5" title="Aggiorna">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm">
              Chiudi
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {activeTab === 'farmacia' && (
              <InventoryTab
                title="Armadio Farmacia"
                medications={medications}
                category="farmaco"
                onAdd={handleAdd}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            )}
            {activeTab === 'presidi' && (
              <InventoryTab
                title="Magazzino Presidi"
                medications={medications}
                category="presidio"
                onAdd={handleAdd}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            )}
            {activeTab === 'ordini' && (
              <OrdiniTab 
                medications={medications} 
                onMedicationUpdated={fetchMedications} 
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}