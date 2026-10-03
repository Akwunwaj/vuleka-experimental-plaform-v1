# Implementation Log

## 2026-07-22 - Social sign-in and reCAPTCHA

- Added Google and Facebook social sign-in controls to tenant login and workspace registration, shown only when complete provider credentials are configured.
- Converted OAuth initiation to a reCAPTCHA-protected POST flow while preserving one-time anti-forgery state and exact callback handling.
- Added invisible reCAPTCHA v3 to tenant login, registration, social-signup completion, password reset, platform-owner login, and social OAuth initiation.
- Added server-side checks for action, score, hostname, token age, provider availability, and fail-closed production configuration.
- Added Google verified-email enforcement, configuration-driven Facebook Graph versioning, CSP allowances, deployment preflight gates, responsive UI verification, and regression tests.

## 2026-07-22 - Public legal and compliance pages

- Replaced placeholder footer destinations with detailed Privacy Notice, Terms of Service, POPIA Commitment, Contact, and official WhatsApp policy links.
- Added structured clause navigation, official-source references, responsive legal layouts, and configuration-backed company and Information Officer details.
- Added production preflight gates for legal identity, physical contact, dedicated legal/privacy/security addresses, and Information Officer information.
- Corrected the POPIA security-compromise requirement from an inaccurate fixed 72-hour deadline to "as soon as reasonably possible," consistent with the Act and current Information Regulator guidance.

## 2026-06-03

- Reviewed the supplied HTML prototype files and `context/claude_text.md`.
- Chose Node.js + Express + MariaDB as the most suitable first production stack for Host Africa DirectAdmin.
- Created a real application structure:
  - `src/server.js`
  - `src/routes/web.js`
  - `src/routes/api.js`
  - `src/routes/webhooks.js`
  - `src/services/repository.js`
  - `src/services/metaClient.js`
  - `src/db/pool.js`
  - `src/data/demoData.js`
- Added static UI assets:
  - `public/css/app.css`
  - `public/js/app.js`
- Added MariaDB scripts:
  - `database/schema.sql`
  - `database/seed.sql`
- Added deployment/configuration files:
  - `package.json`
  - `.env.example`
- Added documentation:
  - `docs/tech_stack_decision.md`
  - `docs/execution_plan.md`
  - `docs/implementation_log.md`

## 2026-06-03 Continued

- Renamed the real application from Wazify to ChatClan.
- Added `src/config/app.js` for reusable brand configuration.
- Consulted Context7 for current Express 5 and `mysql2` usage patterns.
- Consulted current Meta and PayFast vendor documentation before implementation work.
- Added reusable Meta webhook helpers in `src/services/metaWebhook.js`.
- Added reusable PayFast ITN helpers in `src/services/payfast.js`.
- Added `src/services/webhookEvents.js` to record webhook events consistently.
- Updated webhook routes to verify Meta challenges, optionally validate Meta signatures, acknowledge webhook POSTs quickly, and record normalized events.
- Updated PayFast ITN handling to verify signatures and optionally perform server confirmation.
- Reworked the landing page to match Claude's supplied design system more closely:
  - Centered dark WhatsApp marketing hero
  - Trust row
  - Dashboard browser mockup
  - Floating navigation
  - Stats strip
  - Feature cards
  - Pricing section
  - CTA banner and footer
- Added production hardening:
  - Request IDs
  - Security headers and content security policy
  - Disabled `x-powered-by`
  - Proxy-aware Express configuration
  - `/ready` readiness endpoint
  - Graceful shutdown and MariaDB pool close
- Added tests for the security middleware.
- Added authentication/session foundation:
  - Scrypt password hashing
  - Signed HTTP-only session cookies
  - Session lookup middleware
  - Login/logout/me API routes
  - Local demo admin flow when MariaDB is not configured
  - MariaDB schema for users, memberships, and sessions
  - Tenant-aware repository writes through `businessId`
- Added auth tests for password verification and session signature tampering.

## 2026-06-03 Next Phase

- Added encrypted Meta credential storage:
  - AES-256-GCM encryption helper
  - Tenant-scoped Meta credential service
  - MariaDB `business_integrations` table
  - Protected read/save API routes for Meta credentials
  - Masked credential reads for the UI
  - Settings-page credential form
  - Outbound Meta test messages now use tenant credentials before environment fallback
- Added tests for credential encryption, masking, and Meta credential persistence in demo mode.

## 2026-06-03 PRD v2 Alignment

- Reviewed `docs/ChatClan_PRD_v2.md`.
- Rewrote `docs/execution_plan.md` around PRD v2 Phase 1-4 roadmap, P0/P1/P2 priorities, QA release gates, and open decisions.
- Updated `AGENT.md` with PRD v2 as a source of truth and listed useful skills/capabilities:
  - Context7 for package documentation
  - Official vendor documentation for integrations
  - Browser plugin for localhost visual QA when available
  - Spreadsheets skill for CSV/import fixtures when needed

## 2026-06-03 Contact Import Phase

- Added production contact import service using `csv-parse`.
- Added protected `POST /api/contacts/import` endpoint.
- Added CSV column mapping validation.
- Added POPIA opt-in mapping enforcement.
- Added South African phone validation requiring `+27`.
- Added duplicate detection within imported rows.
- Added MariaDB schema for contact import jobs and opt-in events.
- Added contact fields for email, opt-in channel, opt-in timestamp, and opt-out timestamp.
- Added tests for opt-in mapping, missing country code, duplicate detection, valid import, and phone normalization.

