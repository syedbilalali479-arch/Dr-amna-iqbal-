# Railway deployment

The Railway Docker image runs the app on Node.js 24 / Next.js. The Cloudflare/Vinext local preview remains available through `npm run dev`.

- Project: `skinuvia-dr-aamina-iqbal`
- Service: `skinuvia`
- Public URL: `https://skinuvia-production.up.railway.app`
- Database: SQLite on the persistent volume mounted at `/data`; `DATABASE_PATH=/data/skinuvia.sqlite`.
- Health check: `/api/health` verifies database access and migrations.
- Sign-in: `/login`, using `ADMIN_USERNAME`, `ADMIN_PASSWORD` and a signed HttpOnly session cookie. `SESSION_SECRET` must be at least 32 characters. Deployment refuses to start without a persistent database path or configured credentials.

`npm run build:railway` builds the standalone Node application. The Docker runtime serves on `0.0.0.0:$PORT`. SQL migrations in `drizzle/` apply transactionally once and are tracked by filename/hash. D1-style `batch` calls use SQLite transactions, preserving stock, ledger and audit rollback behavior.

The Railway deployment starts with a fresh database. Local patient records, local preview databases, QA fixtures, environment files and admin credentials are excluded from Git and the Docker build context. Credentials are generated in the ignored `.env.railway.local` file and sent to Railway through stdin. Optional WhatsApp/Gemini provider credentials are not fabricated or enabled automatically.

This deployment uses one app instance and one attached SQLite volume. Keep the volume when redeploying; do not detach/delete it to reset a deployment. Database backups should be maintained through the Railway volume backup controls before production data changes.

## Doctor and reception accounts

The clinic uses one sign-in page. The existing environment-configured doctor account remains the Doctor / Admin account; its credentials and existing signed sessions continue to work.

Doctor / Admin can manage receptionist logins in **Settings → Staff access**: create an account, reset its password, or enable/disable access. Each receptionist gets a separate username and a password of at least 12 characters. Staff passwords are stored as salted scrypt hashes in the persistent database, never returned by APIs or written to audit logs. Staff actions are audited under their own account ID.

Receptionists start in Appointments. They can use daily operational modules but cannot access Overview, Analytics, Settings, AI Brain, or WhatsApp AI Inbox. The server excludes AI conversations, learning, state and administrative audit records from reception responses; management/AI mutations and staff-management endpoints return HTTP 403 for reception users. Operational patient and billing data remains shared.

Resetting a password or toggling account access increments its session version, immediately invalidating existing receptionist sessions, including after access is re-enabled. Staff session identity, role and version are signed in the existing HttpOnly cookie. The role is determined by the server, never by a role selector in the browser. Migration `0007_staff_accounts.sql` is additive and runs through the existing migration mechanism.
