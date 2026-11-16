/*
# Add order_qty column to medications

1. Modified Tables
- `medications`
  - New column `order_qty` (integer, NOT NULL, default 0): stores the
    "Scatole da ordinare" quantity entered for each presidio in the
    Ordini presidi tab. Kept across reloads. Default 0 so existing rows
    and new rows start with no pending order.
2. Security
- No policy changes. `medications` already has full anon/authenticated
  CRUD with `USING (true)` (single-tenant, no-auth app). The new column
  is covered by the existing UPDATE grant on all columns.
3. Notes
- Idempotent: uses DO block to add the column only if it does not exist.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'order_qty'
  ) THEN
    ALTER TABLE medications ADD COLUMN order_qty integer NOT NULL DEFAULT 0;
  END IF;
END $$;