## 2026-06-03 POPIA Consent Phase

- Added reusable consent service for opt-in and opt-out events.
- Added STOP, unsubscribe, and opt-out keyword detection for inbound WhatsApp messages.
- Added tenant lookup from Meta phone number ID to business ID.
- Updated Meta webhook processing to suppress contacts when customers reply with STOP-style keywords.
- Added protected consent audit endpoints:
  - `GET /api/consent/events`
  - `GET /api/consent/export.csv`
- Masked phone numbers in browser-facing consent audit responses and CSV exports.
- Added tests for Meta phone-number tenant mapping, STOP keyword detection, opt-out event recording, and masked CSV exports.

## 2026-06-03 Campaign Recipient Phase

- Added campaign recipient preparation service.
- Added MariaDB `campaign_recipients` table for queued, sent, delivered, read, and failed recipient states.
- Updated campaign creation to return persisted campaign IDs in MariaDB mode and keep demo campaigns available locally.
- Added protected recipient endpoints:
  - `POST /api/campaigns/:id/recipients/prepare`
  - `GET /api/campaigns/:id/recipients`
- Enforced opted-out contact exclusion during recipient preparation.
- Added first-name personalization for campaign bodies using `{{first_name}}`.
- Updated the campaign form to prepare recipients after saving a campaign.
- Added tests for opt-out exclusion, segment targeting, and personalization fallback.
- Verified the live API smoke path: login, create campaign, prepare recipients, and list queued recipients.

## 2026-06-03 Tenant Read Hardening

- Split public marketing preview data from authenticated tenant dashboard data.
- Updated `/api/dashboard` to require an authenticated session.
- Removed database-mode demo fallback from tenant repository reads so missing/broken tenant queries do not silently serve another workspace's data.
- Added tenant-scoped business profile and dashboard metrics in MariaDB mode.
- Updated API error handling to return intentional 4xx service messages without exposing stack traces.
- Added a regression test for public preview data availability.
- Verified the live API smoke path:
  - `GET /` returns the public ChatClan page.
  - Anonymous `GET /api/dashboard` returns `401`.
  - Authenticated `GET /api/dashboard` returns the demo workspace.

## 2026-06-03 Broadcast Dispatch Phase

- Added reusable broadcast dispatch service.
- Added protected dispatch endpoint:
  - `POST /api/campaigns/:id/dispatch`
- Dispatch consumes only prepared recipients with `queued` status.
- Dispatch uses `sendTextMessage`, which remains mock-safe unless `META_SEND_MODE=live`.
- Dispatch marks recipient rows as `sent` or `failed` and stores provider message IDs when available.
- Dispatch refreshes campaign send/delivery counts in MariaDB mode.
- Added tests for mock-safe dispatch and recipient status updates.
- Verified the live API smoke path: login, create campaign, prepare recipients, dispatch recipients, and inspect sent statuses.

## 2026-06-03 Queue And Worker Phase

- Added reusable job queue service with:
  - MariaDB-backed jobs
  - Demo in-memory jobs
  - Dedupe keys
  - Attempts and retry delay
  - Completed and failed job states
- Added `jobs` MariaDB table.
- Added `src/worker.js` as the standalone worker entrypoint.
- Added npm scripts:
  - `npm run worker`
  - `npm run worker:once`
- Added job processor for:
  - `campaign.dispatch`
  - `webhook.meta.event`
  - `webhook.payfast.itn`
- Updated campaign dispatch API to enqueue dispatch jobs and return `202 Accepted`.
- Updated webhook routes to enqueue Meta and PayFast events after acknowledgement.
- Kept local demo mode testable by draining queued jobs inline when MariaDB is not configured.
- Added tests for queued campaign dispatch, queued Meta STOP webhook processing, and job deduplication.
- Verified localhost smoke paths:
  - Campaign dispatch endpoint returns `202`, creates a job, and marks demo recipients as sent.
  - Meta webhook returns `200`, enqueues processing, and records STOP opt-out consent.

## 2026-06-04 User Management And Password Reset Phase

- Added tenant-scoped user management service.
- Added role-aware auth middleware for owner/admin protected routes.
- Added protected user endpoints:
  - `GET /api/users`
  - `POST /api/users`
  - `PATCH /api/users/:id/role`
  - `DELETE /api/users/:id`
- Added password reset token lifecycle:
  - Secure random raw token
  - SHA-256 token hash storage
  - One-hour expiry
  - One-use reset confirmation
  - Session invalidation after database password reset
- Added public password reset endpoints:
  - `POST /api/auth/password-reset/request`
  - `POST /api/auth/password-reset/confirm`
- Added MariaDB `password_reset_tokens` table.
- Updated seed data to create the demo owner user and membership for MariaDB mode.
- Added Settings UI form for adding team members.
- Added login-page password reset request form.
- Added tests for user create/list/role/deactivate and one-use password reset tokens.
- Verified localhost smoke path: owner login, create team user, list users, request reset, confirm reset, and login as reset user.

## 2026-06-04 Template Manager Phase

- Consulted current WhatsApp template category/guideline references before shaping validation.
- Added 19-industry South African template library in `src/data/templateLibrary.js`.
- Added reusable template service with:
  - Template body validation
  - Category validation for `MARKETING`, `UTILITY`, and `AUTHENTICATION`
  - Sequential variable validation for `{{1}}`, `{{2}}`, `{{3}}`
  - Library install support
  - Local status updates for `Draft`, `Submitted`, `Approved`, and `Rejected`
