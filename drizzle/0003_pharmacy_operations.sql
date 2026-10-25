CREATE TABLE commerce_documents (
 id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL, kind TEXT NOT NULL,
 body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX commerce_clinic_kind ON commerce_documents(clinic_id,kind);
CREATE TABLE stock_movements (
 id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL, medicine_id TEXT NOT NULL,
 document_id TEXT NOT NULL, quantity INTEGER NOT NULL, reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE commerce_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
CREATE TRIGGER medicine_nonnegative_insert BEFORE INSERT ON medicines WHEN NEW.quantity < 0 BEGIN SELECT RAISE(ABORT, 'Insufficient medicine stock'); END;
CREATE TRIGGER medicine_nonnegative_update BEFORE UPDATE ON medicines WHEN NEW.quantity < 0 BEGIN SELECT RAISE(ABORT, 'Insufficient medicine stock'); END;
CREATE UNIQUE INDEX commerce_appointment_invoice ON commerce_documents(clinic_id,json_extract(body,'$.appointment_id')) WHERE kind='invoices' AND json_extract(body,'$.appointment_id') IS NOT NULL;
ALTER TABLE appointments ADD COLUMN parent_appointment_id TEXT;
