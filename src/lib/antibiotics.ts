import type { Medication } from '@/lib/supabase';

const ANTIBIOTIC_KEYWORD = 'antibiotico';

const ANTIBIOTIC_ACTIVE_INGREDIENTS = [
  'amoxicillina',
  'clavulanico',
  'ampicillina',
  'ceftriaxone',
  'cefixima',
  'cefuroxima',
  'cefazolina',
  'ciprofloxacina',
  'levofloxacina',
  'moxifloxacina',
  'claritromicina',
  'azitromicina',
  'eritromicina',
  'gentamicina',
  'tobramicina',
  'piperacillina',
  'tazobactam',
  'meropenem',
  'vancomicina',
  'teicoplanina',
  'clindamicina',
  'metronidazolo',
  'fosfomicina',
  'cotrimossazolo',
  'rifaximina',
  'nitrofurantoina',
  'fidaxomicina',
  'linezolid',
];

const normalize = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function isAntibiotic(med: Pick<Medication, 'active_ingredient' | 'commercial_name' | 'item_type' | 'category' | 'dosage'>): boolean {
  const haystack = [
    med.active_ingredient,
    med.commercial_name,
    med.item_type,
    med.category,
    med.dosage,
  ].map(normalize).join(' | ');

  if (haystack.includes(ANTIBIOTIC_KEYWORD)) return true;
  return ANTIBIOTIC_ACTIVE_INGREDIENTS.some((term) => haystack.includes(term));
}
