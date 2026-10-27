-- Add active_ingredient to medicines and lot_number to medicine_batches

ALTER TABLE medicines ADD COLUMN IF NOT EXISTS active_ingredient text;

ALTER TABLE medicine_batches ADD COLUMN IF NOT EXISTS lot_number text;