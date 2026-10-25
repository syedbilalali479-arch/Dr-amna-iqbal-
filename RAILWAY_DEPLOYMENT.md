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
