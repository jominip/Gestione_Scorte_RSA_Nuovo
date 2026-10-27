/*
# Add pack_size column to medications

1. Modified Tables
- `medications`: add `pack_size` (integer, not null, default 1) — numero di unita (compresse, bustine, ecc.) contenute in una scatola/confezione.
  Usato per convertire il fabbisogno mensile di singole unita in numero di scatole intere da ordinare.

2. Security
- Nessuna modifica alle policy esistenti.
*/

ALTER TABLE medications
ADD COLUMN IF NOT EXISTS pack_size integer NOT NULL DEFAULT 1;