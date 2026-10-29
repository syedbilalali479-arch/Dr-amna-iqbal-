ALTER TABLE medicines ADD COLUMN barcode TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS medicines_barcode_idx ON medicines(clinic_id, barcode);
