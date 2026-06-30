# ChatClan Execution Plan

## Product Source Of Truth

This execution plan is governed by:

- `docs/ChatClan_PRD_v2.md`: product requirements, roadmap, non-functional requirements, QA strategy, go-to-market, and open questions.
- `docs/design/chatclan-design-system.md`: visual design system.
- `html_interface/wazify_saas_platform.html`: marketing/app UI blueprint.
- `html_interface/wazify_billing.html`: billing and SA payment-provider UX reference.
- `html_interface/whatsapp_cloud_api_chatbot.html`: Meta Cloud API payload and webhook reference.
- `html_interface/whatsapp_chatbot_flow.html`: chatbot simulator reference.
- `html_interface/whatsapp_chatbot_flow_diagram.html`: 19-industry flow hierarchy reference.
- `context/claude_text.md`: earlier product exploration and feature inventory.

## Product Strategy From PRD v2

ChatClan is a South African-first, multi-tenant WhatsApp Business API SaaS platform for SMEs and agencies. Year 1 scope is WhatsApp Cloud API only, South African market only, browser dashboard only, and SME/agency tiers only.

Primary differentiators:

- ZAR pricing and South African payment providers.
- POPIA-native consent and audit workflows.
- Meta WhatsApp Cloud API connection without developer setup.
- 19-industry templates for local business contexts.
- Agency/reseller expansion path.

## Phase 1: Foundation, Months 1-3

Goal: a sellable, safe, stable beta product for 20 invited South African businesses.

P0 scope:

1. User authentication and account management.
2. Tenant isolation through businesses, users, memberships, and sessions.
3. Meta WABA connection wizard and encrypted credential storage.
4. Contact database with POPIA opt-in status.
5. CSV contact import with column mapping, duplicate detection, validation, and import history.
6. POPIA opt-in audit log and STOP suppression.
7. Template manager and 19-industry template library.
8. Campaign builder for single broadcasts.
9. Campaign recipient/send status schema.
10. Basic analytics: sent, delivered, read, replied per campaign.
11. Unified inbox with basic multi-agent support.
12. PayFast subscription billing and ITN lifecycle.
13. Meta cost report.

Go/no-go for Phase 2:

- At least 15 beta businesses actively using the platform.
- Zero P0 bugs.
- Setup wizard completion rate at least 65%.
- Critical PRD test scenarios pass.

## Phase 1 Progress

Completed:

- Real Node.js/Express application scaffold.
- MariaDB-ready schema and demo-data fallback.
- ChatClan rename and central brand config.
- Claude-aligned landing page and design-system-oriented CSS.
- Security headers, request IDs, readiness checks, graceful shutdown.
- Authentication/session foundation.
- Tenant-scoped writes and authenticated dashboard reads for protected APIs.
- Encrypted tenant-scoped Meta credentials.
- Meta webhook verification/event extraction.
- PayFast ITN signature helpers.
- Contact import pipeline with opt-in enforcement.
- POPIA consent audit log and STOP suppression.
- Campaign recipient preparation with opted-out contact exclusion.
- Bounded mock-safe broadcast dispatch from prepared recipients.
- MariaDB-backed queue/worker foundation for campaign dispatch and webhooks.
- Tenant user management and password reset token lifecycle.
- Template manager and 19-industry library.
- Basic analytics and configurable Meta cost reporting.
- Unified inbox persistence with conversations, messages, assignment, resolution, and agent replies.
- Mock-safe/live-gated Meta template submission and status sync.
- Mock/SMTP email delivery for password reset and team invite messages.
- PayFast subscription checkout, signed ITN reconciliation, subscription status, and invoice records.
- Configurable per-tenant and per-phone-number campaign dispatch rate limits.
- Meta delivery/read/failed status webhooks update inbox messages and campaign recipients.
- Unified inbox real-time updates, internal notes, first-response SLA metadata, typing indicators, and CSAT tracking.
- Meta rate-card sync from configured rates and delivery-cost ledger reconciliation from status webhooks.
- Chatbot flow builder foundation with 19 industry templates, editable definitions, publish validation, and test-mode simulation.
- Chatbot runtime execution from inbound Meta webhooks with session persistence, bot replies, and handoff notes.
- Setup/onboarding wizard hardening with resumable six-step progress tracking, Meta verification guidance, and activation hooks for credentials, templates, contacts, and test messages.
- POPIA data deletion request workflow that redacts contact, inbox, message, note, and campaign-recipient data while retaining a masked audit trail.
- Beta release QA route-gate hardening for campaign/contact mutation paths and middleware coverage for anonymous/non-admin access.
- Repeatable beta smoke command covering health/readiness, auth, critical read APIs, and optional write-mode campaign/contact flow checks.
- Test suite using `node:test`.
- `AGENT.md` project guide.
- Production preflight and deployment checklist for environment, vendor, and operational readiness checks.
- MariaDB deployment verification command that confirms the imported schema tables exist before app/worker startup.
- App/worker startup verification command for post-restart health, readiness, DB queue access, and zero-work worker boot checks.
- Authenticated SMTP vendor acceptance command that confirms the deployed app is not still in mock mail mode.
- Non-sending Meta vendor acceptance checks for webhook verification and authenticated integration status.
- PayFast vendor acceptance checks for signed checkout generation and optional controlled simulated ITN processing.
- Release-candidate command that runs local gates and prints deployment-only production gates.
- Database backup command and restore runbook aligned to the PRD daily-backup, 30-day-retention, monthly-restore-drill requirement.
- WhatsApp commerce foundation with tenant product catalogues, product variants, inventory tracking, Meta catalog/carousel share payloads, order tables, payment-link order details messages, order status updates, commerce analytics, manual order creation, and inbound WhatsApp order webhook capture.

