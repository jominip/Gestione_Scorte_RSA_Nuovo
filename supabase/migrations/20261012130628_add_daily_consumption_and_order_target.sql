/*
# Add daily consumption and order target to medications

## Changes
1. New columns on `medications`:
   - `daily_consumption` (numeric, NOT NULL, default 0.5) — average boxes consumed per day.
     Used to compute a per-medication safety threshold instead of the old fixed value of 5.
   - `order_target` (integer, NOT NULL, default 30) — target stock level in boxes when ordering.
     Replaces the old hardcoded ORDER_TARGET of 30 so each medication can have a custom target.
2. No security changes — RLS is already enabled and policies exist on `medications`.
3. Both columns are safe additions (ADD COLUMN IF NOT EXISTS) — no data is lost or modified.
*/

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS daily_consumption numeric NOT NULL DEFAULT 0.5;

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS order_target integer NOT NULL DEFAULT 30;
