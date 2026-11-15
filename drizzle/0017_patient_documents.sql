-- Reports, prescriptions and photos patients send on WhatsApp, kept for the doctor.
CREATE TABLE IF NOT EXISTS patient_documents (
	id text PRIMARY KEY NOT NULL,
	clinic_id text NOT NULL,
	contact_key text NOT NULL,
	phone text NOT NULL DEFAULT '',
	patient_name text NOT NULL DEFAULT '',
	kind text NOT NULL DEFAULT 'document',
	mime_type text NOT NULL DEFAULT '',
	file_name text NOT NULL DEFAULT '',
	caption text NOT NULL DEFAULT '',
	size integer NOT NULL DEFAULT 0,
	data blob,
	status text NOT NULL DEFAULT 'New',
	error text,
	provider_message_id text,
	reviewed_at text,
	reviewed_by text,
	created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS patient_documents_message ON patient_documents(clinic_id,provider_message_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS patient_documents_recent ON patient_documents(clinic_id,created_at);
