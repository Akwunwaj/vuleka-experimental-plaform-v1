# ChatClan Agent Guide

This file is the working brief for anyone building ChatClan in this repository.

## Product

ChatClan is a production-grade WhatsApp SaaS platform for South African small businesses. It is built on Meta WhatsApp Cloud API and is intended for Host Africa hosting with DirectAdmin Node.js application support and MariaDB.

The supplied HTML files are design and product blueprints, not throwaway references:

- `html_interface/wazify_saas_platform.html`: primary marketing/app UI blueprint.
- `html_interface/wazify_billing.html`: billing, payment-provider, and dashboard design reference.
- `html_interface/whatsapp_cloud_api_chatbot.html`: Meta Cloud API payload and chatbot reference.
- `html_interface/whatsapp_chatbot_flow.html`: industry chatbot simulator reference.
- `html_interface/whatsapp_chatbot_flow_diagram.html`: flow hierarchy reference.
- `context/claude_text.md`: product scope and feature roadmap.
- `docs/design/chatclan-design-system.md`: authoritative design system for ChatClan.
- `docs/ChatClan_PRD_v2.md`: authoritative product requirements, phasing, QA strategy, and launch criteria.

## Current Stack

- Runtime: Node.js 20+
- Server: Express 5
- Database: MariaDB through `mysql2/promise`
- Worker: `src/worker.js` processes MariaDB-backed jobs; local demo mode drains inline for localhost testability.
- UI: server-rendered HTML plus static CSS/JS
- Tests: built-in `node:test`
- Hosting target: Host Africa DirectAdmin Node.js app + MariaDB

Do not add heavy dependencies unless they remove substantial risk or complexity. Prefer Node standard library and small, focused modules.

## Production Principles

- This is not an MVP. Build production-grade foundations that are testable locally.
- Keep code reusable and modular: routes call services; services isolate vendor/database logic.
- Avoid bloated generated code. Prefer small helpers and clear boundaries.
- Every production feature should have a localhost verification path.
- Every risky integration should have tests for core behavior.
- Secrets must live in environment variables or encrypted storage, never in browser localStorage.
- Webhooks must acknowledge quickly and process/store events through reusable services.
- Multi-tenant behavior must be explicit. Never assume a single business after tenant isolation is implemented.
- Authenticated API reads must require a session and concrete `businessId`; public pages may use demo preview data only for non-sensitive marketing/app previews.
- Follow PRD v2 priorities: P0 launch requirements first, then P1 retention features, then P2 expansion features.
- POPIA behavior is product-critical, not optional polish.

## Design Rules

Follow `docs/design/chatclan-design-system.md`.

Core visual rules:

- Dark-first UI with green-black marketing surfaces.
- Dominant accent: `#22C55E`.
- Secondary gradient endpoint: `#0D9488`.
- App/billing surfaces can skew blue-black; marketing surfaces skew green-black.
- Use 8px spacing logic.
- Cards use 8-20px radius depending on size; avoid oversized roundness.
- Landing pages use full-width stacked sections and the Claude layout:
  - centered hero
  - WhatsApp-highlighted headline
  - trust row
  - dashboard browser mockup
  - stats strip
  - feature cards
  - pricing cards
  - CTA banner
  - footer
- Do not let floating navigation obscure or cut through core content.
- Prefer the supplied emoji icon style unless a future design migration replaces it.

## Important Local Files

