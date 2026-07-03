# ChatClan SaaS Platform

ChatClan is a WhatsApp SaaS platform converted from the supplied HTML prototypes into a Node.js application with MariaDB-ready persistence.

## Recommended Stack

Node.js + Express + MariaDB is the recommended stack for this product on Host Africa DirectAdmin. The reasoning is documented in `docs/tech_stack_decision.md`.

## Run Locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The app runs with demo data if `DB_HOST` is empty.

Campaign dispatch is quota-gated with `DISPATCH_TENANT_PER_MINUTE` and `DISPATCH_PHONE_PER_MINUTE`. Keep `META_SEND_MODE=mock` for localhost and staging checks unless you intentionally want to send real WhatsApp messages.

Inbox first-response SLA labels use `INBOX_FIRST_RESPONSE_SLA_MINUTES` and real-time inbox updates use a same-node Server-Sent Events stream. Use a shared event bus before running multiple app instances.

Run the worker in a second terminal when using MariaDB-backed queues:

```powershell
npm run worker
```

For a one-batch local check:

```powershell
npm run worker:once
```

## Beta Smoke Check

Start the app, then run the beta smoke command from a second terminal:

```powershell
npm run smoke:beta
```

By default it is read-only: it checks `/health`, `/ready`, anonymous access blocking, demo/admin login, setup wizard, templates, flows, billing, analytics, inbox, consent audit, Meta integration status, and POPIA deletion-request listing.

To point it at another environment:

```powershell
$env:SMOKE_BASE_URL = "https://staging.chatclan.co.za"
$env:SMOKE_EMAIL = "admin@example.co.za"
$env:SMOKE_PASSWORD = "your-password"
npm run smoke:beta
```

For localhost or a disposable staging tenant, enable write checks:

```powershell
$env:SMOKE_WRITE = "true"
npm run smoke:beta
```

Write mode creates a throwaway contact and campaign, prepares recipients, and queues one dispatch through the existing mock/live-gated dispatch path. Keep `SMOKE_WRITE` off for production unless the credentials belong to a dedicated smoke-test tenant.

## Production Preflight

After configuring the production `.env`, run:

```powershell
npm run ops:preflight
```

The preflight fails on missing or unsafe production settings for the app URL, session secret, encryption key, MariaDB, SMTP, Meta WhatsApp, PayFast, worker quotas, and dispatch limits. It also warns when Meta cost rates are still zero and need operator confirmation against the current Meta rate card.

For a local release-candidate gate before deployment:

```powershell
npm run ops:release-candidate
```

This runs the syntax checks and unit suite, then prints the deployment-only gates that still need production environment variables, database access, and vendor credentials.

## Startup Check

After the deployed app and worker are running, verify both startup paths with:

```powershell
$env:STARTUP_BASE_URL = "https://your-domain.co.za"
npm run ops:startup-check
```

The startup check calls `/health` and `/ready`, verifies the worker-side database/queue path, and runs `worker.runOnce` with `STARTUP_WORKER_LIMIT=0` by default so it does not process queued jobs. Set `STARTUP_WORKER_LIMIT=1` only when you intentionally want to process one due job.

## Vendor Checks

After startup, verify configured vendor integrations with:

```powershell
$env:VENDOR_BASE_URL = "https://your-domain.co.za"
$env:VENDOR_EMAIL = "admin@example.co.za"
$env:VENDOR_PASSWORD = "your-password"
$env:VENDOR_REQUIRE_SMTP = "true"
npm run ops:vendor-check
```

The current vendor check authenticates as an owner/admin and calls the protected SMTP verification endpoint. `VENDOR_REQUIRE_SMTP=true` makes the command fail if the deployed app is still in mock mail mode.

To verify Meta webhook registration and authenticated integration status without sending a WhatsApp message:

```powershell
$env:VENDOR_BASE_URL = "https://your-domain.co.za"
$env:VENDOR_EMAIL = "admin@example.co.za"
$env:VENDOR_PASSWORD = "your-password"
$env:VENDOR_CHECKS = "meta"
$env:VENDOR_META_VERIFY_TOKEN = "your-meta-webhook-verify-token"
$env:VENDOR_REQUIRE_META_CONNECTED = "true"
npm run ops:vendor-check
```

Use `VENDOR_CHECKS="smtp,meta"` to run both vendor checks together.

To verify PayFast checkout generation:

```powershell
$env:VENDOR_BASE_URL = "https://your-domain.co.za"
$env:VENDOR_EMAIL = "admin@example.co.za"
$env:VENDOR_PASSWORD = "your-password"
$env:VENDOR_CHECKS = "payfast"
$env:VENDOR_REQUIRE_PAYFAST_MODE = "live"
npm run ops:vendor-check
```

