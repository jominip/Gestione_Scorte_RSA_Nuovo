/*
# Creazione tabella medicine_barcodes per codici multipli per farmaco

1. Nuove Tabelle
- `medicine_barcodes`
  - `id` (uuid, chiave primaria)
  - `medicine_id` (uuid, foreign key verso medicines, cascade delete)
  - `barcode` (text, codice a barre - univoco)
  - `created_at` (timestamp)

2. Sicurezza
- RLS abilitato su `medicine_barcodes`.
- Politiche CRUD per anon + authenticated (app senza login, dati condivisi).
*/

CREATE TABLE IF NOT EXISTS medicine_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  barcode text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medicine_barcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_medicine_barcodes" ON medicine_barcodes;
CREATE POLICY "anon_select_medicine_barcodes" ON medicine_barcodes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medicine_barcodes" ON medicine_barcodes;
CREATE POLICY "anon_insert_medicine_barcodes" ON medicine_barcodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medicine_barcodes" ON medicine_barcodes;
CREATE POLICY "anon_delete_medicine_barcodes" ON medicine_barcodes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicine_barcodes_barcode ON medicine_barcodes (barcode);
CREATE INDEX IF NOT EXISTS idx_medicine_barcodes_medicine_id ON medicine_barcodes (medicine_id);