- `src/server.js`: Express application entry.
- `src/views.js`: current server-rendered marketing/app shell.
- `src/routes/web.js`: web, health, readiness routes.
- `src/routes/api.js`: application API routes.
- `src/routes/webhooks.js`: Meta and PayFast webhook routes.
- `src/services/metaClient.js`: outbound Meta Cloud API client.
- `src/services/metaCredentials.js`: encrypted tenant Meta credential storage and phone-number tenant lookup.
- `src/services/metaWebhook.js`: Meta webhook verification and event extraction.
- `src/services/consent.js`: POPIA opt-in/opt-out audit and STOP suppression helpers.
- `src/services/campaignRecipients.js`: prepares consent-safe campaign recipients and personalization.
- `src/services/broadcastDispatch.js`: sends prepared queued recipients through Meta client in bounded mock-safe batches.
- `src/services/dispatchRateLimiter.js`: configurable per-tenant and per-phone-number campaign dispatch quotas.
- `src/services/jobQueue.js`: MariaDB/demo job queue with dedupe, attempts, retry delay, and status tracking.
- `src/services/jobProcessor.js`: maps queued job types to service handlers.
- `src/services/metaEventProcessor.js`: processes Meta webhook events including STOP suppression.
- `src/services/users.js`: tenant user management and password reset token lifecycle.
- `src/services/mailer.js`: mock/SMTP email delivery for password reset and team invite emails.
- `src/services/templates.js`: workspace template manager and validation.
- `src/data/templateLibrary.js`: 19-industry South African template library.
- `src/data/chatbotFlowLibrary.js`: 19-industry chatbot flow template library.
- `src/services/chatbotFlows.js`: flow template duplication, JSON definition validation, publishing, and test-mode simulation.
- `src/services/chatbotRuntime.js`: published-flow trigger matching, runtime sessions, bot replies, and handoff notes from inbound webhooks.
- `src/services/analytics.js`: campaign performance and Meta cost reporting entrypoints.
- `src/services/metaCosts.js`: Meta rate cards, delivery-cost ledger reconciliation, and cost report summaries.
- `src/services/inbox.js`: unified inbox conversations, messages, assignment, resolution, replies, notes, SLA metadata, typing indicators, and CSAT.
- `src/services/inboxEvents.js`: in-process real-time inbox event broadcaster for SSE clients.
- `src/services/billing.js`: PayFast subscription checkout, ITN reconciliation, subscription status, and invoices.
- `src/services/payfast.js`: PayFast ITN helpers.
- `src/services/webhookEvents.js`: webhook event recording.
- `src/services/repository.js`: data access facade with demo fallback.
- `src/db/pool.js`: MariaDB pool and database health.
- `src/middleware/security.js`: request IDs and security headers.
- `database/schema.sql`: MariaDB schema.
- `database/seed.sql`: seed data.
- `public/css/app.css`: design system implementation.
- `public/js/app.js`: client interactions.

## Environment

Use `.env.example` as the source for required configuration.

Important variables:

- `APP_NAME`
- `APP_URL`
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `MAIL_MODE` (`mock` by default; set `smtp` for production SMTP delivery)
- `MAIL_FROM`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_WABA_ID`
- `META_PHONE_NUMBER_ID`
- `META_ACCESS_TOKEN`
- `META_GRAPH_VERSION`
- `META_SEND_MODE` (`mock` by default; set `live` only when intentionally sending real WhatsApp messages)
- `META_TEMPLATE_MODE` (`mock` by default; set `live` only when intentionally submitting/syncing templates with Meta)
- `CREDENTIAL_ENCRYPTION_KEY`
- `PAYFAST_ENV`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_CONFIRM_SERVER`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_BATCH_SIZE`
- `DISPATCH_TENANT_PER_MINUTE`
- `DISPATCH_PHONE_PER_MINUTE`
- `INBOX_FIRST_RESPONSE_SLA_MINUTES`
- `META_COST_MARKET`
- `META_COST_MARKETING_ZAR_CENTS`
- `META_COST_UTILITY_ZAR_CENTS`
- `META_COST_AUTHENTICATION_ZAR_CENTS`
- `META_COST_AUTHENTICATION_INTERNATIONAL_ZAR_CENTS`
- `META_COST_SERVICE_ZAR_CENTS`

If `DB_HOST` is blank, the app must remain runnable locally using demo data.

## Verification Commands

Run these after meaningful code changes:

```powershell
npm run check
npm test
```

For local server verification:

```powershell
npm start
```

For production queue processing with MariaDB configured, run the worker as a second DirectAdmin Node application or supervised Node process:

```powershell
npm run worker
```

For a single local queue batch:

```powershell
npm run worker:once
```

Useful endpoints:

- `GET /`
- `GET /docs`
- `GET /health`
- `GET /ready`
- `GET /api/dashboard`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id/role`
- `DELETE /api/users/:id`
- `GET /api/integrations/email/verify`
- `GET /api/billing`
- `GET /api/billing/plans`
- `POST /api/billing/payfast/checkout`
- `GET /api/templates/library`
- `GET /api/templates`
- `POST /api/templates`
- `POST /api/templates/library/:id/install`
- `PATCH /api/templates/:id/status`
- `POST /api/templates/:id/submit-meta`
- `POST /api/templates/sync-meta`
- `GET /api/chatbot/templates`
- `GET /api/chatbot/flows`
- `POST /api/chatbot/templates/:id/duplicate`
- `GET /api/chatbot/flows/:id`
- `PUT /api/chatbot/flows/:id`
- `POST /api/chatbot/flows/:id/publish`
- `POST /api/chatbot/flows/:id/simulate`
- `GET /api/analytics/overview`
- `GET /api/analytics/costs`
- `GET /api/analytics/meta-rate-cards`
- `POST /api/analytics/meta-rate-cards/sync`
- `GET /api/inbox/conversations`
- `GET /api/inbox/events`
- `GET /api/inbox/conversations/:id`
- `PATCH /api/inbox/conversations/:id`
- `POST /api/inbox/conversations/:id/replies`
- `GET /api/inbox/conversations/:id/notes`
- `POST /api/inbox/conversations/:id/notes`
- `POST /api/inbox/conversations/:id/typing`
- `POST /api/inbox/conversations/:id/csat`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/recipients/prepare`
- `GET /api/campaigns/:id/recipients`
- `POST /api/campaigns/:id/dispatch`
- `POST /api/contacts`
- `GET /api/consent/events`
- `GET /api/consent/export.csv`
- `GET /webhooks/meta`
- `POST /webhooks/meta`
- `POST /webhooks/payfast/itn`

## Current Known Gaps

- Authentication, sessions, tenant user management, password reset tokens, and mock/SMTP email delivery exist. Local non-production responses expose reset tokens and temporary passwords for testing; production responses do not.
- Tenant isolation is started through business memberships, session-scoped writes, and authenticated dashboard reads; every future data query must preserve tenant scoping.
- Encrypted per-tenant Meta credential storage exists. Future work must keep tokens out of browser storage and logs.
- Contact import exists with POPIA opt-in enforcement. Consent audit, STOP suppression, and consent-safe campaign recipient preparation exist.
- Template manager, 19-industry library, and mock-safe/live-gated Meta template submission/sync exist.
- Chatbot flow builder and runtime exist with 19 industry templates, editable JSON definitions, publish validation, test-mode simulation, inbound trigger matching, runtime sessions, bot replies, and handoff notes. Future work should expand runtime actions beyond agent handoff.
- Basic analytics, Meta rate-card sync from configured rates, and billing-grade delivery-cost ledger reconciliation exist. Live use still depends on keeping rate-card environment values aligned with Meta's current published pricing for the tenant market.
- Unified inbox persistence exists for WhatsApp messages, assignments, resolution, agent replies, internal notes, SLA status, typing indicators, CSAT, and SSE-backed real-time updates. Multi-node deployments will need a shared event bus instead of the current in-process broadcaster.
- PayFast subscription checkout and ITN reconciliation exist. Production still needs real merchant credentials, account/domain validation, and live sandbox-to-live acceptance testing.
- Campaign recipients can be prepared, inspected, queued, and dispatched in bounded rate-limited batches. Dispatch remains mock-safe by default; Meta status webhooks update recipient and inbox delivery states.
- Webhooks enqueue jobs after acknowledgement. MariaDB production should run `npm run worker`; demo mode drains inline for localhost testability.
- PayFast production checks still need merchant/account domain validation and expected-amount checks.
- The app shell needs to be decomposed further from `src/views.js` as pages become production features.

## Next Production Phases

1. Setup/onboarding wizard hardening for beta businesses.
2. Automated E2E coverage for P0 beta release scenarios.
3. Production deployment runbook and DirectAdmin worker supervision.
4. Runtime automation expansion for tags, webhooks, waits, and notification actions.

## PRD v2 Phase 1 Release Gate

Phase 1 is not ready until:

- 20 invited beta businesses can be onboarded.
- At least 15 beta businesses are active.
- Setup wizard completion is at least 65%.
- All P0 critical scenarios in `docs/ChatClan_PRD_v2.md` pass.
- Two tenants cannot see each other's data.
- Campaigns cannot send to opted-out or unconsented contacts.

## Skills / Capabilities To Use

- Use Context7 before adding or materially changing package APIs.
- Use official vendor documentation before implementing Meta, PayFast, Ozow, Yoco, Peach, PayGate, Netcash, Shopify, WooCommerce, Zapier, Make, or AI-provider integrations.
- Use `browser:control-in-app-browser` for localhost visual QA when the connector is available.
- Use `spreadsheets:Spreadsheets` when creating, validating, or analysing CSV/spreadsheet import fixtures.

## Documentation Discipline

Update `docs/implementation_log.md` whenever a phase is completed. Update this `AGENT.md` when architecture, commands, design rules, or deployment assumptions change.