- Expanded MariaDB `message_templates` schema with slug, industry, language, footer, JSON component metadata, Meta template ID, rejection reason, and lifecycle timestamps.
- Added protected template endpoints:
  - `GET /api/templates/library`
  - `GET /api/templates`
  - `POST /api/templates`
  - `POST /api/templates/library/:id/install`
  - `PATCH /api/templates/:id/status`
- Added tests for library coverage, validation, library install, custom creation, and status update.
- Verified localhost smoke path: owner login, list library, install retail template, create custom template, mark submitted, and list workspace templates.

## 2026-06-04 Analytics And Meta Cost Reporting Phase

- Added campaign category tracking for `MARKETING`, `UTILITY`, and `AUTHENTICATION`.
- Added configurable Meta cost environment variables for South African ZAR estimates.
- Added reusable analytics service for:
  - Campaign sent, delivered, read, failed, and reply counts.
  - Delivery, read, and reply rates.
  - Campaign-level performance summaries.
  - Meta cost estimates by message category.
- Added protected analytics endpoints:
  - `GET /api/analytics/overview`
  - `GET /api/analytics/costs`
- Updated demo data and seed campaigns with categories.
- Added tests for analytics overview, configurable cost rates, and campaign category preservation.
- Verified localhost smoke path: login, fetch overview, fetch cost report with configured rates, and confirm non-zero category costs.

## 2026-06-04 Unified Inbox Persistence Phase

- Added reusable inbox service for:
  - Tenant-scoped conversation listing.
  - Conversation history retrieval.
  - Inbound WhatsApp message persistence.
  - Duplicate provider message protection.
  - Message status updates from Meta status webhooks.
  - Assignment, read, open, and resolved state updates.
  - Agent outbound replies through the Meta client with mock-safe local behavior.
- Added MariaDB tables:
  - `inbox_conversations`
  - `inbox_messages`
- Wired Meta inbound webhook processing to create or reopen inbox conversations before STOP suppression.
- Added protected inbox endpoints:
  - `GET /api/inbox/conversations`
  - `GET /api/inbox/conversations/:id`
  - `PATCH /api/inbox/conversations/:id`
  - `POST /api/inbox/conversations/:id/replies`
- Updated authenticated dashboard reads to include persisted inbox conversations in database mode.
- Added seed inbox conversation/message for MariaDB local imports.
- Added tests for inbound Meta message persistence, unassigned queue behavior, assignment, resolved/reopened state, and agent reply persistence.

## 2026-06-04 Meta Template Submission And Sync Phase

- Consulted Context7 Express 5 documentation for route-handler/error propagation patterns.
- Consulted official Meta developer documentation targets for WhatsApp Business Management API template create/list operations.
- Added mock-safe/live-gated Meta template service in `src/services/metaTemplates.js`.
- Added Meta template payload builder with:
  - WABA template name from local slug.
  - Category and language mapping.
  - `BODY` and optional `FOOTER` components.
  - Variable examples for `{{1}}`, `{{2}}`, and later sequential variables.
- Added protected template lifecycle endpoints:
  - `POST /api/templates/:id/submit-meta`
  - `POST /api/templates/sync-meta`
- Added `META_GRAPH_VERSION` and `META_TEMPLATE_MODE` environment variables.
- Added remote status mapping from Meta statuses to local `Submitted`, `Approved`, and `Rejected`.
- Added sync/import support for templates created outside ChatClan when returned by Meta.
- Replaced demo template `Date.now()` IDs with a monotonic demo ID sequence to prevent localhost collisions.
- Added tests for Meta payload construction, mock-safe submission, remote status sync, and remote template import.

## 2026-06-04 SMTP Email Delivery Phase

- Consulted Context7 Nodemailer documentation for SMTP transport, mock/json transport, and `verify()` behavior.
- Added `nodemailer` as a focused mail transport dependency.
- Added reusable mailer service in `src/services/mailer.js` with:
  - `MAIL_MODE=mock` localhost/test delivery using Nodemailer JSON transport.
  - `MAIL_MODE=smtp` production delivery using `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`.
  - Branded HTML/text email templates.
  - Password reset email delivery.
  - Team invite email delivery with temporary password.
  - Mock outbox helpers for tests.
  - SMTP configuration verification.
- Wired password reset requests to email reset links.
- Wired team user creation to email team invitations.
- Added protected email verification endpoint:
  - `GET /api/integrations/email/verify`
- Added environment variables for support email, mail mode, sender, and SMTP credentials.
- Kept local non-production reset tokens and temporary passwords available in API responses for localhost testability.
- Confirmed production responses do not expose reset tokens or temporary passwords.
- Added tests for invite email delivery, password reset email delivery, mock mailer verification, and production response safety.

## 2026-06-04 PayFast Subscription Lifecycle Phase

- Consulted current PayFast subscription and ITN documentation targets before implementation.
- Added reusable billing service in `src/services/billing.js` with:
  - Static ChatClan plan definitions.
  - Signed PayFast hosted checkout field generation.
  - PayFast sandbox/live process URL support.
  - Pending subscription creation.
  - ITN signature, optional server-confirmation, and expected-amount enforcement.
  - Subscription activation on `COMPLETE`.
  - Past-due/canceled handling for non-complete payments.
  - Paid/failed/void invoice records.
  - Billing event audit records.
