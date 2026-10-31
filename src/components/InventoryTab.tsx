import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Trash2, X, EyeOff, Eye, AlertTriangle, Camera, Download, Filter, Clock, ArrowUpRight, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, Printer, ShoppingCart, CheckCircle2, Lock, Unlock, ArrowRightLeft, Pill } from 'lucide-react';
import {
  totalQty,
  ITEM_TYPES,
  isBelowThreshold,
} from '@/lib/supabase';
import { exportMedicationsExcel } from '@/lib/excel';
import { isAntibiotic } from '@/lib/antibiotics';
import ScannerModal from '@/components/ScannerModal';
import ReceiveModal from '@/components/ReceiveModal';

const ADMIN_PIN = '1234'; // Puoi cambiare questo PIN quando vuoi

const PRONTUARIO_CATEGORIZZATO = [
  {
    section: "A: MEDICAZIONI SPECIFICHE",
    items: [
      "Benda Idrofila Mt 0,5 x Cm 10",
      "Bende Cotone X Ingessare (Germania)",
      "Bende Elastiche A Rete Per Medicazione",
      "Cotone Idrofilo 1 Kg",
      "Metalline Allevyn 10 X 10",
      "Telo Sterile Monouso 35X50"
    ]
  },
  {
    section: "B: MEDICAZIONI ASPECIFICHE",
    items: [
      "Cerotti di Carta",
      "Cerotti Premedicati 5x7 Cm",
      "Cerotto in Carta 9x2,5",
      "Compresse Garza Idrofila Sterile 18x40",
      "Compresse Garza Idrofila Sterile 36x40",
      "Eurofix Cerotto Estensibile Aerato Cm 10 X 10",
      "Eurofix Cerotto Estensibile Aerato Cm 10 X 15",
      "Garze Non Sterili 20 X 20 Kg",
      "Medicazione Adesiva Pronta 15 X 8",
      "Medicazione Adesiva Pronta 5 X 7",
      "Medicazione Adesiva Pronta Cerotti 10 X 8",
      "Rete Elastica Tubolare Calibro 5",
      "Rete Elastica Tubolare Calibro 4",
      "Rete Elastica Tubolare Calibro 3",
      "Otattina Germanica 10Cm"
    ]
  },
  {
    section: "C: PRESIDI UROLOGICI",
    items: [
      "Catetere Vescicale Foley Silicone N° 12 3V",
      "Catetere Vescicale Foley Silicone N° 14 3V",
      "Catetere Vescicale Foley Silicone N° 16 3V",
      "Catetere Vescicale Foley Silicone N° 18 3V",
      "Catetere Vescicale Foley Silicone N° 20 3V",
      "Sacca Gamba Urina",
      "Sacca Per Urine Monouso Graduata 130 Cm Con Rubinetto",
      "Supporto Sacca Per Urine (Plastica)",
      "Tappo Per Catetere"
    ]
  },
  {
    section: "D: PRESIDI SPECIALI",
    items: [
      "Bisturi Monouso Lama 10",
      "Bisturi Monouso Lama 11",
      "Bisturi Monouso Lama 15",
      "Cannula di Guedel 80",
      "Carta Per ECG AR 600 Fogli",
      "Carta Per ECG Rotolo (100 G)",
      "Elettrodi Monouso X ECG In Tessuto",
      "Elettrodi Monouso Per ECG REF F9060",
      "Filo Per Sutura Ago 2/0",
      "Filo Per Sutura Ago 3/0",
      "Filo Per Sutura Ago 4/0",
      "Fonendoscopio",
      "Frantumapillole",
      "Ghiaccio Istantaneo",
      "Termometro Digitale Ascellare",
      "Guanti Sterili Chirurgico 6,5",
      "Guanti Sterili Chirurgico 7,5",
      "Guanti Sterili Chirurgico 8,5",
      "Kit Monouso Per Aerosol",
      "Mascherina Chirurgica A 3 Strati",
      "Mascherina Chirurgica A Fazzoletto",
      "Mascherina Ossigeno",
      "Occhialini O2 T",
      "Ossido Di Zinco Da Kg 1",
      "Pinze X Togliere Punti Metallici (Plastica)",
      "Pulsiossimetro",
      "Scovolino Per Tracheocannula 8mm",
      "Sfigmomanometro",
      "Sonda Rettale",
      "Sondini Naso-Gastrici",
      "Taglia Pillole Grande Dimensione",
      "Termometro Da Frigorifero",
      "Termometro Elettronico Istantaneo",
      "Tubo Di Collegamento Per Aspiratore",
      "Vasellina Bianca 1 Kg",
      "Vassoi Inox 40X30 Cm"
    ]
  },
  {
    section: "D1: DISINFETTANTI",
    items: [
      "Acqua Ossigenata",
      "Alcool Etilico Denaturato Lt 1",
      "Amuchina Concentrata Al 3%",
      "Amuchina Gel Antisettico Mani Flacone Da 500 Ml",
      "Prontosan Soluzione 350 Ml",
      "Disinfettante Ambientale",
      "Disinfettante Ferite Spray 250 Ml",
      "Disinfettante Mani Per Lavandino 1 Lt",
      "Disinfettante Per Ferri",
      "Disinfettante Per Mani Senza Acqua",
      "Iodiopovidone 10% Soluzione Cutanea Fl 50 Ml"
    ]
  },
  {
    section: "D2: TRACHEOSTOMIA",
    items: [
      "Metalline Tracheo",
      "Reggi Cannula Tracheale",
      "Sonda X Aspirazione 3,3 Mm CH 16"
    ]
  },
  {
    section: "D3: DIABETE",
    items: [
      "Apparecchio X Curva Glicemica",
      "Glucometer Elit",
      "Lancetta Pungidito Universale Per Penna",
      "Insupen 0,30mm (G30)x8mm",
      "Penna Pungidito Universale (Diab)",
      "Strisce Reattive Per Curva Glicemica"
    ]
  },
  {
    section: "E: PRESIDI ENDOVENOSI",
    items: [
      "Aghi Vacutainer Farfalla 21 G",
      "Aghi A Farfalla 23 G",
      "Aghi A Farfalla 25 G",
      "Catetere Intravenoso 18 G",
      "Catetere Intravenoso 20 G",
      "Catetere Intravenoso 22 G",
      "Catetere Intravenoso 24 G",
      "Cestello Porta Flebo",
      "Deflussore Per Flebolisi",
      "Laccio Emostatico Tubolare",
      "Otturatore X Catetere Intravenoso G 18",
      "Otturatore X Catetere Intravenoso G 20",
      "Otturatore X Catetere Intravenoso G 22",
      "Otturatore X Catetere Intravenoso G 24",
      "Piantane X Flebo (Ruote)",
      "Regolatori Di Flusso Per Flebo",
      "Rubinetto Tre Vie X Con Prolunga Cm10",
      "Siringa Sterile Per Insulina 0,5 Ml Ago 30G",
      "Siringhe 2,5 Ml",
      "Siringhe 5 Ml",
      "Siringhe 10 Ml",
      "Siringhe 20 Ml",
      "Siringhe 60 Ml",
      "Steriblock Veno",
      "Vacumed Holder"
    ]
  },
  {
    section: "F: MEDICAZIONI SPECIALI",
    items: [
      "Bende Ossido Di Zinco",
      "Garza Iodoformica 1 Mt",
      "Garza Iodoformica Rotolo 5 Mt 7 Cm",
      "Garze Auricolare Iodoformica 1 Cm",
      "Garze Iodiopovidone",
      "Garze Sterile 10X10",
      "Idrogel Tubo 15 Gr",
      "Medicazione Alginato 10X10 Cm",
      "Medicazione Alginato Con Argento 10X10 Cm",
      "Medicazione Poliuretano 10X10 Cm",
      "Medicazione Poliuretano 20X20 Cm",
      "Selfadhesive Soft Cm 10X20 M",
      "Steril Stripes 19X72 Mm",
      "Steril Stripes 6X38 Mm",
      "Steril Stripes 6X75 Mm",
      "Medicazione Paraffina Garza",
      "Farmactive Spray Argento Flaconi"
    ]
  },
  {
    section: "G: PRESIDI ANTI DECUBITO",
    items: [
      "Cuscino Antidecubito (Fibra Cava A 3 Sezioni)",
      "Kit Materasso + Compressore Antidecubito Curativo",
      "Kit Materasso + Compressore Antidecubito Rombi",
      "Parasponde Imbottiti",
      "Talloniere In Fibra Cava (2 Fasce)"
    ]
  },
  {
    section: "H: MEZZI CONTENZIONE",
    items: [
      "Cinture Di Contenimento Per Il Letto Con Fibia",
      "Fascia Fermabraccia / Fermagambe",
      "Fascia Pettorale - Addominale Cotone",
      "Imbragatura Pelvica (Taglia Standard) Cotone",
      "Manopola Di Protezione Con Tessuto A Rete Superiore",
      "Manopola Di Protezione Totalmente Imbottita",
      "Pettorina",
      "Sollevatori Elettrici",
      "Sollevatori Manuali"
    ]
  },
  {
    section: "PRESIDI FUORI PRONTUARIO",
    items: [
      "Allevyn Sacrum Adesivo",
      "Bavaglino Impermeabile Cm 45X90",
      "Sfigmomanometro Digitale",
      "Cuscini Di Postura Ne 44",
      "Talloniere Allevyn",
      "Hydrogel Con Alginato Nu-Gel",
      "Acqua Distillata",
      "Forbici Per Benda Taglia Piccola",
      "Abbassalingua In Legno",
      "Bastoncino Di Spugna X Pulizia Cavo Orale",
      "Bottone Magnetico Segufix",
      "Chiave Magnetica Segufix",
      "Crema Base",
      "Clisma Lax 133Ml",
      "Set Prelievo",
      "Prolunga Per O2 Terapie",
      "Aghi Ipodermici Monouso 18G",
      "Flussimetri Ad Area Per Ossigeno Terapia Qmed",
      "Pinzetta Per Medicazioni"
    ]
  }
];