For local or PayFast sandbox testing with `PAYFAST_CONFIRM_SERVER=false`, enable a simulated signed ITN:

```powershell
$env:VENDOR_PAYFAST_SIMULATE_ITN = "true"
npm run ops:vendor-check
```

Use `VENDOR_CHECKS="smtp,meta,payfast"` to run the full vendor suite.

To verify WhatsApp commerce automation template readiness after Meta template sync:

```powershell
$env:VENDOR_BASE_URL = "https://your-domain.co.za"
$env:VENDOR_EMAIL = "admin@example.co.za"
$env:VENDOR_PASSWORD = "your-password"
$env:VENDOR_CHECKS = "commerce"
$env:VENDOR_REQUIRE_COMMERCE_AUTOMATION_READY = "true"
npm run ops:vendor-check
```

The commerce check calls the authenticated automation insights endpoint and fails in strict mode when any enabled post-purchase automation is still missing an approved WhatsApp template. This protects proactive WhatsApp commerce sends that may occur outside the 24-hour customer-service window.

## Configure MariaDB

1. Copy `.env.example` to `.env`.
2. Fill in `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
3. Import `database/schema.sql`.
4. Import `database/seed.sql`.
5. Run `npm run db:verify`.

`db:verify` connects with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`, then confirms every table from `database/schema.sql` exists. It also warns if no bootstrap business, user, or membership records are present.

To create an app-level SQL backup:

```powershell
npm run db:backup
```

Backups are written to `backups/` by default and ignored by git. Use `DB_BACKUP_DIR` for a secure off-web-root location. Restore-drill steps are documented in `docs/backup_restore_runbook.md`.

## Useful Routes