- Added PayFast helper functions for signing checkout/ITN data and resolving process URLs.
- Added MariaDB tables:
  - `business_subscriptions`
  - `billing_events`
- Expanded `invoices` with provider payment IDs, merchant payment IDs, currency, due date, paid timestamp, and metadata.
- Wired PayFast ITN jobs through billing reconciliation before webhook event recording.
- Added protected billing endpoints:
  - `GET /api/billing`
  - `GET /api/billing/plans`
  - `POST /api/billing/payfast/checkout`
- Added PayFast merchant environment variables.
- Added seed subscription and invoice data.
- Added tests for signed checkout generation, complete ITN activation/invoice creation, and amount-mismatch rejection.
- Verified localhost smoke path: login, create PayFast checkout, post signed COMPLETE ITN, worker processes job inline, subscription becomes active, and paid invoice appears.

## 2026-06-04 Campaign Rate Limiting And Delivery Status Phase

- Added reusable dispatch rate limiter in `src/services/dispatchRateLimiter.js`.
- Added configurable quotas:
  - `DISPATCH_TENANT_PER_MINUTE`
  - `DISPATCH_PHONE_PER_MINUTE`
- Added MariaDB `dispatch_rate_limits` table for durable quota windows.
- Added demo-mode in-memory quota windows for localhost testability.
- Updated campaign dispatch to consume quota before sending queued recipients.
- Added campaign recipient update by Meta provider message ID.
- Updated Meta status webhook processing so `sent`, `delivered`, `read`, and `failed` events update both inbox messages and campaign recipients where applicable.
- Fixed Meta webhook dedupe keys so sequential status updates for the same message ID are processed separately by status.
- Added unique mock Meta message IDs to prevent localhost recipient collisions.
- Added tests for rate-limited dispatch and Meta status webhook recipient updates.
- Verified localhost smoke path: login, configure mock Meta credentials, create campaign, prepare recipients, dispatch under a two-message tenant quota, process delivered/read webhooks, and confirm the final recipient status becomes `read`.

## 2026-06-04 Inbox Real-Time, Notes, SLA, And CSAT Phase

- Added `src/services/inboxEvents.js` as an in-process inbox event broadcaster.
- Added protected Server-Sent Events endpoint:
  - `GET /api/inbox/events`
- Added internal note support:
  - `GET /api/inbox/conversations/:id/notes`
  - `POST /api/inbox/conversations/:id/notes`
- Added typing indicator endpoint:
  - `POST /api/inbox/conversations/:id/typing`
- Added CSAT capture endpoint:
  - `POST /api/inbox/conversations/:id/csat`
- Added first-response SLA metadata with configurable `INBOX_FIRST_RESPONSE_SLA_MINUTES`.
- Expanded `inbox_conversations` with first-response, resolution, and CSAT fields.
- Added MariaDB `inbox_notes` table.
- Updated inbound messages, outbound replies, conversation updates, status updates, notes, typing, and CSAT writes to publish real-time inbox events.
- Updated the inbox UI with active conversation loading, live refresh hooks, notes, SLA badge, typing indicator, and CSAT input.
- Added tests for inbox notes, SLA state, CSAT, and event publication.

## 2026-06-04 Meta Cost Reconciliation Phase

- Consulted current Meta WhatsApp Platform pricing guidance before implementation.
- Added `src/services/metaCosts.js` for:
  - Configured Meta rate-card sync.
  - Active rate-card listing.
  - Per-message delivery-cost reconciliation.
  - Ledger-backed Meta cost report summaries.
- Added protected endpoints:
  - `GET /api/analytics/meta-rate-cards`
  - `POST /api/analytics/meta-rate-cards/sync`
- Expanded `GET /api/analytics/costs` so it now prefers reconciled delivery-cost ledger entries and falls back to configured estimates only when no ledger entries exist.
- Added MariaDB tables:
  - `meta_rate_cards`
  - `message_cost_events`
- Added support for `MARKETING`, `UTILITY`, `AUTHENTICATION`, `AUTHENTICATION_INTERNATIONAL`, and `SERVICE` pricing buckets.
- Wired Meta status webhook processing to create one cost ledger entry per delivered/read provider message ID, deduping later read events after delivered events.
- Added environment variables:
  - `META_COST_AUTHENTICATION_INTERNATIONAL_ZAR_CENTS`
  - `META_COST_SERVICE_ZAR_CENTS`
- Added tests for configured rate sync, delivered-message reconciliation, read-event dedupe, and ledger-backed reports.

## 2026-06-04 Chatbot Flow Builder Phase

- Reviewed the supplied chatbot simulator, hierarchical flow diagram, Cloud API chatbot prototype, and PRD flow-builder requirements.
- Added `src/data/chatbotFlowLibrary.js` with 19 industry starter chatbot templates aligned to the existing South African template industries.
- Added `src/services/chatbotFlows.js` for:
  - Template listing.
  - Template duplication into tenant workspaces.
  - Editable structured flow definitions.
  - Publish-time validation for missing nodes, unsupported node types, empty messages, and broken condition branches.
  - Test-mode simulation that skips delays and returns a WhatsApp-style transcript.
- Added MariaDB `chatbot_flows` table.
- Added protected endpoints:
  - `GET /api/chatbot/templates`
  - `GET /api/chatbot/flows`
  - `POST /api/chatbot/templates/:id/duplicate`
  - `GET /api/chatbot/flows/:id`
  - `PUT /api/chatbot/flows/:id`
  - `POST /api/chatbot/flows/:id/publish`
  - `POST /api/chatbot/flows/:id/simulate`
