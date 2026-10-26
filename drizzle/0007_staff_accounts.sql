CREATE TABLE staff_accounts (
 id TEXT PRIMARY KEY,
 clinic_id TEXT NOT NULL,
 username TEXT NOT NULL COLLATE NOCASE,
 display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'receptionist' CHECK(role='receptionist'),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 session_version INTEGER NOT NULL DEFAULT 1 CHECK(session_version>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(clinic_id,username)
);