- `/`: ChatClan web app
- `/docs`: implementation documentation landing page
- `/health`: health check
- `/ready`: readiness check, including database status when configured
- `/api/dashboard`: dashboard JSON
- `/api/auth/password-reset/request`: request a password reset token/link
- `/api/auth/password-reset/confirm`: confirm password reset
- `/api/users`: manage workspace users
- `/api/integrations/email/verify`: verify mock/SMTP mail delivery configuration
- `/api/integrations/meta/onboarding`: Embedded Signup readiness, credential, and webhook status
- `/api/integrations/meta/onboarding/config`: Meta Embedded Signup launch configuration
- `/api/integrations/meta/assets/health`: WABA and phone asset health/status checks
- `/api/integrations/meta/business-profile`: read/update the public WhatsApp Business Profile
- `/api/integrations/meta/onboarding/complete`: exchange/save Embedded Signup result
- `/api/integrations/meta/webhooks/subscribe`: subscribe the WABA to message/template webhooks
- `/api/integrations/meta/phone/register`: register the connected WhatsApp phone number with Cloud API
- `/api/billing`: subscription and invoice overview
- `/api/billing/plans`: available ChatClan plans
- `/api/billing/payfast/checkout`: create a signed PayFast subscription checkout
- `/api/templates/library`: 19-industry template library
- `/api/templates`: manage workspace templates
- `/api/templates/:id/submit-meta`: mock/live submit a workspace template to Meta
- `/api/templates/sync-meta`: mock/live sync workspace template statuses from Meta
- `/api/chatbot/templates`: 19-industry chatbot flow template library
- `/api/chatbot/flows`: workspace chatbot flows
- `/api/chatbot/templates/:id/duplicate`: duplicate a template into the workspace
- `/api/chatbot/flows/:id/publish`: publish a validated flow
- `/api/chatbot/flows/:id/simulate`: run test-mode flow simulation
- Published chatbot flows are executed from inbound Meta webhooks when trigger keywords match. Runtime sessions are persisted in `chatbot_sessions` when MariaDB is configured and remain mock-safe locally unless `META_SEND_MODE=live`.
- `/api/commerce/analytics`: revenue, order, payment, and low-stock summary for WhatsApp commerce
- `/api/commerce/inventory-alerts`: low-stock and out-of-stock products for fulfilment planning
- `/api/commerce/coupons`: create and list WhatsApp commerce coupon codes
- `/api/commerce/abandoned-carts`: list unpaid orders ready for WhatsApp cart recovery
- `/api/commerce/returns`: list return and refund requests
- `/api/commerce/customer-segments`: derived buyer segments such as first-time, repeat, VIP, follow-up, and at-risk
- `/api/commerce/automation-rules`: list and tune subscriber post-purchase automation rules
- `/api/commerce/automation-insights`: summarize scheduled, sent, attributed order, revenue, estimated cost, ROI, recent activity, and recommended next actions for post-purchase automations
- `/api/commerce/automation-rules/:id/preview`: preview matching and already scheduled orders before changing an automation rule
- `/api/commerce/automation-rules/:id/apply-ready`: schedule one automation rule for all currently eligible unscheduled orders
- `/api/commerce/products`: manage tenant product catalogue entries for WhatsApp selling
- `/api/commerce/products/import`: preview or commit CSV bulk product imports for WhatsApp catalogues
- `/api/commerce/products/:id`: update product details, pricing, stock, and Meta catalog identifiers
- `/api/commerce/products/:id/archive`: archive a product without deleting order history
- `/api/commerce/products/:id/variants`: manage product variants such as size, colour, SKU, and stock
- `/api/commerce/collections`: create and list curated product collections for WhatsApp sharing
- `/api/commerce/collections/:id`: inspect collection products and retailer IDs
- `/api/commerce/collections/:id/share`: send/mock a focused collection to a WhatsApp customer
- `/api/commerce/orders`: list or create WhatsApp commerce orders
- `/api/commerce/orders/:id`: inspect order items, payment state, and timeline events
- `/api/commerce/orders/:id/payment-link`: create a PayFast/Yoco/Ozow/custom payment link for an order
- `/api/commerce/orders/:id/coupon`: apply a coupon to an order before payment
- `/api/commerce/orders/:id/items/link-product`: link an unmatched WhatsApp catalog order item to a local product
- `/api/commerce/orders/:id/items/create-product`: create a draft product from an unmatched WhatsApp catalog order item and link it
- `/api/commerce/orders/:id/fulfilment`: add courier/tracking details and optionally notify the customer
- `/api/commerce/orders/:id/send-payment-link`: send/mock a WhatsApp order details payment message
- `/api/commerce/orders/:id/recover-cart`: send/mock a WhatsApp recovery payment message for an unpaid cart
- `/api/commerce/orders/:id/reconcile-payment`: manually reconcile a received payment against an order
- `/api/commerce/orders/:id/returns`: open a return or refund request for a paid order
- `/api/commerce/returns/:id`: update return/refund status, notes, and refund references
- `/api/commerce/orders/:id/post-purchase`: send/mock WhatsApp review, reorder, or follow-up prompts
- `/api/commerce/orders/:id/schedule-post-purchase`: queue post-purchase WhatsApp prompts through the worker
- `/api/commerce/orders/:id/apply-automation-rules`: apply enabled post-purchase automation rules to an order
- `/api/commerce/orders/:id/status`: update order status and optionally notify the customer
- `/api/commerce/orders/:id/send-status`: send/mock a WhatsApp order status update
- `/api/commerce/share-catalog`: send/mock a Meta catalog or product carousel message to a customer
- `/api/commerce/catalog-sync/preview`: validate products and build the Meta catalog `items_batch` payload
- `/api/commerce/catalog-sync`: mock/live-gated push of product items to a Meta catalog when `META_CATALOG_MODE=live`
- `/api/analytics/overview`: campaign delivery/read/reply summary
- `/api/analytics/costs`: Meta cost report, preferring reconciled delivery ledger entries
- `/api/analytics/meta-rate-cards`: active configured Meta rate cards
- `/api/analytics/meta-rate-cards/sync`: sync active rate cards from environment configuration
- `/api/inbox/conversations`: unified inbox conversation list
- `/api/inbox/events`: real-time inbox Server-Sent Events stream
- `/api/inbox/conversations/:id`: unified inbox conversation history
- `/api/inbox/conversations/:id/replies`: send/mock an agent reply and persist it
- `/api/inbox/conversations/:id/notes`: list or create internal notes
- `/api/inbox/conversations/:id/typing`: publish typing indicator events
- `/api/inbox/conversations/:id/csat`: record conversation CSAT
- `/api/campaigns`: create campaign
- `/api/campaigns/:id/recipients/prepare`: prepare opted-in campaign recipients
- `/api/campaigns/:id/recipients`: inspect campaign recipient delivery states
- `/api/campaigns/:id/dispatch`: queue campaign dispatch
- `/api/contacts`: create contact
- `/api/contacts/import`: validate or commit CSV contact import
- `/api/messages/send-test`: send/mock a Meta WhatsApp text message
- `/webhooks/meta`: Meta webhook verification and inbound events
- `/webhooks/payfast/itn`: PayFast ITN endpoint