- Added a Flows page to the app shell with:
  - Industry flow template cards.
  - Workspace flow list.
  - JSON definition editor.
  - Publish action.
  - Phone-style test simulator.
- Added tests for 19-industry coverage, template duplication, publish validation blocking broken branches, successful publishing, customer branch simulation, and human handoff simulation.

## 2026-06-04 Chatbot Runtime Phase

- Added published-flow trigger matching so inbound WhatsApp text only starts a validated, published flow when a trigger keyword matches.
- Added `src/services/chatbotRuntime.js` for:
  - Runtime session creation and completion.
  - Demo-mode in-memory sessions for localhost testing.
  - MariaDB-backed session persistence via `chatbot_sessions`.
  - Bot outbound replies through the existing inbox reply and Meta client path.
  - Agent handoff notes when a flow reaches an escalation action.
- Added MariaDB `chatbot_sessions` table.
- Wired Meta inbound webhook processing to run chatbot automation after inbox persistence and STOP/opt-out checks.
- Preserved POPIA behavior: STOP-style messages suppress contacts and do not start chatbot automation.
- Exported reusable chatbot flow helpers for published trigger lookup and simulation reuse.
- Added tests for runtime bot replies, handoff notes, and STOP automation bypass.
- Verified `npm run check` and `npm test` with 53 passing tests.

## 2026-06-04 Setup Wizard Hardening Phase

- Added `src/services/setupWizard.js` for resumable six-step beta onboarding progress:
  - Workspace profile.
  - Meta business verification readiness.
  - WhatsApp WABA credential connection.
  - First template.
  - POPIA-compliant contacts.
  - Test message.
- Added MariaDB `setup_wizard_steps` table for persisted step state and metadata.
- Added protected setup endpoints:
  - `GET /api/setup/wizard`
  - `PATCH /api/setup/wizard/steps/:id`
- Wired existing activation actions to setup progress:
  - Saving Meta credentials completes WhatsApp connection.
  - Creating or installing a template completes first-template setup.
  - Adding/importing contacts completes contact setup.
  - Sending a test message completes test-message setup.
- Added dashboard setup wizard UI with a progress bar, step rows, resume actions, and Meta verification readiness guidance.
- Added tests for derived setup completion and manual step resume behavior.
- Verified `npm run check` and `npm test` with 55 passing tests.

## 2026-06-04 POPIA Data Deletion Workflow Phase

- Added `src/services/dataDeletion.js` for owner/admin data subject deletion requests.
- Added MariaDB `data_deletion_requests` table with masked phone storage, phone hash lookup, requester, status, affected counts, and completion timestamps.
- Added protected compliance endpoints:
  - `GET /api/compliance/deletion-requests`
  - `POST /api/compliance/deletion-requests`
- Added inbox redaction support that:
  - Replaces conversation customer names and phones with deleted-subject placeholders.
  - Redacts inbox message bodies.
  - Redacts internal note bodies.
  - Publishes inbox update events after redaction.
- Added campaign-recipient cleanup so deleted customers are removed from prepared campaign targeting across the workspace.
- Added contact redaction that clears direct identifiers, suppresses future sends, and records a `data_deleted` opt-in audit event in MariaDB mode.
- Added Settings & API Compliance Centre UI for processing deletion requests and viewing recent masked request results.
- Ensured returned deletion request objects expose masked phones and hashes only, not raw customer phone numbers.
- Added tests for POPIA deletion propagation to contacts, campaign recipients, inbox conversations, and message bodies.
- Verified `npm test` with 56 passing tests.

## 2026-06-08 Beta Release QA Sweep

- Reviewed protected API route coverage for critical P0 write paths.
- Hardened campaign and contact mutation routes so only owners/admins can:
  - Create campaigns.
  - Prepare campaign recipients.
  - Dispatch campaigns.
  - Create contacts.
  - Import contacts.
- Preserved agent access for inbox support workflows such as replies, notes, assignment, typing, and conversation updates.
- Added middleware tests for anonymous and non-admin role blocking.
- Added route guard tests to catch regressions where campaign/contact write routes are loosened back to plain authentication.
- Verified `npm run check`, `node --check public/js/app.js`, and `npm test` with 58 passing tests.

## 2026-06-08 Beta Smoke Command Phase

- Added `scripts/beta-smoke.js` as a repeatable pre-release smoke check.
- The default smoke path is read-only and verifies:
  - `/health` and `/ready`.
  - Anonymous dashboard access is rejected.
  - Demo/admin login returns a valid session cookie.
  - Critical authenticated read APIs respond for setup, templates, chatbot flows, billing, analytics, inbox, consent audit, Meta integration status, and POPIA deletion requests.
- Added explicit `SMOKE_WRITE=true` mode for local or disposable staging tenants to create a throwaway contact/campaign, prepare recipients, and queue one dispatch through the existing mock/live-gated path.
- Added `npm run smoke:beta` and included the smoke script in `npm run check`.
- Documented the smoke command, environment variables, and write-mode guardrails in the README.

## 2026-06-08 Production Preflight Phase

- Added `scripts/production-preflight.js` for production environment validation.
- Added `npm run ops:preflight` to fail fast on missing or unsafe production settings for:
  - HTTPS app URL.
  - Session and credential encryption secrets.
  - MariaDB connectivity variables.
  - SMTP mode and credentials.
  - Meta WhatsApp live credentials and modes.
  - PayFast live credentials and server confirmation.
  - Worker, dispatch, and inbox SLA limits.
