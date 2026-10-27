/*
# Create simple_medicines table (single-tenant, no auth)

Sostituisce il vecchio schema complesso con una tabella minimalista.

1. New Tables
- `simple_medicines`
  - `id` (uuid, primary key)
  - `active_ingredient` (text, not null) — il Principio Attivo
  - `commercial_name` (text, not null) — il Nome Commerciale
  - `quantity` (integer, not null, default 1) — la quantita totale
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- RLS enabled.
- Anon + authenticated can do full CRUD (single-tenant, shared data, no sign-in).
*/

CREATE TABLE IF NOT EXISTS simple_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_ingredient text NOT NULL,
  commercial_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE simple_medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_simple_medicines" ON simple_medicines;
CREATE POLICY "anon_select_simple_medicines"
ON simple_medicines FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_simple_medicines" ON simple_medicines;
CREATE POLICY "anon_insert_simple_medicines"
ON simple_medicines FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_simple_medicines" ON simple_medicines;
CREATE POLICY "anon_update_simple_medicines"
ON simple_medicines FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_simple_medicines" ON simple_medicines;
CREATE POLICY "anon_delete_simple_medicines"
ON simple_medicines FOR DELETE
TO anon, authenticated USING (true);