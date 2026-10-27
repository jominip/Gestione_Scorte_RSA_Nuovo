/*
# Creazione tabella medicine_batches per lotti con scadenza mese/anno

1. Nuove Tabelle
- `medicine_batches`
  - `id` (uuid, chiave primaria)
  - `medicine_id` (uuid, foreign key verso medicines, cascade delete)
  - `quantity` (integer, quantita in questo lotto - default 0)
  - `expiry_month` (integer 1-12, mese di scadenza - obbligatorio)
  - `expiry_year` (integer, anno di scadenza - obbligatorio)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

2. Sicurezza
- RLS abilitato su `medicine_batches`.
- Politiche CRUD per anon + authenticated (app senza login, dati condivisi).
*/

CREATE TABLE IF NOT EXISTS medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  expiry_month integer NOT NULL CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year integer NOT NULL CHECK (expiry_year >= 2000),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medicine_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_medicine_batches" ON medicine_batches;
CREATE POLICY "anon_select_medicine_batches" ON medicine_batches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medicine_batches" ON medicine_batches;
CREATE POLICY "anon_insert_medicine_batches" ON medicine_batches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_medicine_batches" ON medicine_batches;
CREATE POLICY "anon_update_medicine_batches" ON medicine_batches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medicine_batches" ON medicine_batches;
CREATE POLICY "anon_delete_medicine_batches" ON medicine_batches FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicine_batches_medicine_id ON medicine_batches (medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_batches_expiry ON medicine_batches (expiry_year, expiry_month);
