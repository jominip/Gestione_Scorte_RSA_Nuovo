-- Add floor and cabinet columns to medicines

ALTER TABLE medicines ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS cabinet text;

CREATE INDEX IF NOT EXISTS idx_medicines_floor ON medicines (floor);
CREATE INDEX IF NOT EXISTS idx_medicines_cabinet ON medicines (cabinet);