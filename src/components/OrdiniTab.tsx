import React, { useState, useMemo } from 'react';
import { Search, Download, Eye, EyeOff, Pill, ShoppingCart } from 'lucide-react';
import { totalQty, supabase, Medication } from '@/lib/supabase';
import { exportOrderExcel } from '@/lib/excel';
import { isAntibiotic } from '@/lib/antibiotics';

type Props = {
  medications: Medication[];
  onMedicationUpdated?: () => void;
};

export default function OrdiniTab({ medications, onMedicationUpdated }: Props) {
  const [search, setSearch] = useState('');
  const [showOnlyToOrder, setShowOnlyToOrder] = useState(true);
  const [showAntibioticOnly, setShowAntibioticOnly] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
  // Stato locale blindato per preservare i numeri digitati senza reset improvvisi
  const [orderState, setOrderState] = useState<{
    [id: string]: {
      targAcc?: number;
      targNonAcc?: number;
      orderAcc?: number;
      orderNonAcc?: number;
      selectedAcc?: boolean;
      selectedNonAcc?: boolean;
      packSize?: number;
    };
  }>({});

  const processedItems = useMemo(() => {
    return medications.map((med) => {
      const g = totalQty(med);
      const state = orderState[med.id] || {};

      const targAcc = state.targAcc !== undefined ? state.targAcc : (med.targ_acc ?? 0);
      const targNonAcc = state.targNonAcc !== undefined ? state.targNonAcc : (med.targ_non_acc ?? 0);
      const packSize = state.packSize !== undefined ? state.packSize : (med.pack_size ?? 1);

      const suggestedAcc = Math.max(0, targAcc - g);
      const giacenzaResidua = Math.max(0, g - targAcc);
      const suggestedNonAcc = Math.max(0, targNonAcc - giacenzaResidua);

      const orderAcc = state.orderAcc !== undefined ? state.orderAcc : suggestedAcc;
      const orderNonAcc = state.orderNonAcc !== undefined ? state.orderNonAcc : suggestedNonAcc;

      const selectedAcc = state.selectedAcc !== undefined ? state.selectedAcc : orderAcc > 0;
      const selectedNonAcc = state.selectedNonAcc !== undefined ? state.selectedNonAcc : orderNonAcc > 0;

      return {
        ...med,
        giacenza: g,
        targAcc,
        targNonAcc,
        pack_size: packSize,
        orderAcc,
        orderNonAcc,
        selectedAcc,
        selectedNonAcc,
        needsOrder: orderAcc > 0 || orderNonAcc > 0,
      };
    });
  }, [medications, orderState]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    
    return processedItems.filter((item) => {
      if (item.hidden) return false;
      if (showAntibioticOnly && !isAntibiotic(item)) return false;

      if (q) {
        return (
          item.active_ingredient.toLowerCase().includes(q) ||
          (item.dosage && item.dosage.toLowerCase().includes(q)) ||
          (item.commercial_name && item.commercial_name.toLowerCase().includes(q))
        );
      }

      if (showOnlyToOrder && !item.needsOrder) return false;

      return true;
    });
  }, [processedItems, search, showOnlyToOrder, showAntibioticOnly]);

  const farmaciList = useMemo(() => filteredItems.filter((i) => i.category === 'farmaco'), [filteredItems]);
  const presidiList = useMemo(() => filteredItems.filter((i) => i.category === 'presidio'), [filteredItems]);

  const totalToOrderCount = useMemo(() => {
    return processedItems.filter((i) => !i.hidden && i.needsOrder).length;
  }, [processedItems]);

  // Stati selezione separati per Farmaci
  const allFarmaciAccSelected = farmaciList.length > 0 && farmaciList.every((i) => i.selectedAcc);
  const allFarmaciNonAccSelected = farmaciList.length > 0 && farmaciList.every((i) => i.selectedNonAcc);

  // Stato selezione per Presidi
  const allPresidiSelected = presidiList.length > 0 && presidiList.every((i) => i.selectedAcc);

  // Selezione "Tutti" riservata solo alla lista di appartenenza (Farmaci o Presidi)
  const handleToggleSelectGroup = (
    targetList: any[],
    field: 'selectedAcc' | 'selectedNonAcc',
    isCurrentlyAllSelected: boolean
  ) => {
    const targetValue = !isCurrentlyAllSelected;
    setOrderState((prev) => {
      const nextState = { ...prev };
      targetList.forEach((item) => {
        const curr = nextState[item.id] || {};
        nextState[item.id] = {
          ...curr,
          targAcc: curr.targAcc ?? item.targAcc,
          targNonAcc: curr.targNonAcc ?? item.targNonAcc,
          orderAcc: curr.orderAcc ?? item.orderAcc,
          orderNonAcc: curr.orderNonAcc ?? item.orderNonAcc,
          packSize: curr.packSize ?? item.pack_size,
          selectedAcc: field === 'selectedAcc' ? targetValue : (curr.selectedAcc ?? item.selectedAcc),
          selectedNonAcc: field === 'selectedNonAcc' ? targetValue : (curr.selectedNonAcc ?? item.selectedNonAcc),
        };
      });
      return nextState;
    });
  };

  const handleTargetLocalChange = (id: string, field: 'targAcc' | 'targNonAcc', value: number) => {
    const val = Math.max(0, value);
    setOrderState((prev) => {
      const curr = prev[id] || {};
      const item = processedItems.find((i) => i.id === id);
      return {
        ...prev,
        [id]: {
          ...curr,
          targAcc: field === 'targAcc' ? val : (curr.targAcc !== undefined ? curr.targAcc : (item?.targAcc ?? 0)),
          targNonAcc: field === 'targNonAcc' ? val : (curr.targNonAcc !== undefined ? curr.targNonAcc : (item?.targNonAcc ?? 0)),
        },
      };
    });
  };

  const handlePackSizeLocalChange = (id: string, value: number) => {
    const val = Math.max(1, value);
    setOrderState((prev) => {
      const curr = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...curr,
          packSize: val,
        },
      };
    });
  };

  const handlePackSizeSave = async (item: any, value: number) => {
    const val = Math.max(1, value);
    const itemId = item.id;

    setOrderState((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        packSize: val,
      }
    }));

    try {
      if (!itemId || String(itemId).startsWith('prontuario-')) {
        const { error } = await supabase
          .from('medications')
          .insert([{
            active_ingredient: item.active_ingredient,
            dosage: item.dosage || '—',
            item_type: item.item_type || 'Compresse',
            commercial_name: item.commercial_name || '—',
            pack_size: val,
            category: 'farmaco',
            targ_acc: item.targAcc || 0,
            targ_non_acc: item.targNonAcc || 0,
            qty_pt: 0,
            qty_1: 0,
            qty_2: 0,
            qty_3: 0,
            hidden: false
          }]);

        if (!error && onMedicationUpdated) {
          onMedicationUpdated();
        }
      } else {
        const { error } = await supabase
          .from('medications')
          .update({ pack_size: val })
          .eq('id', String(itemId));

        if (!error && onMedicationUpdated) {
          onMedicationUpdated();
        }
      }
    } catch (err) {
      console.error("Errore salvataggio pezzi/scatola:", err);
    }
  };

 const handleTargetSave = async (item: any, field: 'targAcc' | 'targNonAcc', value: number) => {
  const val = Math.max(0, value);
  const dbField = field === 'targAcc' ? 'targ_acc' : 'targ_non_acc';
  const itemId = item.id;

  setSaveError(null);

  setOrderState((prev) => ({
    ...prev,
    [itemId]: {
      ...(prev[itemId] || {}),
      [field]: val,
    },
  }));

  const undoLocal = () => {
    setOrderState((prev) => {
      const curr = { ...(prev[itemId] || {}) };
      delete curr[field];
      return { ...prev, [itemId]: curr };
    });
  };

  try {
    let dbError: any = null;

    if (!itemId || String(itemId).startsWith('prontuario-')) {
      const { error } = await supabase
        .from('medications')
        .insert([{
          active_ingredient: item.active_ingredient,
          dosage: item.dosage || '—',
          item_type: item.item_type || 'Compresse',
          commercial_name: item.commercial_name || '—',
          pack_size: item.pack_size || 1,
          category: item.category || 'presidio',
          targ_acc: field === 'targAcc' ? val : 0,
          targ_non_acc: field === 'targNonAcc' ? val : 0,
          qty_pt: 0,
          qty_1: 0,
          qty_2: 0,
          qty_3: 0,
          hidden: false
        }]);
      dbError = error;
    } else {
      const { error } = await supabase
        .from('medications')
        .update({ [dbField]: val })
        .eq('id', String(itemId));
      dbError = error;
    }

    if (dbError) {
      console.error('Errore salvataggio:', dbError);
      undoLocal();
      setSaveError(`Non salvato: ${item.active_ingredient}. ${dbError.message}`);
      return;
    }

    if (onMedicationUpdated) onMedicationUpdated();
  } catch (err) {
    console.error('Errore salvataggio:', err);
    undoLocal();
    setSaveError(`Non salvato: ${item.active_ingredient}. Controlla la connessione e riprova.`);
  }
};

  const handleOrderQtyChange = (id: string, field: 'orderAcc' | 'orderNonAcc', delta: number) => {
    setOrderState((prev) => {
      const curr = prev[id] || {};
      const item = processedItems.find((i) => i.id === id);
      const currentVal = field === 'orderAcc' ? (curr.orderAcc ?? item?.orderAcc ?? 0) : (curr.orderNonAcc ?? item?.orderNonAcc ?? 0);
      const newVal = Math.max(0, currentVal + delta);

      const otherField = field === 'orderAcc' ? 'selectedAcc' : 'selectedNonAcc';

      return {
        ...prev,
        [id]: {
          ...curr,
          targAcc: curr.targAcc ?? item?.targAcc ?? 0,
          targNonAcc: curr.targNonAcc ?? item?.targNonAcc ?? 0,
          orderAcc: field === 'orderAcc' ? newVal : (curr.orderAcc ?? item?.orderAcc ?? 0),
          orderNonAcc: field === 'orderNonAcc' ? newVal : (curr.orderNonAcc ?? item?.orderNonAcc ?? 0),
          [otherField]: newVal > 0,
        },
      };
    });
  };

  const handleToggleSelect = (id: string, field: 'selectedAcc' | 'selectedNonAcc') => {
    setOrderState((prev) => {
      const curr = prev[id] || {};
      const item = processedItems.find((i) => i.id === id);
      const isCurrentlySelected = field === 'selectedAcc' ? (curr.selectedAcc ?? item?.selectedAcc) : (curr.selectedNonAcc ?? item?.selectedNonAcc);
      
      return {
        ...prev,
        [id]: {
          ...curr,
          targAcc: curr.targAcc ?? item?.targAcc ?? 0,
          targNonAcc: curr.targNonAcc ?? item?.targNonAcc ?? 0,
          orderAcc: curr.orderAcc ?? item?.orderAcc ?? 0,
          orderNonAcc: curr.orderNonAcc ?? item?.orderNonAcc ?? 0,
          selectedAcc: field === 'selectedAcc' ? !isCurrentlySelected : (curr.selectedAcc ?? item?.selectedAcc ?? false),
          selectedNonAcc: field === 'selectedNonAcc' ? !isCurrentlySelected : (curr.selectedNonAcc ?? item?.selectedNonAcc ?? false),
        },
      };
    });
  };

  const handleExport = () => {
    exportOrderExcel(processedItems);
  };

  // Tabella Farmaci con Pezzi/Scatola modificabile
  const renderFarmaciTable = (items: any[]) => (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <span>💊 Farmaci</span>
        <span className="text-xs font-normal text-slate-500">({items.length})</span>
      </h3>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">Nessun farmaco presente.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-600">
                  <th className="px-3 py-2">Principio Attivo</th>
                  <th className="px-2 py-2">Dosaggio</th>
                  <th className="px-2 py-2">Nome Commerciale</th>
                  <th className="px-2 py-2 text-center">Giacenza</th>
                  <th className="px-2 py-2 text-center bg-teal-50/50 text-teal-800">targ. acc.</th>
                  <th className="px-2 py-2 text-center bg-slate-100 text-slate-800">targ. non acc</th>
                  <th className="px-2 py-2 text-center">Pezzi / Scatola</th>
                  <th className="px-2 py-2 text-center bg-teal-100/60 text-teal-900">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={allFarmaciAccSelected}
                        onChange={() => handleToggleSelectGroup(farmaciList, 'selectedAcc', allFarmaciAccSelected)}
                        className="rounded border-teal-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                      />
                      ordinare acc.
                    </label>
                  </th>
                  <th className="px-2 py-2 text-center bg-indigo-100/60 text-indigo-900">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={allFarmaciNonAccSelected}
                        onChange={() => handleToggleSelectGroup(farmaciList, 'selectedNonAcc', allFarmaciNonAccSelected)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-200 cursor-pointer"
                      />
                      ordinare non
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{item.active_ingredient}</td>
                    <td className="px-2 py-1.5 text-slate-600">{item.dosage || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{item.commercial_name || '—'}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-teal-700">{item.giacenza}</td>

                    <td className="px-2 py-1.5 text-center bg-teal-50/30">
                      <input
                        type="number"
                        min="0"
                        value={item.targAcc}
                        onChange={(e) => handleTargetLocalChange(item.id, 'targAcc', parseInt(e.target.value, 10) || 0)}
                        onBlur={(e) => handleTargetSave(item, 'targAcc', parseInt(e.target.value, 10) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-12 text-center border border-teal-300 rounded px-1 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      />
                    </td>

                    <td className="px-2 py-1.5 text-center bg-slate-50">
                      <input
                        type="number"
                        min="0"
                        value={item.targNonAcc}
                        onChange={(e) => handleTargetLocalChange(item.id, 'targNonAcc', parseInt(e.target.value, 10) || 0)}
                        onBlur={(e) => handleTargetSave(item, 'targNonAcc', parseInt(e.target.value, 10) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-12 text-center border border-slate-300 rounded px-1 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </td>

                    {/* Modifica richiesta: Pezzi/Scatola modificabile anche per i farmaci */}
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.pack_size}
                        onChange={(e) => handlePackSizeLocalChange(item.id, parseInt(e.target.value, 10) || 1)}
                        onBlur={(e) => handlePackSizeSave(item, parseInt(e.target.value, 10) || 1)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-16 text-center border border-slate-300 rounded px-1 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      />
                    </td>

                    <td className="px-2 py-1.5 bg-teal-50/40">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={item.selectedAcc}
                          onChange={() => handleToggleSelect(item.id, 'selectedAcc')}
                          className="rounded border-teal-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                        />
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderAcc', -1)}
                          className="w-5 h-5 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800">
                          {item.selectedAcc && item.orderAcc > 0 ? item.orderAcc : '—'}
                        </span>
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderAcc', 1)}
                          className="w-5 h-5 flex items-center justify-center bg-teal-200 hover:bg-teal-300 text-teal-900 rounded font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="px-2 py-1.5 bg-indigo-50/40">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={item.selectedNonAcc}
                          onChange={() => handleToggleSelect(item.id, 'selectedNonAcc')}
                          className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-200 cursor-pointer"
                        />
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderNonAcc', -1)}
                          className="w-5 h-5 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800">
                          {item.selectedNonAcc && item.orderNonAcc > 0 ? item.orderNonAcc : '—'}
                        </span>
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderNonAcc', 1)}
                          className="w-5 h-5 flex items-center justify-center bg-indigo-200 hover:bg-indigo-300 text-indigo-900 rounded font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // Tabella Presidi (Invariata)
  const renderPresidiTable = (items: any[]) => (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <span>🛡️ Presidi</span>
        <span className="text-xs font-normal text-slate-500">({items.length})</span>
      </h3>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">Nessun presidio presente.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-600">
                  <th className="px-3 py-2">Nome Presidio</th>
                  <th className="px-2 py-2 text-center">Pezzi per scatola</th>
                  <th className="px-2 py-2 text-center">Giacenza</th>
                  <th className="px-2 py-2 text-center bg-teal-100/60 text-teal-900">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={allPresidiSelected}
                        onChange={() => handleToggleSelectGroup(presidiList, 'selectedAcc', allPresidiSelected)}
                        className="rounded border-teal-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                      />
                      Scatole da ordinare
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{item.active_ingredient}</td>

                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.pack_size}
                        onChange={(e) => handlePackSizeLocalChange(item.id, parseInt(e.target.value, 10) || 1)}
                        onBlur={(e) => handlePackSizeSave(item, parseInt(e.target.value, 10) || 1)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-16 text-center border border-slate-300 rounded px-1 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      />
                    </td>

                    <td className="px-2 py-1.5 text-center font-bold text-teal-700">{item.giacenza}</td>

                    <td className="px-2 py-1.5 bg-teal-50/40">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={item.selectedAcc}
                          onChange={() => handleToggleSelect(item.id, 'selectedAcc')}
                          className="rounded border-teal-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                        />
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderAcc', -1)}
                          className="w-5 h-5 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800">
                          {item.selectedAcc && item.orderAcc > 0 ? item.orderAcc : '—'}
                        </span>
                        <button
                          onClick={() => handleOrderQtyChange(item.id, 'orderAcc', 1)}
                          className="w-5 h-5 flex items-center justify-center bg-teal-200 hover:bg-teal-300 text-teal-900 rounded font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lista Ordine Quindicinale</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca farmaco o presidio..."
              className="input pl-9 text-xs"
            />
          </div>
          <button
            onClick={() => setShowAntibioticOnly((v) => !v)}
            className={`btn-secondary text-xs !py-2 whitespace-nowrap ${showAntibioticOnly ? 'bg-sky-50 border-sky-300 text-sky-700' : ''}`}
            aria-pressed={showAntibioticOnly}
          >
            <Pill className="h-3.5 w-3.5" />
            Solo Antibiotici
          </button>
{saveError && (
  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
    <p className="text-sm text-red-700 flex-1">{saveError}</p>
    <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-sm">
      Chiudi
    </button>
  </div>
)}
          <button
            onClick={() => setShowOnlyToOrder((v) => !v)}
            className={`btn-secondary text-xs !py-2 ${showOnlyToOrder ? 'bg-teal-50 border-teal-300 text-teal-700' : ''}`}
          >
            {showOnlyToOrder ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showOnlyToOrder ? 'Mostra solo da ordinare' : 'Mostra tutti'}
          </button>

          <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1.5 rounded-lg text-xs">
            {totalToOrderCount} voci da ordinare
          </span>

          <button onClick={handleExport} className="btn-primary text-xs !py-2">
            <Download className="h-3.5 w-3.5" />
            Esporta Excel Selezionati
          </button>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <span>🔍</span> La barra di ricerca trova sempre qualsiasi articolo presente a sistema.
        </p>
        <p>✉️ L'ordine è pronto da inviare a: <strong>farmaci.leresidenze@leresidenze.it</strong></p>
      </div>

      {renderFarmaciTable(farmaciList)}
      {renderPresidiTable(presidiList)}
    </div>
  );
}