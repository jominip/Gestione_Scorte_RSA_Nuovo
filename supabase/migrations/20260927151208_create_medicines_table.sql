/*
# Creazione tabella medicines (single-tenant, no auth)

1. Nuove Tabelle
- `medicines`
  - `id` (uuid, chiave primaria)
  - `name` (text, nome del farmaco - obbligatorio)
  - `quantity` (integer, quantità in scorta - default 0)
  - `expiry_date` (date, data di scadenza - opzionale)
  - `location` (text, luogo di conservazione - opzionale)
  - `notes` (text, note aggiuntive - opzionale)
  - `created_at` (timestamp, creazione record)
  - `updated_at` (timestamp, ultima modifica)

2. Sicurezza
- RLS abilitato su `medicines`.
- Politiche CRUD per anon + authenticated (app senza login, dati condivisi tra infermieri).
*/

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  expiry_date date,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_medicines" ON medicines;
CREATE POLICY "anon_select_medicines" ON medicines FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medicines" ON medicines;
CREATE POLICY "anon_insert_medicines" ON medicines FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_medicines" ON medicines;
CREATE POLICY "anon_update_medicines" ON medicines FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medicines" ON medicines;
CREATE POLICY "anon_delete_medicines" ON medicines FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicines_expiry_date ON medicines (expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines (name);