const FARMACI_SECTION_ORDER: { [key: string]: number } = {
  'COMPRESSE / CAPSULE': 1,
  'BUSTINE': 2,
  'GOCCE': 3,
  'CEROTTI': 4,
  'PUFF / INALATORI': 5,
  'COLLIRIO': 6,
  'FIALE / FLACONE / INIETTABILI': 7,
  'SCIROPPI': 8,
  'SUPPOSTE': 9,
  'CREME / POMATE': 10,
  'ALTRI FARMACI': 99
};

type Props = {
  title: string;
  medications: any[];
  category: 'farmaco' | 'presidio';
  onAdd: (med: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function EditableText({ value, onSave }: { value: string; onSave: (val: string) => void }) {
  const [val, setVal] = useState(value || '');
  useEffect(() => setVal(value || ''), [value]);
  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== value) onSave(val); }}
      className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 focus:bg-white rounded px-1 py-0.5 outline-none text-xs truncate"
    />
  );
}

function ProtectedEditableText({ value, onSave }: { value: string; onSave: (val: string) => void }) {
  const [val, setVal] = useState(value || '');
  const [isEditable, setIsEditable] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setVal(value || '');
  }, [value]);

  const handleCommit = () => {
    const trimmedNew = val.trim();
    const trimmedOld = (value || '').trim();
    if (trimmedNew !== trimmedOld && trimmedNew.length > 0) {
      onSave(trimmedNew);
    } else {
      setVal(value || '');
    }
    setIsEditable(false);
  };

  return (
    <div className="relative w-full max-w-[170px]">
      {!isEditable ? (
        <div
          onClick={() => setConfirming(true)}
          title={value || ''}
          className="w-full cursor-pointer px-1 py-0.5 text-xs truncate font-medium text-slate-800 hover:bg-slate-100 rounded"
        >
          {value || '—'}
        </div>
      ) : (
        <input
          type="text"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommit();
            } else if (e.key === 'Escape') {
              setVal(value || '');
              setIsEditable(false);
            }
          }}
          className="w-full bg-white border border-teal-500 rounded px-1 py-0.5 outline-none text-xs truncate font-medium text-slate-800 shadow-sm"
        />
      )}

      {confirming && (
        <div className="absolute left-0 -top-1 z-50 flex items-center gap-1.5 bg-amber-50 p-1.5 rounded-lg border-2 border-amber-400 shadow-2xl">
          <span className="text-[11px] text-amber-900 font-bold whitespace-nowrap">Confermi modifica?</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setConfirming(false);
              setIsEditable(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow"
          >
            Sì
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setVal(value || '');
              setConfirming(false);
            }}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

function EditableType({ value, onSave }: { value: string; onSave: (val: string) => void }) {
  return (
    <select
      value={value || 'Compresse'}
      onChange={(e) => onSave(e.target.value)}
      className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 focus:bg-white rounded px-1 py-0.5 outline-none text-xs cursor-pointer truncate"
    >
      {ITEM_TYPES.map((t: string) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

function EditableQty({ value, onSave }: { value: number; onSave: (val: number) => void }) {
  const [val, setVal] = useState(value?.toString() || '0');
  useEffect(() => setVal(value?.toString() || '0'), [value]);
  return (
    <input
      type="number"
      min="0"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num !== value) onSave(num);
        else setVal(value?.toString() || '0');
      }}
      className="w-10 text-center bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 focus:bg-white rounded px-0.5 py-0.5 outline-none text-xs tabular-nums font-semibold"
    />
  );
}

export default function InventoryTab({
  title,
  medications,
  category,
  onAdd,
  onDelete,
  onUpdate,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [ai, setAi] = useState('');
  const [dos, setDos] = useState('');
  const [type, setType] = useState<any>(
    category === 'presidio' ? 'Presidio' : 'Compresse'
  );
  const [cn, setCn] = useState('');
  const [packStr, setPackStr] = useState('1');
    const [addField, setAddField] = useState<string>(category === 'presidio' ? 'qty_mc' : 'qty_pt');
  const [addQtyStr, setAddQtyStr] = useState('0');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showAntibioticOnly, setShowAntibioticOnly] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [includeCommercialName, setIncludeCommercialName] = useState(true);
  const [includeType, setIncludeType] = useState(true);

  const [totSortOrder, setTotSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastChanges, setLastChanges] = useState<{ [key: string]: { diff: number; type: 'carico' | 'scarico' } }>({});

  // Stati per la sicurezza PIN
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const verifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleProtectedAction = (action: () => void) => {
    if (!isUnlocked) {
      setShowPinModal(true);
      return;
    }
    action();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fullList = useMemo(() => {
    const dbItems = medications.filter((m) => m.category === category);
    
    if (category !== 'presidio') {
      const mapped = dbItems.map((m) => {
        let t = (m.item_type || 'Compresse').trim().toLowerCase();
        let sectionName = 'ALTRI FARMACI';
        
        if (t === 'compresse' || t === 'capsule') {
          sectionName = 'COMPRESSE / CAPSULE';
        } else if (t === 'bustine') {
          sectionName = 'BUSTINE';
        } else if (t === 'gocce') {
          sectionName = 'GOCCE';
        } else if (t === 'cerotti') {
          sectionName = 'CEROTTI';
        } else if (t === 'puff' || t === 'inalatore' || t === 'spray') {
          sectionName = 'PUFF / INALATORI';
        } else if (t === 'collirio') {
          sectionName = 'COLLIRIO';
        } else if (t === 'fiale' || t === 'flacone' || t === 'iniettabile') {
          sectionName = 'FIALE / FLACONE / INIETTABILI';
        } else if (t === 'sciroppo' || t === 'sciroppi') {
          sectionName = 'SCIROPPI';
        } else if (t === 'supposte') {
          sectionName = 'SUPPOSTE';
        } else if (t === 'crema' || t === 'pomata' || t === 'unguento') {
          sectionName = 'CREME / POMATE';
        } else {
          sectionName = (m.item_type || 'ALTRI').toUpperCase();
        }

        return {
          ...m,
          section: sectionName,
        };
      });

      return mapped.sort((a, b) => {
        const orderA = FARMACI_SECTION_ORDER[a.section] || 50;
        const orderB = FARMACI_SECTION_ORDER[b.section] || 50;
        if (orderA !== orderB) return orderA - orderB;
        return a.active_ingredient.localeCompare(b.active_ingredient);
      });
    }

    const dbMap = new Map<string, any>();
    dbItems.forEach((item) => {
      dbMap.set(item.active_ingredient.trim().toLowerCase(), item);
    });

    const resultList: any[] = [];
    let pCounter = 0;

    PRONTUARIO_CATEGORIZZATO.forEach((catGroup) => {
      catGroup.items.forEach((pName) => {
        const key = pName.trim().toLowerCase();
        if (dbMap.has(key)) {
          const item = dbMap.get(key);
          resultList.push({
            ...item,
            section: catGroup.section,
          });
          dbMap.delete(key);
        } else {
          resultList.push({
            id: `prontuario-${pCounter++}`,
            active_ingredient: pName,
            dosage: '—',
            item_type: 'Presidio',
            commercial_name: '—',
            qty_mc: 0,
            qty_pt: 0,
            qty_1: 0,
            qty_2: 0,
            qty_3: 0,
            qty_pl: 0,
            category: 'presidio',
            pack_size: 1,
            section: catGroup.section,
            isProntuarioVirtual: true,
            updated_at: null,
          });
        }
      });
    });

    dbMap.forEach((item) => {
      resultList.push({
        ...item,
        section: item.section || "ALTRI PRESIDI",
      });
    });

    return resultList;
  }, [medications, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = fullList.filter((m) => {
      const matchesSearch = !q || (
        m.active_ingredient.toLowerCase().includes(q) ||
        (m.dosage && m.dosage.toLowerCase().includes(q)) ||
        (m.commercial_name && m.commercial_name.toLowerCase().includes(q)) ||
        (m.item_type && m.item_type.toLowerCase().includes(q)) ||
        (m.section && m.section.toLowerCase().includes(q))
      );

      if (m.hidden) {
        if (!showHidden && !q) return false;
        if (q && !matchesSearch) return false;
      } else {
        if (!matchesSearch) return false;
      }
      
      const isLow = isBelowThreshold(m);

      if (showLowOnly && !isLow) return false;
      if (showAntibioticOnly && !isAntibiotic(m)) return false;

      if (floorFilter === 'mc' && (m.qty_mc || 0) <= 0) return false;
      if (floorFilter === 'pt' && (m.qty_pt || 0) <= 0) return false;
      if (floorFilter === '1' && (m.qty_1 || 0) <= 0) return false;
      if (floorFilter === '2' && (m.qty_2 || 0) <= 0) return false;
      if (floorFilter === '3' && (m.qty_3 || 0) <= 0) return false;
      if (floorFilter === 'pl' && (m.qty_pl || 0) <= 0) return false;

      return true;
    });

    if (totSortOrder !== 'none') {
      result = [...result].sort((a, b) => {
        const totalA = totalQty(a);
        const totalB = totalQty(b);
        if (totSortOrder === 'asc') {
          return totalA - totalB;
        } else {
          return totalB - totalA;
        }
      });
    }

    return result;
  }, [fullList, search, showHidden, showLowOnly, showAntibioticOnly, floorFilter, totSortOrder]);

  const handleToggleTotSort = () => {
    setTotSortOrder((prev) => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const handleUpdateVirtualOrDb = async (med: any, updates: any) => {
    if (!isUnlocked) {
      setShowPinModal(true);
      return;
    }

    const nowIso = new Date().toISOString();
    const oldTot = totalQty(med);
    const newMedObj = { ...med, ...updates };
    const newTot = totalQty(newMedObj);
    const diff = newTot - oldTot;

    if (diff !== 0) {
      setLastChanges((prev) => ({
        ...prev,
        [med.id]: {
          diff,
          type: diff > 0 ? 'carico' : 'scarico',
        },
      }));
    }

    const finalUpdates = {
      ...updates,
      updated_at: nowIso,
    };

    if (med.isProntuarioVirtual) {
      await onAdd({
        active_ingredient: med.active_ingredient,
        dosage: med.dosage || '—',
        item_type: med.item_type || 'Presidio',
        commercial_name: med.commercial_name || '—',
        pack_size: 1,
        qty_mc: updates.qty_mc ?? med.qty_mc ?? 0,
        qty_pt: updates.qty_pt ?? med.qty_pt ?? 0,
        qty_1: updates.qty_1 ?? med.qty_1 ?? 0,
        qty_2: updates.qty_2 ?? med.qty_2 ?? 0,
        qty_3: updates.qty_3 ?? med.qty_3 ?? 0,
        qty_pl: updates.qty_pl ?? med.qty_pl ?? 0,
        category: 'presidio',
        ...finalUpdates,
      });
    } else {
      await onUpdate(med.id, finalUpdates);
    }
  };

  const allSelected = filtered.length > 0 && filtered.every((m) => selectedIds.includes(m.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((m) => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExportSelected = () => {
    const itemsToExport = fullList.filter((m) => selectedIds.includes(m.id));
    if (itemsToExport.length === 0) return;
    exportMedicationsExcel(itemsToExport, `${title}_Selezionati`, floorFilter, {
      includeCommercialName,
      includeType,
    });
  };

  const handleMarkSelectedOrdered = () => {
    handleProtectedAction(async () => {
      const toMark = fullList.filter(
        (m) => selectedIds.includes(m.id) && !m.isProntuarioVirtual && !m.is_ordered
      );
      if (toMark.length === 0) return;
      try {
        for (const m of toMark) {
          await onUpdate(m.id, { is_ordered: true, updated_at: new Date().toISOString() });
        }
        setSelectedIds([]);
      } catch (err) {
        console.error('Errore segna in ordine:', err);
      }
    });
  };

  const handleExportAllFiltered = () => {
    if (filtered.length === 0) return;
    const suffix = floorFilter === 'all' ? 'Completo' : `Filtro_${floorFilter.toUpperCase()}`;
    exportMedicationsExcel(filtered, `${title}_${suffix}`, floorFilter, {
      includeCommercialName,
      includeType,
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ai.trim()) return;

    const parsedPack = parseInt(packStr, 10);
    const finalPack = isNaN(parsedPack) || parsedPack < 1 ? 1 : parsedPack;
    const addQty = Math.max(0, parseInt(addQtyStr, 10) || 0);
    try {
      setSaving(true);
      await onAdd({
        active_ingredient: ai.trim(),
        dosage: dos.trim(),
        item_type: type,
        commercial_name: cn.trim(),
        pack_size: finalPack,
                qty_mc: addField === 'qty_mc' ? addQty : 0,
        qty_pt: addField === 'qty_pt' ? addQty : 0,
        qty_1: addField === 'qty_1' ? addQty : 0,
        qty_2: addField === 'qty_2' ? addQty : 0,
        qty_3: addField === 'qty_3' ? addQty : 0,
        qty_pl: addField === 'qty_pl' ? addQty : 0,
        category,
        updated_at: new Date().toISOString(),
      });
      setAi('');
      setDos('');
      setCn('');
      setPackStr('1');
            setAddQtyStr('0');
      setShowForm(false);
    } catch (err) {
      console.error('Errore:', err);
    } finally {
      setSaving(false);
    }
  };
  const handleReceive = async (med: any, qty: number, field: string, completeOrder: boolean, remaining?: { acc: number; non: number }) => {
    const updates: any = { [field]: (med[field] || 0) + qty };
        if (completeOrder) {       updates.is_ordered = false;       updates.ordered_acc = 0;       updates.ordered_non_acc = 0;     }
    await handleUpdateVirtualOrDb(med, updates);
  };
    // --- Trasferimento tra piani ---
  const [transferMed, setTransferMed] = useState<any | null>(null);
  const [trFrom, setTrFrom] = useState('qty_pt');
  const [trTo, setTrTo] = useState('qty_1');
  const [trQty, setTrQty] = useState('1');
  const [trError, setTrError] = useState('');

  const FLOORS = [
    ...(category === 'presidio' ? [{ key: 'qty_mc', label: 'Magazzino Centrale (MC)' }] : []),
    { key: 'qty_pt', label: 'Piano Terra (PT)' },
    { key: 'qty_1', label: 'Piano 1' },
    { key: 'qty_2', label: 'Piano 2' },
    { key: 'qty_3', label: 'Piano 3' },
  ];

  const transferLive = transferMed
    ? (medications.find((m) => m.id === transferMed.id) || transferMed)
    : null;

  const openTransfer = (med: any) => {
    const firstWithStock = FLOORS.find((f) => (med[f.key] || 0) > 0);
    const from = firstWithStock ? firstWithStock.key : FLOORS[0].key;
    const to = FLOORS.find((f) => f.key !== from)!.key;
    setTrFrom(from);
    setTrTo(to);
    setTrQty('1');
    setTrError('');
    setTransferMed(med);
  };

  const handleTransfer = async () => {
    if (!transferLive) return;
    const n = parseInt(trQty, 10);
    const available = transferLive[trFrom] || 0;
    const fromLabel = FLOORS.find((f) => f.key === trFrom)?.label || '';

    if (trFrom === trTo) { setTrError('Scegli due posti diversi.'); return; }
    if (isNaN(n) || n < 1) { setTrError('Scrivi una quantità di almeno 1.'); return; }
    if (n > available) { setTrError(`Su ${fromLabel} ci sono solo ${available} scatole.`); return; }

    try {
      setSaving(true);
      await onUpdate(transferLive.id, {
        [trFrom]: available - n,
        [trTo]: (transferLive[trTo] || 0) + n,
      });
      setTransferMed(null);
    } catch (err) {
      console.error('Errore trasferimento:', err);
      setTrError('Non riuscito. Riprova.');
    } finally {
      setSaving(false);
    }
  };
  const nameCol = category === 'farmaco' ? 'Principio Attivo' : 'Nome Presidio';

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-inventory-section, .printable-inventory-section * {
            visibility: visible;
          }
          .printable-inventory-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

     <div className="no-print sticky top-[105px] z-25 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200">
  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-y-2">
    <div className="relative flex-1 sm:min-w-[260px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        ref={searchInputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input pl-9 pr-8 w-full text-xs"
        placeholder="Cerca per nome, dosaggio, tipo... (Premi / per cercare)"
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
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="all">Tutte le aree</option>
              {category === 'presidio' && <option value="mc">Magazzino Centrale (MC)</option>}
              <option value="pt">Solo Piano Terra (PT)</option>
              <option value="1">Solo Piano 1</option>
              <option value="2">Solo Piano 2</option>
              <option value="3">Solo Piano 3</option>
              <option value="pl">Solo Palestra (PL)</option>
            </select>
          </div>
          <div className="hidden sm:block sm:basis-full h-0" />
          <button
            onClick={() => setScannerOpen(true)}
            className="btn-secondary whitespace-nowrap"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </button>
              <button
            onClick={() => setReceiveOpen(true)}
            className="btn-secondary whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Carico ordine</span>
          </button>
          <button
            onClick={() => setShowLowOnly((v) => !v)}
            className={`btn-secondary whitespace-nowrap ${
              showLowOnly ? 'bg-amber-50 border-amber-400 text-amber-700' : ''
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Sotto Soglia</span>
          </button>
          <button
            onClick={() => setShowAntibioticOnly((v) => !v)}
            className={`btn-secondary whitespace-nowrap ${
              showAntibioticOnly ? 'bg-sky-50 border-sky-300 text-sky-700' : ''
            }`}
            aria-pressed={showAntibioticOnly}
          >
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">Solo Antibiotici</span>
          </button>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`btn-secondary whitespace-nowrap ${
              showHidden ? 'bg-teal-50 border-teal-300 text-teal-700' : ''
            }`}
          >
            {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {showHidden ? 'Nascosti visibili' : 'Mostra nascosti'}
            </span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary whitespace-nowrap"
            title="Stampa la vista attuale o il controllo scorte"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Stampa</span>
          </button>

          {/* Pulsante Sblocca / Blocca Modifiche con PIN */}
          {!isUnlocked ? (
            <button
              onClick={() => { setPinInput(''); setPinError(false); setShowPinModal(true); }}
              className="btn-secondary whitespace-nowrap bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
              title="Clicca per inserire il PIN e abilitare le modifiche"
            >
              <Lock className="h-4 w-4 text-amber-600" />
              <span className="hidden sm:inline">Sblocca Modifiche</span>
            </button>
          ) : (
            <button
              onClick={() => setIsUnlocked(false)}
              className="btn-secondary whitespace-nowrap bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              title="Modifiche sbloccate. Clicca per bloccare di nuovo"
            >
              <Unlock className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Modifiche Attive (Blocca)</span>
            </button>
          )}

          <button
            onClick={() => handleProtectedAction(() => setShowForm(true))}
            className="btn-primary whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Aggiungi</span>
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-800">Opzioni Stampa Excel:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCommercialName}
              onChange={(e) => setIncludeCommercialName(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-200"
            />
            Includi Nome Commerciale
          </label>
          {category === 'farmaco' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeType}
                onChange={(e) => setIncludeType(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-200"
              />
              Includi Tipo
            </label>
          )}
        </div>
      </div>

      <div className="printable-inventory-section space-y-3">
        <div className="no-print flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {title} {floorFilter !== 'all' && <span className="text-teal-600 text-sm font-semibold">(Filtro: {floorFilter.toUpperCase()} - Esclusi zeri)</span>}
          </h2>
          <div className="flex items-center gap-3">
           {selectedIds.length > 0 && (
              <button
                onClick={handleMarkSelectedOrdered}
                className="btn-secondary text-xs py-1.5 px-3"
                title="Segna come IN ORDINE tutte le voci selezionate"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Segna In Ordine ({selectedIds.length})
              </button>
            )}
            {selectedIds.length > 0 ? (
              <button onClick={handleExportSelected} className="btn-primary text-xs py-1.5 px-3">
                <Download className="h-3.5 w-3.5" />
                Esporta selezionati ({selectedIds.length})
              </button>
            ) : (
              <button onClick={handleExportAllFiltered} className="btn-secondary text-xs py-1.5 px-3">
                <Download className="h-3.5 w-3.5" />
                {floorFilter === 'all' ? 'Esporta tutti in Excel' : `Esporta ${floorFilter.toUpperCase()} (Personalizzato)`}
              </button>
            )}
            <span className="text-sm text-slate-500">{filtered.length} voci</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-slate-500">Nessuna voce trovata per la selezione attuale.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="w-full text-xs border-collapse table-auto">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="no-print w-8 px-1.5 py-1.5 text-center bg-slate-50">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                        title="Seleziona tutti"
                      />
                    </th>
                    <th className="px-2 py-1.5 font-semibold text-slate-600 w-[170px]">{nameCol}</th>
                    
                    {category === 'farmaco' ? (
                      <>
                        <th className="px-2 py-1.5 font-semibold text-slate-600 w-[75px]">Dosaggio</th>
                        <th className="px-2 py-1.5 font-semibold text-slate-600 w-[105px]">Tipo</th>
                      </>
                    ) : (
                      <th className="px-2 py-1.5 font-semibold text-slate-600 text-center w-[90px]">Pezzi / Scatola</th>
                    )}

                    <th className="px-2 py-1.5 font-semibold text-slate-600 w-[110px]">Nome Commerciale</th>
                    
                    {category === 'presidio' && (
                      <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === 'mc' ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-100 text-slate-700'}`}>MC</th>
                    )}

                    <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === 'pt' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'}`}>PT</th>
                    <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === '1' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'}`}>1</th>
                    <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === '2' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'}`}>2</th>
                    <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === '3' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'}`}>3</th>
                    <th className={`px-2 py-1.5 font-semibold text-center w-10 ${floorFilter === 'pl' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600'}`}>PL</th>

                    <th
                      onClick={handleToggleTotSort}
                      className="px-2 py-1.5 font-semibold text-slate-700 text-center w-12 cursor-pointer hover:bg-slate-200 select-none transition-colors rounded"
                      title="Clicca per ordinare per totale (0->Max o Max->0)"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>TOT</span>
                        {totSortOrder === 'none' && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                        {totSortOrder === 'asc' && <ArrowUp className="h-3 w-3 text-teal-600 font-bold" />}
                        {totSortOrder === 'desc' && <ArrowDown className="h-3 w-3 text-teal-600 font-bold" />}
                      </div>
                    </th>

                    <th className="no-print px-2 py-1.5 font-semibold text-slate-500 text-center w-[110px]">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" /> Aggiornato
                      </span>
                    </th>
                    <th className="no-print px-2 py-1.5 font-semibold text-slate-600 text-center w-20">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((med, index) => {
                    const prevSection = index > 0 ? filtered[index - 1].section : null;
                    const showHeader = totSortOrder === 'none' && med.section && med.section !== prevSection;

                    const total = totalQty(med);
                    const isLow = isBelowThreshold(med);
                    const isConfirming = deleteId === med.id;
                    const isChecked = selectedIds.includes(med.id);
                    const change = lastChanges[med.id];

                    const colSpanCount = category === 'presidio' ? 12 : 13;

                    return (
                      <React.Fragment key={med.id}>
                        {showHeader && (
                          <tr className="bg-teal-700 text-white font-bold">
                            <td colSpan={colSpanCount} className="px-3 py-1.5 text-xs tracking-wider">
                              {med.section}
                            </td>
                          </tr>
                        )}
                        <tr
                          className={`border-b border-slate-100 last:border-0 transition-colors relative ${
                            isChecked ? 'bg-teal-50/60' : med.hidden ? 'bg-slate-200/70 text-slate-500' : isLow ? 'bg-amber-100' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="no-print w-8 px-1.5 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectOne(med.id)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-200 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1 w-[170px] relative">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 overflow-visible">
                                <ProtectedEditableText
                                  value={med.active_ingredient}
                                  onSave={(v: string) => handleUpdateVirtualOrDb(med, { active_ingredient: v })}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleProtectedAction(() => handleUpdateVirtualOrDb(med, { is_ordered: !med.is_ordered }))}
                                className={`no-print p-0.5 rounded transition-colors ${
                                  med.is_ordered 
                                    ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold px-1 text-[9px] flex items-center gap-0.5' 
                                    : 'text-slate-300 hover:text-sky-600 hover:bg-sky-50'
                                }`}
                                title={med.is_ordered ? 'Segna come non ordinato' : 'Segna come IN ORDINE'}
                              >
                                <ShoppingCart className="h-3 w-3" />
                                {med.is_ordered && <span>In Ordine</span>}
                              </button>

                              {med.hidden && (
                                <span className="bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shadow-sm">
                                  Archiviato
                                </span>
                              )}
                            </div>
                          </td>

                          {category === 'farmaco' ? (
                            <>
                              <td className="px-2 py-1 w-[75px]">
                                <EditableText value={med.dosage} onSave={(v: string) => handleUpdateVirtualOrDb(med, { dosage: v })} />
                              </td>
                              <td className="px-2 py-1 w-[105px]">
                                <EditableType value={med.item_type} onSave={(v: string) => handleUpdateVirtualOrDb(med, { item_type: v })} />
                              </td>
                            </>
                          ) : (
                            <td className="px-2 py-1 text-center w-[90px]">
                              <EditableQty value={med.pack_size || 1} onSave={(v: number) => handleUpdateVirtualOrDb(med, { pack_size: v })} />
                            </td>
                          )}

                          <td className="px-2 py-1 w-[110px]">
                            <EditableText value={med.commercial_name} onSave={(v: string) => handleUpdateVirtualOrDb(med, { commercial_name: v })} />
                          </td>

                          {category === 'presidio' && (
                            <td className={`px-2 py-1 w-10 ${floorFilter === 'mc' ? 'bg-amber-50 font-bold' : 'bg-slate-50/50'}`}>
                              <EditableQty value={med.qty_mc || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_mc: v })} />
                            </td>
                          )}

                          <td className={`px-2 py-1 w-10 ${floorFilter === 'pt' ? 'bg-teal-50/60 font-bold' : ''}`}>
                            <EditableQty value={med.qty_pt || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_pt: v })} />
                          </td>
                          <td className={`px-2 py-1 w-10 ${floorFilter === '1' ? 'bg-teal-50/60 font-bold' : ''}`}>
                            <EditableQty value={med.qty_1 || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_1: v })} />
                          </td>
                          <td className={`px-2 py-1 w-10 ${floorFilter === '2' ? 'bg-teal-50/60 font-bold' : ''}`}>
                            <EditableQty value={med.qty_2 || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_2: v })} />
                          </td>
                          <td className={`px-2 py-1 w-10 ${floorFilter === '3' ? 'bg-teal-50/60 font-bold' : ''}`}>
                            <EditableQty value={med.qty_3 || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_3: v })} />
                          </td>
                          <td className={`px-2 py-1 w-10 ${floorFilter === 'pl' ? 'bg-teal-50/60 font-bold' : ''}`}>
                            <EditableQty value={med.qty_pl || 0} onSave={(v: number) => handleUpdateVirtualOrDb(med, { qty_pl: v })} />
                          </td>
                          <td className="px-2 py-1 text-center w-12 font-bold tabular-nums">
                            <span className={`px-1.5 py-0.5 rounded ${isLow ? 'bg-amber-200 text-amber-900 font-extrabold' : 'text-slate-700'}`}>
                              {total}
                            </span>
                          </td>
                          <td className="no-print px-2 py-1 text-center w-[110px] text-[10px] text-slate-600 whitespace-nowrap">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span>{formatDateTime(med.updated_at)}</span>
                              {change && (
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-extrabold text-[9px] ${
                                    change.type === 'carico'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {change.type === 'carico' ? (
                                    <>
                                      <ArrowUpRight className="h-3 w-3" /> +{change.diff}
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownRight className="h-3 w-3" /> {change.diff}
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="no-print px-2 py-1 text-center w-20 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {!med.isProntuarioVirtual && (
                                <>
                                                                  <button
                                  onClick={() => openTransfer(med)}
                                  className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-200 transition-colors"
                                  title="Trasferisci tra piani"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                                  <button
                                    onClick={() => handleProtectedAction(() => handleUpdateVirtualOrDb(med, { hidden: !med.hidden }))}
                                    className={`p-1 rounded transition-colors ${
                                      med.hidden ? 'text-teal-700 bg-teal-50 hover:bg-teal-100 font-bold' : 'text-slate-400 hover:bg-slate-200'
                                    }`}
                                    title={med.hidden ? 'Riattiva' : 'Nascondi'}
                                  >
                                    {med.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  </button>

                                  {isConfirming ? (
                                    <div className="absolute right-4 z-50 flex items-center gap-1 bg-red-50 p-1 rounded border border-red-200 shadow-lg">
                                      <span className="text-[10px] text-red-700 font-bold">Eliminare?</span>
                                      <button
                                        onClick={() => handleProtectedAction(() => {
                                          onDelete(med.id);
                                          setDeleteId(null);
                                        })}
                                        className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold"
                                      >
                                        Sì
                                      </button>
                                      <button
                                        onClick={() => setDeleteId(null)}
                                        className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleProtectedAction(() => setDeleteId(med.id))}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Elimina"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
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

      {showForm && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Aggiungi {category === 'farmaco' ? 'Nuovo Farmaco' : 'Nuovo Presidio'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {category === 'farmaco' ? 'Principio Attivo *' : 'Nome Presidio *'}
                </label>
                <input
                  type="text"
                  value={ai}
                  onChange={(e) => setAi(e.target.value)}
                  className="input text-xs"
                  placeholder={category === 'farmaco' ? 'Es. Paracetamolo' : 'Es. Benda elastica'}
                  required
                />
              </div>

              {category === 'farmaco' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dosaggio</label>
                    <input
                      type="text"
                      value={dos}
                      onChange={(e) => setDos(e.target.value)}
                      className="input text-xs"
                      placeholder="Es. 1000mg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo / Forma</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="input text-xs cursor-pointer"
                    >
                      {ITEM_TYPES.map((t: string) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pezzi per Scatola</label>
                  <input
                    type="number"
                    min="1"
                    value={packStr}
                    onChange={(e) => setPackStr(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Commerciale</label>
                <input
                  type="text"
                  value={cn}
                  onChange={(e) => setCn(e.target.value)}
                  className="input text-xs"
                  placeholder="Es. Tachipirina"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Piano / Area</label>
                  <select
                    value={addField}
                    onChange={(e) => setAddField(e.target.value)}
                    className="input text-xs cursor-pointer"
                  >
                    {category === 'presidio' && <option value="qty_mc">Magazzino Centrale (MC)</option>}
                    <option value="qty_pt">Piano Terra (PT)</option>
                    <option value="qty_1">Piano 1</option>
                    <option value="qty_2">Piano 2</option>
                    <option value="qty_3">Piano 3</option>
                    <option value="qty_pl">Palestra (PL)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantità</label>
                  <input
                    type="number"
                    min="0"
                    value={addQtyStr}
                    onChange={(e) => setAddQtyStr(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving || !ai.trim()}
                  className="btn-primary text-xs"
                >
                  {saving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Inserimento PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 space-y-4 animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Inserisci PIN Sblocco</h3>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Per modificare le scorte o aggiungere elementi è richiesto il PIN amministratore. (PIN predefinito: <span className="font-bold text-slate-800">1234</span>)
            </p>

            <form onSubmit={verifyPin} className="space-y-3">
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                className="input text-center text-lg tracking-widest font-bold"
                placeholder="••••"
                autoFocus
              />

              {pinError && (
                <p className="text-[11px] text-red-600 font-semibold text-center">PIN errato. Riprova.</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="btn-secondary text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  Sblocca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {transferLive && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Trasferisci tra piani</h3>
              <button
                onClick={() => setTransferMed(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-800">
              {transferLive.active_ingredient}{' '}
              {transferLive.dosage && transferLive.dosage !== '—' ? transferLive.dosage : ''}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Da</label>
              <select
                value={trFrom}
                onChange={(e) => { setTrFrom(e.target.value); setTrError(''); }}
                className="input text-xs cursor-pointer"
              >
                {FLOORS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label} - {transferLive[f.key] || 0} scatole
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">A</label>
              <select
                value={trTo}
                onChange={(e) => { setTrTo(e.target.value); setTrError(''); }}
                className="input text-xs cursor-pointer"
              >
                {FLOORS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label} - {transferLive[f.key] || 0} scatole
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quante scatole</label>
              <input
                type="number"
                min="1"
                value={trQty}
                onChange={(e) => { setTrQty(e.target.value); setTrError(''); }}
                className="input text-xs"
              />
            </div>

            {trError && <p className="text-xs font-semibold text-red-600">{trError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTransferMed(null)} className="btn-secondary text-xs">
                Annulla
              </button>
              <button onClick={handleTransfer} disabled={saving} className="btn-primary text-xs">
                {saving ? 'Salvataggio...' : 'Trasferisci'}
              </button>
            </div>
          </div>
        </div>
      )}
            <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirm={(name, _qty, details) => {
          if (category === 'farmaco') {
            setCn(name);
            if (details?.activeIngredient) setAi(details.activeIngredient);
            if (details?.dosage) setDos(details.dosage.replace(/\s+/g, ''));
            if (details?.form) {
              const f = details.form.toLowerCase().slice(0, 5);
              const match = ITEM_TYPES.find((t: string) => t.toLowerCase().slice(0, 5) === f);
              if (match) setType(match);
            }
          } else {
            setAi(name);
          }
          setScannerOpen(false);
          setShowForm(true);
        }}
        mode="search"
                showActiveIngredient={category === 'farmaco'}
            />
      <ReceiveModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        medications={fullList}
        category={category}
        onReceive={handleReceive}
      />
    </div>
  );
}