- Added warnings for zero Meta cost-rate values so operators confirm the current rate card before relying on cost reports.
- Added `docs/production_deployment_checklist.md` with the DirectAdmin/vendor deployment checklist and final smoke command.

## 2026-06-08 MariaDB Deployment Verification Phase

- Added `scripts/db-verify.js` for DirectAdmin/MariaDB deployment dry runs.
- Added `npm run db:verify` to connect with the configured `DB_*` environment variables.
- The verifier parses `database/schema.sql` as the table source of truth and checks that every expected table exists after import.
- Added seed-state warnings for missing bootstrap businesses, users, or memberships so first-login problems are caught before app startup.
- Documented the database verification step in the README, production deployment checklist, and DirectAdmin outline.

## 2026-06-08 App And Worker Startup Verification Phase

- Added `scripts/startup-check.js` for post-restart production checks.
- Added `npm run ops:startup-check`.
- The startup check verifies:
  - Web `/health` returns `ok=true`.
  - Web `/ready` returns `ok=true`.
  - Worker-side database connectivity when `DB_*` is configured.
  - Worker queue table readability.
  - `worker.runOnce` can boot and return cleanly.
- Kept the worker processing limit at `STARTUP_WORKER_LIMIT=0` by default so the check is safe to run against production queues.
- Documented `STARTUP_BASE_URL` and optional `STARTUP_WORKER_LIMIT=1` usage in README and the production checklist.

## 2026-06-08 SMTP Vendor Acceptance Phase

- Added `scripts/vendor-check.js` for authenticated post-start vendor checks.
- Added `npm run ops:vendor-check`.
- The current vendor check logs in as an owner/admin and calls `GET /api/integrations/email/verify`.
- Added `VENDOR_REQUIRE_SMTP=true` so production checks fail if the app is still running with `MAIL_MODE=mock`.
- Documented `VENDOR_BASE_URL`, `VENDOR_EMAIL`, `VENDOR_PASSWORD`, and `VENDOR_REQUIRE_SMTP` in README and the production checklist.

## 2026-06-08 Meta Vendor Acceptance Phase

- Extended `scripts/vendor-check.js` with `VENDOR_CHECKS=meta`.
- Added a non-sending Meta acceptance path that:
  - Calls the public Meta webhook verification challenge using `VENDOR_META_VERIFY_TOKEN`.
  - Logs in as an owner/admin.
  - Calls `GET /api/integrations/meta`.
  - Optionally requires connected Meta credentials with `VENDOR_REQUIRE_META_CONNECTED=true`.
- Documented `VENDOR_CHECKS=smtp,meta`, `VENDOR_META_VERIFY_TOKEN`, and `VENDOR_REQUIRE_META_CONNECTED` in README and the production checklist.

## 2026-06-08 PayFast Vendor Acceptance Phase

- Extended `scripts/vendor-check.js` with `VENDOR_CHECKS=payfast`.
- Added authenticated PayFast checkout acceptance that verifies:
  - A signed checkout can be generated.
  - The response includes an action URL, signature, and merchant payment ID.
  - The checkout mode matches `VENDOR_REQUIRE_PAYFAST_MODE` when set.
- Added optional `VENDOR_PAYFAST_SIMULATE_ITN=true` for local/sandbox verification of the signed ITN webhook flow.
- The simulated ITN path posts a signed `COMPLETE` payload to `/webhooks/payfast/itn` and confirms a paid invoice appears afterward.
- Documented PayFast vendor-check usage and the `PAYFAST_CONFIRM_SERVER=false` guardrail for simulated ITNs.

## 2026-06-08 Release Candidate Gate Phase

- Added `scripts/release-candidate.js`.
- Added `npm run ops:release-candidate`.
- The release-candidate command runs:
  - `npm run check`
  - `npm test`
- After local gates pass, it prints the deployment-only gates that still need production environment variables, MariaDB access, running app/worker processes, and vendor credentials.
- Documented the command in README and the production deployment checklist.

## 2026-06-08 Backup And Restore Readiness Phase

- Added `scripts/db-backup.js` to create a SQL backup from the configured MariaDB database.
- Added `npm run db:backup`.
- The backup command parses `database/schema.sql` as the table source of truth, writes table DDL, and exports table rows as SQL inserts.
- Added `backups/` to `.gitignore`.
- Added `docs/backup_restore_runbook.md` with daily backup, 30-day retention, monthly restore drill, restore-test database, and POPIA backup-retention notes.
- Updated the production deployment checklist to require `npm run db:backup` and a restore drill before launch.

## 2026-07-18 Platform Reliability Alerting And On-Call Operations

- Added durable cross-tenant reliability alerts for stale workers, worker errors, stuck jobs, dead letters, and correlated connector-provider incidents.
- Added configurable email and in-app notification policies with severity thresholds, owner/operator audiences, additional recipients, on-call assignment, escalation timing, and repeat cadence.
- Added alert acknowledgement, owner reassignment, incident linking, automatic recovery, notification evidence, and a complete operator timeline.
- Added worker-scheduled alert evaluation with deduplication so persistent signals update one operational record instead of producing alert noise.
- Added an uncluttered Platform Owner alert centre with summary metrics, dedicated alert and settings drawers, responsive layouts, and operator-only actions.
- Added service coverage for delivery, acknowledgement, reassignment, escalation, and automatic resolution.

