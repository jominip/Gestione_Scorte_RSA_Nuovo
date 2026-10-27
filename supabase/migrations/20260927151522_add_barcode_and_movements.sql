/*
# Aggiunta barcode alla tabella medicines e creazione tabella movements

1. Modifiche a tabelle esistenti
- `medicines`: aggiunta colonna `barcode` (text, opzionale) per memorizzare il codice a barre del farmaco.

2. Nuove Tabelle
- `movements`
  - `id` (uuid, chiave primaria)
  - `medicine_id` (uuid, foreign key verso medicines, cascade delete)
  - `type` (text, 'in' per entrata, 'out' per uscita)
  - `quantity` (integer, quantità mossa)
  - `note` (text, opzionale)
  - `created_at` (timestamp)

3. Sicurezza
- RLS abilitato su `movements`.
- Politiche CRUD per anon + authenticated (app senza login, dati condivisi).
*/

ALTER TABLE medicines ADD COLUMN IF NOT EXISTS barcode text;

CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_movements" ON movements;
CREATE POLICY "anon_select_movements" ON movements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_movements" ON movements;
CREATE POLICY "anon_insert_movements" ON movements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_movements" ON movements;
CREATE POLICY "anon_delete_movements" ON movements FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_movements_medicine_id ON movements (medicine_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements (created_at DESC);