In progress now:

- Final manual go-live gate review for real hosted environment, vendor dashboards, process supervision, domain/TLS, and first beta tenant readiness.

## Phase 2: Engagement, Months 4-6

Goal: retention and value expansion after beta.

Scope:

- Visual chatbot flow builder with 19 industry templates.
- Automation rules engine.
- Advanced segmentation.
- Meta cost reporting improvements.
- Ozow and Yoco payment support.
- In-app guided tours.
- QR code and opt-in widget generator.
- A/B campaign testing.

## Phase 3: Revenue Expansion, Months 7-12

Goal: increase ARPA and open reseller channel.

Scope:

- Agency and reseller portal.
- White-label mode.
- Shopify and WooCommerce integrations.
- Zapier and Make connector.
- Advanced analytics and revenue attribution.
- AI copy assistant.
- Flow testing mode.
- Drip sequences.
- Afrikaans and Zulu support.
- Netcash and Peach Payments support.

## Phase 4: Scale, Year 2+

Scope:

- WhatsApp Calling API.
- WhatsApp Flows native form builder.
- Business Scoped User ID support.
- Mobile app.
- Expansion to Nigeria, Kenya, and Zimbabwe.

## Technical Standards

- Node.js 20+.
- Express 5 modular routing.
- MariaDB through `mysql2/promise`.
- Server-rendered UI until a frontend build step is clearly justified.
- No browser localStorage for secrets.
- Encrypted credential storage for tenant tokens.
- Tenant-scoped queries for all customer data.
- Webhooks acknowledge quickly and record events for async processing.
- All POPIA-relevant actions must create audit records.
- Every P0 feature needs unit tests and localhost-verifiable API/UI paths.

## QA Strategy From PRD

Critical release scenarios:

1. New user completes setup and sends a test message in under 10 minutes.
2. Campaign to 1,000 contacts excludes all opted-out contacts.
3. Customer replies STOP and is suppressed within 60 seconds.
4. Chatbot escalates to human agent with full conversation history.
5. Failed PayFast payment triggers retry/downgrade sequence.
6. Data deletion request propagates within 24 hours.
7. Two tenants cannot see each other's data.

Definition of done:

- Acceptance criteria pass.
- Unit coverage for the feature target is at least 80%.
- No P0/P1 bugs.
- Happy-path E2E exists or is manually documented until automated E2E is added.
- Empty, loading, success, error, and disabled states are implemented.
- POPIA-relevant features reviewed against compliance requirements.

## Skills And Capabilities Needed

- `browser:control-in-app-browser`: visual QA of localhost UI when connector is working.
- `spreadsheets:Spreadsheets`: CSV/contact-import test fixture analysis or generated import samples when needed.
- Context7 MCP: current package documentation before adopting or changing package APIs.
- Official vendor documentation: Meta, PayFast, Ozow, Yoco, Peach, PayGate, Netcash, Shopify/WooCommerce/Zapier/Make as integrations are implemented.

## DirectAdmin Deployment Outline

1. Create MariaDB database and user in DirectAdmin.
2. Import `database/schema.sql`, then `database/seed.sql`.
3. Upload project files.
4. Configure DirectAdmin Node.js app:
   - Application root: project folder
   - Startup file: `src/server.js`
   - Node version: 20 or newer
5. Configure a second DirectAdmin Node.js app or supervised Node process for the worker:
   - Application root: project folder
   - Startup file: `src/worker.js`
   - Node version: 20 or newer
6. Set environment variables from `.env.example`.
7. Configure `MAIL_MODE=smtp` and verify `SMTP_*` settings with `GET /api/integrations/email/verify`.
8. Run `npm install`.
9. Run `npm run check`, `npm test`, `npm run ops:preflight`, and `npm run db:verify`.
10. Start or restart Node.js application and worker.
11. Configure Meta webhook URL: `https://your-domain.co.za/webhooks/meta`.
12. Configure PayFast ITN URL: `https://your-domain.co.za/webhooks/payfast/itn`.
13. Run `npm run ops:startup-check` with `STARTUP_BASE_URL` pointed at the deployed domain.
14. Run `npm run ops:vendor-check` with `VENDOR_REQUIRE_SMTP=true`.
15. Run `npm run smoke:beta` against the deployed domain with production smoke credentials.

## Open Product Decisions To Track

- BSP status vs. partner BSP for Phase 1.
- Email-only vs. phone OTP verification at signup.
- Starter plan POPIA Compliance Centre scope.
- Accountable Information Officer under POPIA.
- Growth vs. Starter as the 14-day trial tier.
- SA data centre provider and data residency commitment.
