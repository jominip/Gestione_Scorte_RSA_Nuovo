import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://honqewofpwxiegbbvpap.supabase.co';
const supabaseAnonKey = 'sb_publishable_ef5DMQQQNAQLZiTLEumwaw_T23eBZLn';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ItemType =
  | 'Compresse'
  | 'Collirio'
  | 'Cerotti'
  | 'Puff'
  | 'Spray'
  | 'Sciroppo'
  | 'Gocce'
  | 'Bustine'
  | 'Polvere'
  | 'Fiale'
  | 'Penna'
  | 'Flacone'
  | 'Crema'
  | 'Gel'
  | 'Shampoo'
  | 'Collutorio'
  | 'Garze'
  | 'Supposte'
  | 'Presidio'
  | 'Altro';

export const ITEM_TYPES: ItemType[] = [
  'Compresse',
  'Collirio',
  'Cerotti',
  'Puff',
  'Spray',
  'Sciroppo',
  'Gocce',
  'Bustine',
  'Polvere',
  'Fiale',
  'Penna',
  'Flacone',
  'Crema',
  'Gel',
  'Shampoo',
  'Collutorio',
  'Garze',
  'Supposte',
  'Presidio',
  'Altro',
];

export type Medication = {
  id: string;
  active_ingredient: string;
  dosage: string;
  item_type: string;
  commercial_name: string;
  pack_size: number;
  qty_mc?: number;
  qty_pt: number;
  qty_1: number;
  qty_2: number;
  qty_3: number;
  qty_pl: number;         // <-- Aggiunto
  category: string;
  hidden: boolean;
  targ_acc?: number;      // <-- Accreditato
  targ_non_acc?: number;  // <-- Non accreditato
  created_at: string;
  updated_at?: string;    // <-- Ultimo aggiornamento
};

export type MedicationInsert = {
  active_ingredient: string;
  dosage?: string;
  item_type?: string;
  commercial_name?: string;
  pack_size?: number;
  qty_mc?: number;
  qty_pt?: number;
  qty_1?: number;
  qty_2?: number;
  qty_3?: number;
  qty_pl?: number;        // <-- Aggiunto
  category?: string;
  hidden?: boolean;
  targ_acc?: number;      // <-- Accreditato
  targ_non_acc?: number;  // <-- Non accreditato
  updated_at?: string;
};

export type MedicationUpdate = {
  active_ingredient?: string;
  dosage?: string;
  item_type?: string;
  commercial_name?: string;
  pack_size?: number;
  qty_mc?: number;
  qty_pt?: number;
  qty_1?: number;
  qty_2?: number;
  qty_3?: number;
  qty_pl?: number;        // <-- Aggiunto
  hidden?: boolean;
  targ_acc?: number;      // <-- Accreditato
  targ_non_acc?: number;  // <-- Non accreditato
  updated_at?: string;
};

export function totalQty(m: Pick<Medication, 'qty_mc' | 'qty_pt' | 'qty_1' | 'qty_2' | 'qty_3' | 'qty_pl'>): number {
  return (m.qty_mc || 0) + (m.qty_pt || 0) + (m.qty_1 || 0) + (m.qty_2 || 0) + (m.qty_3 || 0) + (m.qty_pl || 0);
}

export function safetyThreshold(_m: any): number {
  return 1;
}

export function targetSum(m: any): number {
  return (m.targ_acc || 0) + (m.targ_non_acc || 0);
}

// Da ordinare = giacenza sotto la somma dei target (stessa regola della lista Ordini)
export function needsOrder(m: any): boolean {
  const sum = targetSum(m);
  return sum > 0 && totalQty(m) < sum;
}

// Sotto soglia (giallo): con target come Ordini, senza target 2 scatole o meno
export function isBelowThreshold(m: any): boolean {
  const sum = targetSum(m);
  if (sum > 0) return totalQty(m) < sum;
  return totalQty(m) <= 2;
}