## 2026-07-18 Campaign Dispatch Dead-Letter Safety

- Traced job `#2` to a historical smoke request whose rejected campaign creation produced the string payload `campaignId: "null"`.
- Added positive-integer dispatch validation at the API queue boundary and service boundary before SQL, quota, or provider work.
- Added explicit non-retryable failure handling so malformed jobs do not consume repeated attempts.
- Added linked-retry validation that refuses malformed historical payloads instead of producing another doomed job.
- Added owner-only invalid-job discard with required reasoning, preserved payload/error evidence, a durable resolution record, and platform audit evidence.
- Added queue action history, immediate reliability badge reconciliation, and active-only alert-center results.
- Discarded historical job `#2` after verifying that no legitimate campaign had been created and confirmed that its reliability alert resolved.

## 2026-07-18 Google Drive OAuth Deployment Gate

- Reviewed the implementation against Google's current OAuth web-server, Drive scope, Picker, verification, and restricted-scope assessment documentation.
- Retained `drive.readonly` for automatic whole-folder synchronisation because Google does not document equivalent perpetual child-file access after selecting only a folder with `drive.file`.
- Added fail-closed checks for Google web-client ID format, placeholder secrets, valid sandbox tester addresses, strict read-only scope use, and exact callback equality with `${APP_URL}/auth/google-drive/callback`.
- Added DirectAdmin deployment, restart, preflight, sandbox evidence, production approval, and rollback instructions without storing credentials or tester identities in source control.
- Recorded a future Google Picker plus `drive.file` selected-file mode as a separate least-privilege product path.
- Confirmed the current deployment callback is `https://chatclan.tfpdigital.co.za/auth/google-drive/callback`; live consent remains blocked until a real Google web client, secret, and test user are configured.

## 2026-07-26 HubSpot CRM Service Key and Sandbox Delivery

- Added encrypted, masked Platform Owner CRM configuration with live connection testing and provider audit events.
- Created and installed an organisation-owned HubSpot Service Key with least-privilege contact and Lead scopes; the initially exposed key was immediately expired and replaced.
- Confirmed live contact read and upsert access. The sandbox account rejects the optional Leads object despite the selected scopes, so ChatClan now exposes explicit `Contacts only` and `Contacts + Leads` capability modes.
- Delivered sandbox lead `CCL-20260723-F48ABE00` to HubSpot contact `830951195867` through the durable worker queue and recorded the delivery evidence in the lead timeline.
- Fixed the CRM and AI provider drawers failing to open after a stored health timestamp by using the shared date formatter.
- Updated the HubSpot runbook and PRD to Service Keys, six-month rotation ownership, account capability testing, and contacts-only compatibility defaults.
- Verification: schema 96/96, unit/service tests 152/152, beta smoke 34/34, syntax checks, and whitespace checks passed.

## Current State

## 2026-07-27 Dashboard CRM And Interaction Polish

- Replaced the dashboard's placeholder notification mark with an activity centre for unread conversations, campaign review, and setup work.
- Refined the header activity centre so its badge represents live unread conversations only, hides when there are none, and loads actionable inbox/campaign activity when opened.
- Improved dropdown usability with reliable close behavior (outside click and Escape), accessible state, a scrollable responsive panel, and direct navigation into Inbox or Insights.
- Added a built-in Subscriber CRM workspace that turns existing opted-in contacts, conversations, campaigns, and orders into an affordable lightweight relationship-management view.
- Replaced native browser prompts for contact creation with an accessible HTML dialog; successful additions immediately update the Contacts table and CRM list.
- Consolidated Add product, Share on WhatsApp, Bulk product import, Product collection, Coupon, and Add variant into HTML modal workflows.
- Added an in-inbox team assignment control and an auto-growing reply composer with a bounded scroll state.
- Added a template-creation dialog using the existing tenant-scoped template API.
- Rebuilt campaign performance as a mixed donut, conversion-rate, and layered-series visual instead of a single basic bar chart.
- Verification: `npm run check`, `npm test` (156 passing), and `git diff --check` passed.

## 2026-07-27 Contact Lifecycle Management

- Added tenant-scoped Contact edit and soft-delete APIs, with database `deleted_at` and `deleted_by_user_id` audit fields.
- Added Edit and Delete actions to every Contacts table row; edits reuse the HTML contact dialog and update the active row immediately.
- Added a dedicated HTML confirmation dialog for deletion. Soft-deleted contacts are removed from active lists, plan usage, CRM synchronisation, setup counts, and campaign audiences while their database records remain retained.

## 2026-07-27 Tenant CRM OAuth And Contact Synchronisation

- Added tenant-facing HubSpot, Salesforce, Zoho CRM, and Pipedrive OAuth connection flows with workspace/user-bound one-time state and provider-specific callbacks.
- Added encrypted offline credentials, masked reads, provider health checks, account endpoints, field mappings, sync cadence, pause/resume, disconnect, and recovery controls.
- Added durable initial, manual, and scheduled contact synchronisation with idempotent record links, payload hashes, retry evidence, run counts, durations, and consecutive-failure tracking.
- Added provider-safe default payloads, optional custom fields, Salesforce API v67.0 configuration, and queued schedule replacement when cadence or status changes.
- Added a spacious tenant Integrations workspace with readiness cards, operational summaries, sync history, and focused connect/manage drawers.
- Created and deployed the organisation-owned HubSpot `ChatClan CRM` OAuth project using HubSpot platform `2026.03`, minimum contact scopes, permanent support links, and pre-production/future production callbacks.
- Completed live consent against an isolated HubSpot developer test account and verified encrypted credentials, masked UI, provider health, durable sync evidence, and provider-side external-ID reconciliation.
- Corrected the live-discovered HubSpot identity defect: standard `phone` cannot be an upsert identifier. Email contacts use upsert; phone-only contacts now use exact lookup with duplicate protection, then update/create and durable record linking.
- Verified two consecutive live runs at `12 attempted / 12 succeeded / 0 failed`; all 12 linked contacts exist in HubSpot and the repeat run produced no duplicate ChatClan contacts.
- Deployed HubSpot build `#3` after removing the temporary local-test callback. Salesforce, Zoho CRM, and Pipedrive live acceptance remains pending.
- Verification: schema 100/100 and service tests 156/156 passed.

