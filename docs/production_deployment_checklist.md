# ChatClan Production Deployment Checklist

Use this checklist before deploying ChatClan to DirectAdmin or any production host.

## 1. Configure Environment

- Copy `.env.example` to `.env`.
- Set `APP_URL` to the final HTTPS domain.
- Generate `SESSION_SECRET` with at least 32 random characters.
- Generate `CREDENTIAL_ENCRYPTION_KEY` with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- Change `DEMO_ADMIN_PASSWORD` before importing seed data or first login.

## 2. Configure MariaDB

- Create the production MariaDB database and user.
- Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- Import `database/schema.sql`.
- Import `database/seed.sql` only when you want the bootstrap admin/demo records.
- Run `npm run db:verify` to confirm the configured database is reachable and all schema tables exist.
- Run `npm run db:backup` and complete a restore drill using `docs/backup_restore_runbook.md`.

## 3. Configure Vendors

- SMTP:
  - Set `MAIL_MODE=smtp`.
  - Set `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`.
  - Verify with `GET /api/integrations/email/verify` after login.
- Meta WhatsApp:
  - Set `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`, and `META_ACCESS_TOKEN`.
  - Set `META_SEND_MODE=live` only when ready to send real WhatsApp messages.
  - Set `META_TEMPLATE_MODE=live` only when ready to submit/sync real templates.
  - Configure Meta webhook URL: `https://your-domain.co.za/webhooks/meta`.
- PayFast:
  - Set `PAYFAST_ENV=live`.
  - Set `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, and `PAYFAST_PASSPHRASE`.
  - Set `PAYFAST_CONFIRM_SERVER=true`.
  - Configure ITN URL: `https://your-domain.co.za/webhooks/payfast/itn`.

## 4. Set Operational Limits

- Tune `DISPATCH_TENANT_PER_MINUTE` and `DISPATCH_PHONE_PER_MINUTE` against the approved Meta messaging tier.
- Set `WORKER_POLL_INTERVAL_MS` and `WORKER_BATCH_SIZE`.
- Set `INBOX_FIRST_RESPONSE_SLA_MINUTES`.
- Confirm `META_COST_*_ZAR_CENTS` values against the current Meta rate card before relying on cost reports.

## 5. Run Gates

```powershell
npm install
npm run ops:release-candidate
npm run ops:preflight
npm run db:verify
npm run db:backup
```

After the app and worker are running:

```powershell
$env:STARTUP_BASE_URL = "https://your-domain.co.za"
npm run ops:startup-check

$env:VENDOR_BASE_URL = "https://your-domain.co.za"
$env:VENDOR_EMAIL = "admin@example.co.za"
$env:VENDOR_PASSWORD = "your-password"
$env:VENDOR_CHECKS = "smtp,meta,payfast"
$env:VENDOR_REQUIRE_SMTP = "true"
$env:VENDOR_META_VERIFY_TOKEN = "your-meta-webhook-verify-token"
$env:VENDOR_REQUIRE_META_CONNECTED = "true"
$env:VENDOR_REQUIRE_PAYFAST_MODE = "live"
npm run ops:vendor-check

$env:SMOKE_BASE_URL = "https://your-domain.co.za"
$env:SMOKE_EMAIL = "admin@example.co.za"
$env:SMOKE_PASSWORD = "your-password"
npm run smoke:beta
```

Use `SMOKE_WRITE=true` only with a dedicated smoke-test tenant.

## 6. Start Processes

- Start the web app with `node src/server.js` through DirectAdmin Node.js app management.
- Start the worker with `node src/worker.js` through a second supervised process.
- Confirm `/health` and `/ready` return `ok=true`.
- Run `npm run ops:startup-check` with `STARTUP_BASE_URL` pointed at the deployed app.
- Run `npm run ops:vendor-check` with `VENDOR_CHECKS=smtp,meta,payfast`, `VENDOR_REQUIRE_SMTP=true`, `VENDOR_REQUIRE_META_CONNECTED=true`, and `VENDOR_REQUIRE_PAYFAST_MODE=live`.
- Use `VENDOR_PAYFAST_SIMULATE_ITN=true` only in local/sandbox environments where `PAYFAST_CONFIRM_SERVER=false`.
