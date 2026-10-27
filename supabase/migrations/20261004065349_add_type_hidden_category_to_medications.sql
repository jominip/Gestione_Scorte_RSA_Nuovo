/*
# Estende medications con tipo, categoria, nascosto

1. Modifiche a `medications`
- Aggiunge `item_type` (text, default 'Compresse'): tipo di formulazione
- Aggiunge `category` (text, default 'farmaco'): distingue farmaci da presidi
- Aggiunge `hidden` (boolean, default false): per nascondere righe usate raramente
2. Note
- I farmaci esistenti ricevono category='farmaco' e item_type='Compresse' di default
- I presidi avranno category='presidio'
*/

ALTER TABLE medications ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'Compresse';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'farmaco';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
