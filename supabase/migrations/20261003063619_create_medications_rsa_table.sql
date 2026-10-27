/*
# Create medications table for RSA inventory (single-tenant, no auth)

Tabella per la gestione scorte RSA con quantita per piano.

1. New Tables
- `medications`
  - `id` (uuid, primary key)
  - `active_ingredient` (text, not null) — Principio Attivo
  - `dosage` (text, not null) — Dosaggio (es. 500mg, 10mg/ml)
  - `commercial_name` (text, not null) — Nome Commerciale
  - `qty_pt` (integer, not null, default 0) — Quantita armadio Piano Terra
  - `qty_1` (integer, not null, default 0) — Quantita armadio Primo Piano
  - `qty_2` (integer, not null, default 0) — Quantita armadio Secondo Piano
  - `qty_3` (integer, not null, default 0) — Quantita armadio Terzo Piano
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- RLS enabled.
- Anon + authenticated can do full CRUD (single-tenant, shared data, no sign-in).
*/

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_ingredient text NOT NULL,
  dosage text NOT NULL DEFAULT '',
  commercial_name text NOT NULL,
  qty_pt integer NOT NULL DEFAULT 0,
  qty_1 integer NOT NULL DEFAULT 0,
  qty_2 integer NOT NULL DEFAULT 0,
  qty_3 integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_medications" ON medications;
CREATE POLICY "anon_select_medications"
ON medications FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medications" ON medications;
CREATE POLICY "anon_insert_medications"
ON medications FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_medications" ON medications;
CREATE POLICY "anon_update_medications"
ON medications FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medications" ON medications;
CREATE POLICY "anon_delete_medications"
ON medications FOR DELETE
TO anon, authenticated USING (true);