## 2026-07-17 Platform Reliability Control Plane

- Added durable worker heartbeats with configurable heartbeat, stale-worker, and stuck-job thresholds.
- Added a Platform Owner reliability workspace with Overview, Workers, Providers, and Dead Letters sub-navigation.
- Added cross-tenant Shopify, WooCommerce, and Google Drive reliability aggregation for source health, 24-hour sync outcomes, alerts, affected tenants, and active incidents.
- Added provider incident correlation and provider-linked incident records.
- Added owner-only dead-letter recovery that creates a linked job while preserving the original failure, with recovery history and platform audit evidence.
- Added responsive drawer workflows for incident declaration and dead-letter retry.

The app is now an executable production foundation. It has demo-data fallback for local use, MariaDB-ready tables, authentication/session foundations, tenant-scoped user management, setup/onboarding progress tracking, mock/SMTP password reset and team invite email delivery, tenant-scoped writes, user-facing screens based on the HTML blueprint, reusable vendor integration helpers, encrypted Meta credential storage, POPIA contact import, opt-out audit behavior, and data deletion request handling, queue-backed webhook/campaign processing, rate-limited campaign dispatch, Meta delivery-state updates, PayFast subscription checkout and ITN reconciliation, a 19-industry template library, mock-safe/live-gated Meta template submission and sync, chatbot flow builder and runtime execution, basic analytics, Meta rate-card sync, delivery-cost ledger reconciliation, unified inbox persistence with real-time events, internal notes, SLA metadata, typing indicators, and CSAT, security middleware, health/readiness endpoints, and backend routes for future production behavior.

- Added a public `/data-deletion` page with social-sign-in deletion instructions, identity verification, deletion scope, lawful retention, timing, and provider-disconnection guidance for Meta app review and POPIA transparency.
- Added Meta-signed Facebook data-deletion and deauthorization callbacks with HMAC verification, session invalidation, social-identity removal, account anonymisation, persistent confirmation tracking, and a public deletion-status page.

## Known Gaps

- Campaign dispatch is queue-backed, rate-limited per tenant and phone number, and remains mock-safe by default. Production quotas should be tuned against the approved Meta messaging tier before live launch.
- Email delivery is wired for password reset and team invites. Production still needs real SMTP credentials verified on Host Africa with `MAIL_MODE=smtp`.
- Template library and Meta template submit/sync workflow exist. Live use requires `META_TEMPLATE_MODE=live`, WABA ID, and a valid access token.
- Chatbot flow builder and inbound runtime exist. Runtime action support is currently limited to bot text replies and agent handoff notes; tags, external webhooks, waits, notifications, and contact-field updates are still pending.
- Meta cost reporting has configured rate-card sync and delivery-cost ledger reconciliation. Production still requires current Meta rate values to be maintained from the official rate cards before relying on reports for customer-facing billing.
- Unified inbox persistence, real-time SSE updates, typing indicators, internal notes, SLA metadata, and CSAT exist. Multi-node production scaling should replace the in-process broadcaster with Redis, MariaDB polling, or another shared event bus.
- PayFast checkout, expected-amount checks, and ITN reconciliation exist. Production still needs real merchant credentials, account/domain validation, and live acceptance testing.
- Production preflight validates env shape but does not prove vendor credentials are accepted by Meta, SMTP, or PayFast; those still need live/sandbox acceptance tests.
- `npm run db:verify` validates schema presence, not migration history or data migrations. Add a migration tool before frequent post-beta schema changes.
- `npm run db:backup` creates an app-level SQL backup, but hosting-level encrypted daily backups and off-host retention still need to be configured in DirectAdmin or the hosting provider.
- `npm run ops:startup-check` verifies the worker code path from the app host, but it does not prove an external process supervisor will restart a crashed worker. DirectAdmin or hosting-level supervision still needs an operational check.
- `npm run ops:vendor-check` verifies SMTP, non-sending Meta readiness, and PayFast checkout generation. Real PayFast live acceptance still needs an actual provider-hosted payment/ITN from the merchant account before go-live.
- POPIA data deletion requests exist for active app data. Production backup/object-storage deletion propagation still needs infrastructure-specific runbooks once the hosting and backup stack is final.
- Tenant isolation and role gates have additional QA coverage for campaign/contact write paths. Continue adding route-level checks as new P0 endpoints are introduced.
- `npm run smoke:beta` covers the current critical read surface and optional write flow, but it still depends on a running app and valid smoke credentials for the target environment.
- Campaign recipient selection excludes opted-out contacts; live sending must only consume prepared eligible recipients.
- Public pages may use demo preview data, but authenticated API reads must require a session and a concrete `businessId`.
