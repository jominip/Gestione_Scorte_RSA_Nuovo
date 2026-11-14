import { isAntibiotic } from '@/lib/antibiotics';

// Toglie accenti e maiuscole: "Soluzione Cutanea" -> "soluzione cutanea"
const norm = (s: string | null | undefined) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Ordine in cui compaiono i sotto-titoli in "Altre medicine"
export const ORDINE_CATEGORIE_SPECIALI = [
  'Antibiotici',
  'Creme / Pomate',
  'Gel',
  'Soluzioni cutanee / Medicazioni',
  'Polveri',
  'Garze',
  'Collutori',
  'Soluzioni vaginali',
];

// Collegamento tra item_type e sotto-titolo.
// Per togliere un tipo da "Altre medicine" basta cancellare la sua riga.
const MAPPA_TIPI: Record<string, string> = {
  'crema': 'Creme / Pomate',
  'pomata': 'Creme / Pomate',
  'gel': 'Gel',
  'soluzione cutanea': 'Soluzioni cutanee / Medicazioni',
  'polvere cutanea': 'Polveri',
  'polvere': 'Polveri',
  'garze': 'Garze',
  'collutorio': 'Collutori',
  'soluzione vaginale': 'Soluzioni vaginali',
};

// Restituisce il sotto-titolo, oppure null se la voce resta in "Farmaci".
// Gli antibiotici hanno la precedenza. Gli spray (puff) restano in Farmaci.
export function categoriaSpeciale(med: any): string | null {
  if (med.category !== 'farmaco') return null;
  if (isAntibiotic(med)) return 'Antibiotici';
  return MAPPA_TIPI[norm(med.item_type)] ?? null;
}