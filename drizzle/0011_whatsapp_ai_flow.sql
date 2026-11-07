-- WhatsApp AI receptionist flow: durable inbound queue, per-contact state and outbox.
CREATE TABLE IF NOT EXISTS whatsapp_inbound (
 id TEXT PRIMARY KEY,
 clinic_id TEXT NOT NULL,
 provider_message_id TEXT NOT NULL,
 contact_key TEXT NOT NULL,
 reply_to TEXT NOT NULL,
 push_name TEXT,
 kind TEXT NOT NULL DEFAULT 'text',
 text TEXT NOT NULL DEFAULT '',
 raw TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'RECEIVED',
 available_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_inbound_provider_unique ON whatsapp_inbound(clinic_id, provider_message_id);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_pending_idx ON whatsapp_inbound(clinic_id, status, available_at);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_contact_idx ON whatsapp_inbound(clinic_id, contact_key, status);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
 clinic_id TEXT NOT NULL,
 contact_key TEXT NOT NULL,
 reply_to TEXT NOT NULL,
 name TEXT,
 language TEXT NOT NULL DEFAULT 'ROMAN_URDU',
 draft TEXT NOT NULL DEFAULT '{}',
 human_controlled INTEGER NOT NULL DEFAULT 0,
 handover_at TEXT,
 handover_reason TEXT,
 last_message_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (clinic_id, contact_key)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
 id TEXT PRIMARY KEY,
 clinic_id TEXT NOT NULL,
 contact_key TEXT NOT NULL,
 direction TEXT NOT NULL,
 content TEXT NOT NULL,
 provider_message_id TEXT,
 status TEXT NOT NULL DEFAULT 'RECEIVED',
 intent TEXT,
 source TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT,
 error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_contact_idx ON whatsapp_messages(clinic_id, contact_key, created_at);
CREATE INDEX IF NOT EXISTS whatsapp_messages_outbox_idx ON whatsapp_messages(clinic_id, direction, status, next_attempt_at);

CREATE TABLE IF NOT EXISTS whatsapp_ai_usage (
 id TEXT PRIMARY KEY,
 clinic_id TEXT NOT NULL,
 operation TEXT NOT NULL,
 outcome TEXT NOT NULL,
 latency_ms INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS whatsapp_ai_usage_day_idx ON whatsapp_ai_usage(clinic_id, created_at);
