# ChatClan — Product Requirements Document

**Version:** 2.16
**Date:** July 2026
**Status:** Revised Draft
**Prepared by:** Product Team
**Changelog:** v2.16 — Added tenant-managed OAuth CRM integrations for HubSpot, Salesforce, Zoho CRM, and Pipedrive with field mapping, durable contact synchronisation, health history, scheduling, and failure recovery.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Market Opportunity](#3-market-opportunity)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Product Vision & Strategy](#5-product-vision--strategy)
6. [Target Users & Personas](#6-target-users--personas)
7. [Platform Architecture Overview](#7-platform-architecture-overview)
8. [Feature Requirements](#8-feature-requirements)
9. [Technical & Non-Functional Requirements](#9-technical--non-functional-requirements)
10. [Billing & Monetisation](#10-billing--monetisation)
11. [Compliance & Legal Requirements](#11-compliance--legal-requirements)
12. [Success Metrics & KPIs](#12-success-metrics--kpis)
13. [Roadmap & Phasing](#13-roadmap--phasing)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Appendix](#15-appendix)
16. [UX & Design Requirements *(new)*](#16-ux--design-requirements)
17. [QA & Testing Strategy *(new)*](#17-qa--testing-strategy)
18. [Go-to-Market Plan *(new)*](#18-go-to-market-plan)
19. [Open Questions & Decisions Log *(new)*](#19-open-questions--decisions-log)
20. [Document Changelog *(new)*](#20-document-changelog)

---

## 1. Executive Summary

ChatClan is a South African-first WhatsApp Business API SaaS platform that enables small and medium-sized businesses (SMEs) to build, send, and automate WhatsApp marketing campaigns, customer support flows, and chatbot experiences — without writing a single line of code.

The platform is built on top of the Meta WhatsApp Cloud API and delivered as a multi-tenant SaaS product. Businesses pay a monthly subscription to ChatClan for platform access, and pay Meta directly for their message volume. ChatClan earns 100% of the subscription fee with no cost of goods beyond infrastructure.

South Africa is an exceptionally strong first market: 96% of internet users are active on WhatsApp, WhatsApp penetration is expected to reach 28 million users by end of 2026, and the country ranks among Meta's explicit priority markets for authentication and utility pricing reductions. No locally-built, POPIA-native, South-African-payment-integrated WhatsApp SaaS platform currently exists at the SME tier.

**The opportunity:** A platform purpose-built for the South African SME — priced in ZAR, paying via PayFast or Ozow, guided by POPIA compliance, and speaking the language of local business — is a structurally underserved product gap.

**Scope statement (in/out):**

| In Scope (Year 1) | Out of Scope (Year 1) |
|---|---|
| WhatsApp Cloud API only | SMS, email, or other channels |
| South African market | Nigeria, Kenya, Zimbabwe (Year 2) |
| SME and agency tiers | Enterprise custom contracts |
| Web dashboard | Native mobile app (roadmap Phase 4) |
| Managed BSP or bring-your-own WABA | On-premises WhatsApp deployment |

---

## 2. Problem Statement

### 2.1 The Core Pain

South African small businesses know WhatsApp is their most important customer communication channel. They use it daily. But they manage it with a single phone, a single SIM, and zero automation. The result:

- Campaigns sent manually from an owner's personal handset
- Contacts stored in a spreadsheet or notebook
- Replies missed because only one person has the number
- Zero analytics on what campaigns worked
- Zero ability to recover abandoned inquiries automatically
- No opt-in tracking — meaning POPIA exposure

### 2.2 The Tool Gap

Enterprise WhatsApp API platforms (Twilio, Infobip, Bird) exist but are priced for large organisations, billed in USD, and require developer integrations. Consumer tools (WhatsApp Business App) lack broadcast templates, automation, and multi-agent inboxes. The mid-market SaaS alternatives (Wati, Respond.io, Zoko) are priced in USD with credit card payments, offer no ZAR billing, and are not POPIA-aware by design.

ChatClan fills this gap: a platform that feels native to a Cape Town salon, a Johannesburg restaurant, a Durban logistics company — priced in ZAR, accepted by PayFast, and designed to operate within South African law.

### 2.3 Validated Assumptions *(new)*

The following assumptions underpin the problem statement. These should be validated during the beta phase and revisited before Phase 2 investment:

| Assumption | Validation Method | Target Date |
|---|---|---|
| SA SMEs are willing to pay R299–R799/month for WhatsApp automation | Pre-sales interviews with 50 SMEs; 14-day trial conversion data | Month 3 |
| POPIA compliance is a meaningful purchasing trigger, not just a hygiene factor | Survey 100 trial users — rank purchase drivers | Month 3 |
| ZAR billing alone meaningfully reduces sign-up friction vs. USD tools | A/B test pricing page with ZAR vs. ZAR equivalent | Month 2 |
| Businesses can self-serve WABA connection without support intervention | Track setup wizard completion rate; target >70% | Month 1 |

---

## 3. Market Opportunity

### 3.1 Global Context

The WhatsApp Business API Platform market was valued at **$8.2 billion in 2025** and is projected to reach **$38.6 billion by 2034**, growing at a compound annual rate of approximately 18.8%. Cloud-deployed solutions captured 71.3% of this market in 2025. The surge is driven by conversational commerce growth, a global WhatsApp user base now exceeding 3.3 billion monthly active users, and Meta's continued expansion of business messaging infrastructure.

As of Q1 2026, 91% of all conversational AI interactions on major platforms (per Infobip's Messaging Trends Report 2026) took place on WhatsApp, signalling the channel's dominance as the default layer for AI-powered customer engagement.

### 3.2 South Africa Specifically

South Africa is one of the world's highest-penetration WhatsApp markets:

- **96% of internet users** are on WhatsApp — among the highest rates globally
- WhatsApp user base expected to reach **28 million by end 2026** (Statista)
- South Africa was among the first markets where Meta **lowered authentication pricing** specifically, signalling its commercial importance to Meta
- The country has been named in the top 10 global WhatsApp spending markets, alongside India, Brazil, Germany, and Mexico
- **WhatsApp growth on the Infobip platform** in Africa was 16% year-over-year in 2025, with Southern Africa leading

Beyond pure penetration, South Africa has structural commercial drivers that make it ideal for a ChatClan launch:

- A large, underserved SME economy (approximately 2.5 million registered SMEs, per the DSBD) that generates over 60% of GDP but is served poorly by international SaaS tools
- An active POPIA enforcement posture as of 2026, creating a compliance wedge for a locally-built platform
- A maturing digital payment ecosystem with PayFast, Ozow, Peach Payments, Yoco, and Netcash offering subscription-grade infrastructure for ZAR billing
- High mobile-first usage, meaning WhatsApp is not a secondary channel but the primary channel of commerce for most SA SMEs

### 3.3 Addressable Market

| Segment | Description | Estimated SA Size |
|---------|-------------|-------------------|
| Micro & small businesses (1–10 employees) | Primary target — salons, restaurants, retailers, service providers | ~1.8M businesses |
| Medium businesses (11–100 employees) | Secondary target — agencies, logistics, healthcare practices | ~400K businesses |
| Marketing agencies & resellers | Agency portal customers who manage multiple client accounts | ~15K agencies |

At an average monthly revenue of R600 per customer (blended across plans), even a 0.5% penetration of the primary segment represents ~R54M in ARR.

---

## 4. Competitive Landscape

### 4.1 Global Competitors

| Platform | Positioning | Pricing | Key Weakness vs ChatClan |
|----------|------------|---------|--------------------------|
| **Wati** | SMB WhatsApp API platform | From $34.99/mo (USD) | USD billing, no ZAR, no POPIA, no SA payment providers |
| **Respond.io** | Mid-market omnichannel | Custom (mid-to-high) | Enterprise-grade pricing, USD, complex onboarding |
| **Zoko** | Shopify-first commerce | USD-based | Shopify-centric, not relevant to most SA SMEs |
| **Twilio** | Developer API platform | Pay-as-you-go + $0.005/msg | Requires technical teams, no packaged product |
| **AiSensy** | India-focused broadcast | From ~$21/mo (USD) | India-market design, USD, no SA context |
| **Bird (MessageBird)** | Enterprise messaging | From $45/mo + usage | Enterprise, USD, complex, no SA localisation |
| **Gupshup** | Large-enterprise BSP | Volume contracts | Built for enterprises, not SMEs |
| **Brevo** | Email-first with WhatsApp add-on | Freemium, USD | Email-centric, WhatsApp secondary, no SA context |
| **ChatMaxima** | SMB broadcast platform | Freemium | No SA payments, USD, limited automation |

### 4.2 Local Context

No purpose-built South African WhatsApp marketing SaaS exists at the SME level. The closest adjacent products are:

- **BizAI Smart CRM** — a general POPIA-compliant CRM starting at R499/month, not WhatsApp-first
- **General WhatsApp Business App** — free from Meta, used by most SA SMEs, but completely manual
- **Local digital agencies** — offer custom WhatsApp setups but at R10,000+ build costs

### 4.3 ChatClan's Competitive Advantages

1. **ZAR pricing and ZAR billing** — the only WhatsApp SaaS product priced and billed in South African Rand
2. **Six SA payment providers** — PayFast, Ozow, Peach Payments, PayGate, Yoco, Netcash
3. **POPIA compliance built in** — consent tracking, audit log, opt-out management, and a POPIA Compliance Centre
4. **19 industry templates** — pre-built chatbot flows for South African business contexts (healthcare in Johannesburg, restaurants in Cape Town, logistics in Durban)
5. **No technical setup required** — campaign builder, flow builder, and inbox all accessible in a single browser tab
6. **Local language support** — roadmap for Afrikaans, Zulu, Xhosa

### 4.4 Competitive Risk Scenarios *(new)*

| Scenario | Probability | Response Strategy |
|---|---|---|
| Wati adds ZAR billing and SA payment methods | Medium (12–18 months) | Accelerate POPIA-native features and local brand trust; structural compliance moat is harder to copy |
| Meta launches its own hosted SME product | Low | Differentiate on local compliance, local support, and integration depth |
| A funded SA-based competitor launches | Medium | First-mover network effects; lock in agency channel early; community and brand |

---

## 5. Product Vision & Strategy

### 5.1 Vision Statement

To be the WhatsApp operating system for South African small business — the tool that powers every customer conversation, from first contact to repeat purchase, completely inside WhatsApp.

### 5.2 Strategic Pillars

**Pillar 1 — Zero friction onboarding.** A business owner should be sending their first real campaign within 20 minutes of signing up, with no developer help required.

**Pillar 2 — POPIA-native compliance.** Every data collection point, opt-in, and broadcast is compliance-aware by default. ChatClan should be the safest way to run WhatsApp marketing in South Africa.

**Pillar 3 — Revenue attribution.** ChatClan should close the loop between a WhatsApp message sent and a sale made, giving SME owners the ROI proof they need to justify continued spend.

**Pillar 4 — Agency leverage.** An agency portal that allows resellers and marketing agencies to manage dozens of client accounts from a single dashboard, creating a high-LTV B2B2SMB channel.

**Pillar 5 — AI-assisted, not AI-dependent.** AI features assist the business owner and agent inside defined business workflows: smart replies, copy suggestions, flow generation, intent classification, product/service recommendations, and summarisation. ChatClan is not a general-purpose AI chatbot distributed through WhatsApp. AI must remain ancillary to the customer's business messaging use case, with deterministic fallbacks and human handoff.

### 5.3 Strategic Bets & Non-Bets *(new)*

| We are betting on… | We are NOT betting on… |
|---|---|
| WhatsApp remaining the dominant SA SME channel through 2027 | Omnichannel (SMS, email, Instagram) in Year 1 |
| POPIA enforcement creating a compliance premium | Competing on raw feature count vs. global tools |
| Agencies as a high-LTV acquisition channel | Direct enterprise sales motion in Year 1 |
| ZAR pricing reducing international tool substitution | Pure price leadership below R299/month |

---

## 6. Target Users & Personas

### Persona 1 — Zinhle, the Boutique Owner (Primary)

- **Profile:** 34-year-old owner of a clothing boutique in Soweto with 2 staff. Manages all marketing personally from her smartphone.
- **Current behaviour:** Posts on Instagram and sends WhatsApp messages manually to a list of ~400 customers saved in her phone contacts.
- **Pain:** She forgets to follow up, misses messages when busy, and cannot tell which campaigns drove sales.
- **What she wants:** Send a promotion to all her customers at once, have the bot answer common questions about stock, and see which messages led to purchases.
- **Willingness to pay:** R299–R499/month if the tool clearly saves her time.
- **Technical comfort:** Uses Canva, Instagram, WhatsApp — no coding.
- **Critical journey moments:** First campaign sent; first automated reply fires while she is with a customer; first analytics report showing a sale.
- **Definition of success:** She sends a specials broadcast on Friday morning and 3 customers purchase before noon — without her touching her phone.

### Persona 2 — Sipho, the Restaurant Manager (Primary)

- **Profile:** 41-year-old manager of a 60-seat restaurant in Cape Town. Handles bookings, promotions, and staff communication.
- **Current behaviour:** Uses WhatsApp to confirm bookings manually. Gets 20–30 daily WhatsApp messages that require manual replies.
- **Pain:** He cannot be available 24/7. Messages pile up on weekends. He has no system for sending specials or recovering no-shows.
- **What he wants:** A chatbot that handles table booking via WhatsApp, automated reminders, and a weekly specials broadcast.
- **Willingness to pay:** R499–R799/month for a tool that reduces manual work.
- **Technical comfort:** Uses WhatsApp daily, comfortable with simple software.
- **Critical journey moments:** First booking confirmed by bot without his input; first no-show reminder sent automatically.
- **Definition of success:** Saturday reservations handled by the chatbot while he manages the floor.

### Persona 3 — Thandeka, the Marketing Agency Owner (Growth)

- **Profile:** 38-year-old founder of a digital marketing agency in Johannesburg managing 12 SME clients.
- **Current behaviour:** Sets up WhatsApp campaigns manually for each client, using a mix of personal phone numbers and one shared WhatsApp Business account.
- **Pain:** No central dashboard. Clients ask for reports she cannot easily generate. Cannot scale beyond 12 clients without hiring.
- **What she wants:** A white-label reseller portal where she can add clients, manage their campaigns, and bill them under her own brand.
- **Willingness to pay:** R1,999/month for the Pro tier or a white-label agency plan at a monthly seat price.
- **Critical journey moments:** Onboarding her first client sub-account; generating the first client-branded report.

### Persona 4 — Dev, the Internal IT Manager (Enterprise)

- **Profile:** 44-year-old IT manager at a 200-person logistics company in Durban. Manages customer communication systems.
- **Current behaviour:** Has a WhatsApp Business App account but no integration with the company's order tracking system.
- **What he wants:** API access to send automated dispatch notifications, delivery updates, and exception alerts from the company's existing systems.
- **Willingness to pay:** R1,999+/month for API access and dedicated support.
- **Critical journey moments:** First webhook from their OMS triggers a WhatsApp message to a customer.

### Persona Pain/Gain Map *(new)*

| Persona | #1 Pain Today | #1 Gain from ChatClan | Risk of Churn |
|---|---|---|---|
| Zinhle | Manual one-by-one messaging | Campaign automation in <20 min | Low engagement; sees no sales uplift |
| Sipho | Weekend message pile-up | 24/7 booking bot | Bot gives wrong table availability |
| Thandeka | Client switching costs and reporting | White-label portal | ChatClan brand visible to her clients |
| Dev | No OMS-to-WhatsApp bridge | Webhook integration | API reliability and uptime SLA |

---

## 7. Platform Architecture Overview

### 7.1 Technical Architecture

ChatClan is a multi-tenant SaaS platform built on three layers:

**API Gateway Layer** — ChatClan connects to the Meta WhatsApp Cloud API (`graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`) on behalf of each business's registered WhatsApp Business Account (WABA). Each tenant has their own WABA, phone number, and API credentials stored encrypted.

**Application Layer** — A web-based dashboard (accessible via browser on desktop and mobile) providing the campaign builder, flow builder, inbox, contacts, analytics, billing, and settings modules.

**Webhook Processing Layer** — A real-time webhook receiver that processes inbound messages from Meta, routes them to the correct tenant's inbox, and triggers automation rules. ChatClan's servers respond to Meta webhooks within 200ms as required by Meta's API contract.

**AI Workflow Orchestration Layer** — An optional, policy-gated layer that assists deterministic WhatsApp workflows. It classifies customer intent, drafts replies, proposes flow nodes, summarises conversations, recommends products/services from tenant-approved knowledge, and suggests human handoff. It must never operate as a standalone general-purpose AI assistant on WhatsApp. All AI outputs are scoped to the tenant's configured business purpose, customer consent state, Meta template/category rules, POPIA constraints, and confidence thresholds. The layer must be provider-neutral, with adapters for multiple LLM service providers such as OpenAI, Anthropic, Google, DeepSeek, and xAI/Grok.

### 7.2 Message Flow Architecture

**Outbound (ChatClan → Customer)**
1. Business creates campaign or automation in ChatClan dashboard
2. ChatClan checks opt-in state, service window, template category, plan limits, Meta quality risk, and AI-policy guardrails
3. If AI is enabled, ChatClan may draft or select message content, but only from an approved template or service-window-safe free-form reply path
4. ChatClan API sends `POST` request to Meta's Cloud API with the approved payload
5. Meta delivers message to customer's WhatsApp
6. Meta returns delivery and read receipts via webhook to ChatClan
7. ChatClan updates message status, cost, quality, AI outcome, and analytics in real time

**Inbound (Customer → Business)**
1. Customer sends WhatsApp message to business number
2. Meta sends webhook payload to ChatClan's webhook receiver
3. ChatClan records the message in the tenant inbox and checks STOP/opt-out, unsupported message types, commerce order payloads, and active chatbot sessions
4. If AI is enabled, the AI Workflow Orchestration Layer may classify intent and choose one of: (a) deterministic automation rule, (b) published chatbot flow, (c) AI-drafted agent reply, (d) task-specific AI workflow, or (e) human agent inbox
5. Low-confidence, sensitive, regulated, angry, or out-of-scope messages must route to human handoff
6. Response sent back via the outbound path

### 7.3 Multi-tenancy Model

Each business account on ChatClan maps to a unique WABA. ChatClan acts as a Business Solution Provider (BSP) facilitating Meta API access, or allows businesses to connect their own Meta credentials. Data is logically isolated per tenant. All South African customer data is stored in South African data centres to meet POPIA cross-border transfer requirements.

### 7.4 AI Workflow Operating Model *(new)*

ChatClan's AI layer is a tenant-configured assistant for business workflows, not an open chat destination. The default implementation must support:

- **Task-specific scope:** Each AI workflow declares a purpose such as bookings, order status, product discovery, FAQ support, lead qualification, after-sales follow-up, or agent reply drafting.
- **Provider abstraction:** AI providers are replaceable behind an internal service boundary. No product requirement may depend on one vendor name such as OpenAI, Anthropic, Google, DeepSeek, or xAI/Grok.
- **Provider routing:** The AI service must support per-tenant and per-workflow provider selection, including fallback order, cost ceiling, latency target, data residency constraints, model capability requirements, and manual disablement of any provider.
- **Provider adapters:** Each provider integration must implement the same internal contract for text generation, structured JSON output, embeddings or retrieval support where available, safety/policy metadata, timeout handling, retry behavior, token/cost tracking, and redacted logging.
- **Model portability:** Prompt templates, evaluation sets, grounding payloads, and response schemas must be stored independently from provider-specific SDKs so workflows can be migrated or A/B tested across providers without rewriting the product feature.
- **Policy gate before model call:** The system checks consent, service window, message category, tenant plan, customer sensitivity, and allowed workflow purpose before sending data to an AI provider.
- **Minimum-data prompting:** AI prompts receive the smallest useful context: current message, relevant tenant knowledge snippets, product/order metadata needed for the task, and safe conversation summary. Raw full conversation history is not sent by default.
- **No cross-tenant learning:** Tenant data and WhatsApp Business Solution data must not train, improve, or create general AI models. Fine-tuning is allowed only for a tenant-exclusive model where legally and contractually permitted.
- **Grounded answers:** Customer-facing AI replies must be generated from tenant-approved knowledge, catalog, order, booking, FAQ, or policy data. If grounding is missing, the AI must ask a clarifying question or hand off.
- **Confidence thresholds:** Each AI workflow defines thresholds for auto-reply, suggest-only, and handoff. Launch default: auto-reply only at high confidence and low-risk category; otherwise draft for human review.
- **Traceability:** Store AI decision metadata: workflow id, purpose, model/provider id, prompt template version, grounding sources, confidence, policy checks, human override, and final sent message id.
- **Human control:** Agents can edit AI drafts, disable AI per conversation, convert repeated successful replies into templates, and flag unsafe/wrong suggestions.
- **Customer transparency:** When a customer-facing response is generated by AI rather than a deterministic template or human agent, the tenant can configure a short disclosure such as "Automated assistant" where appropriate for trust and local legal advice.

### 7.5 System Dependencies & Failure Modes *(new)*

| Dependency | Failure Impact | Mitigation |
|---|---|---|
| Meta WhatsApp Cloud API unavailable | Outbound messages queue; inbound messages lost | Dead-letter queue with retry; dashboard banner alerting tenants |
| PayFast subscription webhook failure | Failed payment not recorded; account stays active | Idempotent retry with exponential backoff; daily reconciliation job |
| South African data centre outage | Dashboard and inbox unavailable | Active-passive failover to secondary SA region; RTO <1 hour, RPO <15 minutes |
| Meta template rejection at high volume | Campaigns blocked for affected tenants | Pre-submission template lint check; rejection reason surfaced in-app |
| AI provider unavailable | AI drafts, intent classification, and AI flow suggestions unavailable | Graceful degradation to deterministic flows, templates, inbox, and human handoff |
| AI confidence below threshold | Incorrect or unhelpful customer response risk | Draft-only mode or immediate human handoff; no auto-send |
| AI policy guardrail blocks workflow | Customer receives no automated answer | Safe fallback message inside service window or queue for agent |

### 7.6 Data Architecture *(new)*

- **Tenant isolation:** Row-level security on all shared database tables keyed by `tenant_id`
- **PII fields:** Name, phone number, email, conversation content encrypted at field level with per-tenant encryption keys
- **Conversation storage:** Hot storage (last 90 days) on primary database; cold storage (90 days – 3 years) on encrypted object storage; purge on data deletion request
- **Audit log:** Append-only; tamper-evident; retained 12 months (POPIA requirement)
- **Backups:** Daily snapshots; 30-day retention; tested monthly via restore drill
- **AI audit data:** AI traces retained for 90 days by default, with redacted prompts and outputs available to tenant owners for QA. Prompt logs containing personal information follow the same deletion workflow as conversation records.

---

## 8. Feature Requirements

> **Prioritisation key:**
> - **P0** — Must have at launch (blocking revenue)
> - **P1** — Should have by Phase 2 (retention driver)
> - **P2** — Nice to have (ARPA driver, Phase 3)
> - **P3** — Future consideration (Phase 4+)

> **User story format:** *As a [persona], I want to [action], so that [outcome].*
> **Acceptance criteria format:** Given [context], When [event], Then [result].

---

### Module 1 — Onboarding & Setup

**FR-1.1 — Guided Setup Wizard (P0)**

*User story:* As Zinhle (boutique owner), I want to connect my WhatsApp Business number to ChatClan in a step-by-step wizard, so that I can start sending campaigns without needing a developer.

A step-by-step first-run experience that walks a new user through:
- Business profile creation (name, category, description, logo)
- Meta WABA connection (either via ChatClan's managed BSP access or bring-your-own credentials)
- WhatsApp number verification and display name approval
- Contact import (CSV upload with drag-and-drop column mapping)
- First template message creation and submission to Meta for approval
- A test message sent to the owner's own phone to confirm everything works

*Acceptance criteria:*
- Given a new user completes registration, When they enter the wizard, Then all six setup steps are presented in sequence with a progress indicator.
- Given a user submits their WABA credentials, When the connection is verified by Meta's API, Then a green "Connected" status is shown within 10 seconds.
- Given a non-technical user with no prior experience, When they follow in-app prompts, Then they complete the full wizard in under 10 minutes (validated via usability testing with 5 non-technical participants scoring ≥4/5 ease).
- Given a user abandons the wizard mid-flow, When they return, Then the wizard resumes from where they left off.
- **Error state:** Given WABA credentials are invalid, When submitted, Then a specific error message explains the issue (e.g., "Phone number ID not found — check your Meta Business Manager") with a link to support.

**FR-1.2 — Meta Business Verification Guidance (P0)**

*User story:* As Sipho, I want clear in-app guidance on completing Meta Business Verification, so that I don't get stuck on paperwork I've never dealt with before.

Step-by-step in-app guidance for completing Meta Business Verification. ChatClan must provide contextual guidance, document requirements specific to South Africa (CIPC registration documents, etc.), and status tracking within the dashboard.

*Acceptance criteria:*
- Given a user's WABA is unverified, When they visit the Setup section, Then a verification checklist specific to South African documents (CIPC certificate, ID, bank statement) is displayed.
- Given a user's verification is pending, When they check their dashboard, Then the current Meta verification status is polled and shown (Pending / Under Review / Verified / Rejected).
- Given verification is rejected, When the status updates, Then the in-app notification includes the rejection reason from Meta and a recommended next step.

**FR-1.3 — In-app Guided Tours (P1)**

Tooltip-driven feature walkthroughs triggered on first visit to each module. Dismissible, re-openable from help menu.

*Acceptance criteria:*
- Given a user visits a module for the first time, When the page loads, Then a tooltip-driven walkthrough begins automatically.
- Given a user dismisses a tour, When they click "Replay tour" in the help menu, Then the tour restarts from step 1.

---

### Module 2 — Campaign Builder

**FR-2.1 — Broadcast Campaign Creation (P0)**

*User story:* As Zinhle, I want to send a promotional message to all my opted-in customers at once, so that I don't have to message them one by one.

A no-code campaign builder allowing users to:
- Select an approved WhatsApp message template
- Choose a contact segment (all contacts, by tag, by last activity, by custom filter)
- Schedule delivery (immediate, specific date/time, recurring)
- Preview the message exactly as it will appear in WhatsApp (with correct bubble layout, buttons, and media)
- Confirm and send

*Acceptance criteria:*
- Given a user selects a template and segment, When they click "Preview," Then a pixel-accurate WhatsApp message bubble preview is rendered including header media, body text, and CTA buttons.
- Given a user schedules a campaign, When the scheduled time arrives, Then messages begin dispatching within 60 seconds of the scheduled time.
- Given a campaign is dispatched, When it is processing, Then a real-time progress bar shows messages sent / total.
- Given a contact in the segment has opted out, When the campaign runs, Then that contact is silently skipped and excluded from the sent count.
- **Empty state:** Given a user has no approved templates, When they open the campaign builder, Then a prompt directs them to create and submit a template first.

**FR-2.2 — Contact Segmentation (P0)**

Dynamic and static segment support. Filters: contact tags, last message date, campaign engagement (opened, clicked, replied), custom fields, opt-in status.

*Acceptance criteria:*
- Given a user creates a dynamic segment with filters, When a new contact meets the criteria, Then they are automatically included in the segment within 5 minutes of the qualifying event.
- Given a user applies 3+ filters, When they preview the segment, Then a live count of matching contacts updates within 3 seconds.

**FR-2.3 — Message Template Library (P0)**

A searchable library of pre-built message templates across 19 South African business industries. All templates pre-formatted to pass Meta's template approval guidelines.

*Acceptance criteria:*
- Given a user searches by industry (e.g., "Restaurant"), When results are returned, Then only templates tagged to that industry are shown.
- Given a user selects a pre-built template, When they click "Use this template," Then it is pre-populated in the template editor with all variables highlighted.

**FR-2.4 — A/B Campaign Testing (P2)**

Split a broadcast into two variants, send to defined proportions of the segment, and automatically select the winning variant based on open rate or click rate after a configurable test window.

*Acceptance criteria:*
- Given a user creates an A/B test with 20%/80% split, When the campaign runs, Then exactly 20% receive variant A and 80% receive variant B (±2% tolerance).
- Given the test window expires, When the winner is determined, Then the winning variant is sent to the remaining audience automatically and the user receives an in-app notification with results.

**FR-2.5 — Campaign Analytics (P0)**

Per-campaign dashboard: messages sent, delivered, read, replied, link clicks, conversions, Meta cost, and ROI.

*Acceptance criteria:*
- Given a campaign completes, When a user views analytics, Then delivered, read, and replied counts are shown and update within 60 seconds of new webhook events.
- Given a UTM-tagged link is clicked, When the click is recorded, Then it appears in the campaign analytics within 5 minutes.

---

### Module 3 — Chatbot Flow Builder

**FR-3.1 — Visual Flow Builder (P0)**

*User story:* As Sipho, I want to build a table booking chatbot by dragging nodes onto a canvas, so that my restaurant handles booking requests automatically overnight.

A drag-and-drop canvas using:
- **Trigger nodes** — incoming keyword, button tap, time delay, tag applied
- **Message nodes** — send text, image, video, document, location, interactive button list
- **Condition nodes** — branch based on user reply, tag, contact field, or time of day
- **Action nodes** — apply tag, update contact field, assign to agent, send webhook, update CRM
- **Delay nodes** — wait X minutes/hours before next step
- **End nodes** — end flow, escalate to human, restart flow

*Acceptance criteria:*
- Given a user drags a "Message" node onto the canvas, When they double-click it, Then an inline editor opens allowing them to compose the message without leaving the canvas.
- Given a user publishes a flow, When a customer sends a trigger keyword, Then the flow initiates within 5 seconds.
- Given a condition node has unconnected branches, When a user attempts to publish, Then the system prevents publishing and highlights the unconnected branch in red.
- **Error / edge case:** Given a flow loop is detected, When a user attempts to publish, Then an error message reads "Loop detected between [Node A] and [Node B] — remove the connection to continue."

**FR-3.2 — Pre-built Flow Templates (P0)**

19 industry flow templates that users can duplicate and customise.

*Acceptance criteria:*
- Given a user selects an industry template, When they click "Duplicate and edit," Then a copy of the flow opens in the builder with all nodes editable and the original unchanged.

**FR-3.3 — Flow Testing Mode (P1)**

A live phone preview panel that simulates the conversation without sending real WhatsApp messages.

*Acceptance criteria:*
- Given a user opens test mode, When they type a simulated customer message, Then the flow responds exactly as it would in production, including condition branches.
- Given a delay node of 24 hours is in the flow, When testing, Then the delay is skipped (or the user can simulate passage of time) so the full flow can be tested without waiting.

**FR-3.4 — AI Copy Assistant (P2)**

An AI-powered suggestion engine that helps users write WhatsApp message copy that is clear, concise, appropriately informal, and within Meta's content guidelines. The AI provider must be abstracted behind ChatClan's AI workflow service so vendor choice can change without product redesign.

*Acceptance criteria:*
- Given a user activates the AI assistant, When they describe the message purpose in plain English (e.g., "remind customers their appointment is tomorrow"), Then 3 copy suggestions are returned within 5 seconds.
- Given the AI assistant is unavailable, When a user opens the copy editor, Then the assistant panel shows "AI suggestions temporarily unavailable" and the rest of the builder works normally.
- Given an AI copy suggestion is generated, When the message will be sent outside the service window, Then the suggestion must map to an approved or submittable template category before it can be used in a campaign.
- Given the AI suggests marketing copy, When a contact segment includes opted-out or unknown-consent users, Then the send action remains blocked and the UI explains the consent requirement.

**FR-3.5 — AI-Assisted Flow Builder (P1)**

*User story:* As a business owner, I want to describe the outcome I need in plain English, so that ChatClan can draft an editable, compliant WhatsApp flow that I can review before publishing.

The AI-assisted flow builder converts a task-specific goal into deterministic flow nodes. It must never publish directly without user review.

Supported launch intents:
- Booking and appointment triage
- Product discovery and catalog routing
- Order status and payment-link support
- FAQ support from approved business knowledge
- Lead qualification and callback request
- Human handoff and after-hours response

*Acceptance criteria:*
- Given a user enters "build me a booking assistant for a hair salon," When the AI assistant runs, Then it creates an editable draft flow with trigger, message, condition, handoff, and end nodes.
- Given a generated flow contains missing branches or loops, When the user attempts to publish, Then existing flow validation blocks publishing.
- Given the AI proposes an outbound proactive message, When the message is outside the 24-hour service window, Then it must use an approved template or remain a draft.
- Given the AI lacks enough business data to answer, When generating a node, Then it adds a clarification step or handoff node rather than inventing details.

**FR-3.6 — AI Intent Router and Smart Handoff (P1)**

*User story:* As an agent, I want ChatClan to understand what a customer is trying to do, so that routine conversations are routed automatically and risky conversations reach a human quickly.

The intent router classifies inbound WhatsApp messages into tenant-approved purposes and routes them to deterministic flows, commerce actions, agent draft replies, or human handoff.

*Acceptance criteria:*
- Given a customer sends "I want to book for Saturday," When a booking workflow is enabled, Then the message routes to the booking flow or a booking-specific AI draft.
- Given a customer asks a general question unrelated to the tenant's configured business purpose, When no safe workflow exists, Then the conversation is routed to the inbox with "Out of scope for AI" reason.
- Given a customer expresses anger, cancellation intent, refund concern, legal/medical/financial sensitivity, or asks for a human, When AI routing evaluates the message, Then it must hand off to an agent.
- Given AI confidence is below the tenant's auto-reply threshold, When a response is available, Then it appears as an editable draft only.

**FR-3.7 — AI Knowledge Base and Grounded Replies (P1)**

*User story:* As a business owner, I want AI replies to use only information I trust, so that customers receive accurate answers about my business.

Tenant knowledge sources may include manually entered FAQs, product catalog items, order data, booking rules, business hours, location details, return policy, approved templates, and uploaded policy documents.

*Acceptance criteria:*
- Given a customer asks a product question, When matching catalog data exists, Then the AI response cites the internal source used and offers relevant products or next steps.
- Given no approved knowledge source supports the answer, When AI is asked to respond, Then it asks a clarifying question or hands off.
- Given a tenant owner edits a generated answer, When they mark it as reusable, Then ChatClan can save it as a reviewed knowledge item or template draft.
- Given a data deletion request is processed, When the deleted subject appears in AI prompt traces or summaries, Then those records are deleted or irreversibly redacted.
- Given an owner imports CSV, text, Markdown, PDF, or DOCX content, When ingestion completes, Then readable content is split into reviewable records that retain tenant, source, external reference, content hash, version, review status, and sync health provenance.
- Given an uploaded PDF or DOCX is malformed, unsupported, empty, or larger than the configured limit, When extraction runs, Then the import fails with a specific recoverable error and no partial source is created.
- Given imported content has not been explicitly approved, When retrieval runs, Then the content remains excluded from AI grounding.
- Given an external adapter sends the same external reference again, When the connector sync completes, Then ChatClan versions the existing knowledge item instead of creating a duplicate.
- Given an owner connects Shopify, WooCommerce, or Google Drive, When credentials are saved, Then secrets are encrypted at rest, excluded from API responses and job payloads, and represented only by masked values in the interface.
- Given a live connector is active, When its configured interval elapses, Then a background job synchronises supported records, records its health and next run, retries transient failures with bounded backoff, and preserves the next regular schedule after retry exhaustion.
- Given an owner pauses a connector, When queued schedules are evaluated, Then no new provider sync begins until the connector is resumed.
- Given an owner deletes a source, When deletion is confirmed, Then queued syncs are cancelled, encrypted credentials are revoked, the source is soft-deleted for auditability, and its derived knowledge records are archived and excluded from retrieval.
- Given a Google Drive connector is scoped to a folder, When it synchronises, Then it reads only downloadable supported files in that folder and uses Google Workspace export for native documents and media download for PDF, DOCX, text, and Markdown files.
- Given an owner starts Google Drive connection, When consent begins, Then ChatClan uses Google's authorization-code web-server flow with offline access, incremental authorization, an exact registered callback URI, and an opaque state value that is tenant-bound, user-bound, single-use, and expires within 10 minutes.
- Given Google returns authorization credentials, When the callback succeeds, Then the refresh token is encrypted at rest, access tokens and client secrets never enter API responses or job payloads, and replaying or crossing tenants with the OAuth state is rejected.
- Given ChatClan requests `drive.readonly` for automatic folder synchronisation, When production access is enabled, Then Google OAuth verification and any required restricted-scope security assessment are completed before customer rollout; the interface must show the configuration and verification state rather than imply readiness.
- Given an owner deletes a Google Drive connector, When deletion is confirmed, Then ChatClan attempts token revocation before archiving the source and records the revocation result without blocking tenant data cleanup.
- Given any connector sync starts, retries, succeeds, fails, or is skipped, When operations telemetry is recorded, Then ChatClan retains the trigger, attempt, duration, processed/created/updated/skipped counts, bounded error summary, and timestamps without retaining credentials or imported customer content in the run record.
- Given an owner opens connector operations, When source health is evaluated, Then the dashboard shows active and healthy counts, failures in the last 24 hours, average duration, recent retry history, source success rate, next sync, and freshness against an SLA derived from its configured interval.
- Given a source has never synchronised, is overdue, or its latest run failed, When connector health is evaluated, Then an actionable in-platform alert identifies the source and condition and applies the tenant's outbound delivery policy.
- Given connector alerting is enabled, When a new warning or critical condition is detected, Then ChatClan creates one durable tenant-scoped alert per source and condition, sends email to the configured active owner/admin roles and additional recipients, and records every successful or failed delivery without failing the connector sync.
- Given an informational condition such as a connector that has not completed its first sync, When the default notification policy applies, Then the signal appears in platform operations without generating email noise below the configured minimum severity.
- Given an alert remains open and unacknowledged beyond the tenant's configured escalation interval, When the alert evaluator runs, Then ChatClan records an escalation event and sends an escalation notification to the configured recipients.
- Given an owner or administrator acknowledges an alert, When acknowledgement succeeds, Then ChatClan records the accountable user and timestamp while continuing to evaluate the underlying connector condition.
- Given the connector returns within its operating threshold, When alert evaluation runs, Then matching open or acknowledged alerts resolve automatically and preserve their full notification, acknowledgement, escalation, and recovery history.
- Given Google Drive OAuth settings are present, When deployment readiness is evaluated, Then ChatClan reports sandbox readiness separately from production readiness and checks the client, exact callback path, scopes, test-user presence, Google verification status, and restricted-scope security-assessment status without exposing credentials or test-user identities.
- Given a deployment declares `APP_URL`, When Google OAuth readiness is evaluated, Then the registered redirect URI must exactly equal `${APP_URL}/auth/google-drive/callback`; callback drift across scheme, host, port, path, or trailing slash fails closed.
- Given an operator configures Google OAuth, When preflight runs, Then the client ID must be a Google OAuth web-client ID, the secret must not be a placeholder, every sandbox tester must be a valid email address, and full-folder mode must request only `drive.readonly`.
- Given Google Drive OAuth is required in production, When the release preflight runs, Then the release fails closed unless production readiness is complete; sandbox environments may proceed with valid configuration and test users while verification remains in progress.
- Given a customer needs access only to explicitly selected Drive files, When ChatClan introduces a least-privilege connector mode, Then it must use Google Picker with `drive.file`, present the picker in an uncluttered modal workflow, and remain distinct from automatic whole-folder synchronisation until live tests prove access semantics for existing and newly added child files.
- Given a tenant defines an evaluation suite, When it is run, Then ChatClan records citation precision, expected-source recall, required-term completeness, forbidden-source isolation, and transparent unsupported-claim risk.
- Given an evaluation references a customer order, When retrieval runs, Then only orders matching the tenant and normalized customer phone may be returned.

**FR-3.8 — AI Quality Feedback Loop (P1)**

*User story:* As a business owner, I want to know whether AI is improving customer satisfaction, so that I can trust automation without losing control.

*Acceptance criteria:*
- Given AI-assisted replies are enabled, When conversations resolve, Then dashboards show AI containment rate, handoff rate, agent edit rate, unsafe-block rate, customer CSAT, and reopened conversations.
- Given an agent marks an AI suggestion as wrong, unsafe, off-brand, or policy-risky, When feedback is submitted, Then the suggestion is not reused and the issue appears in AI QA review.
- Given a tenant's AI CSAT drops below a configurable threshold, When the weekly health check runs, Then auto-reply mode is disabled or downgraded to draft-only pending owner review.

---

### Module 4 — Unified Inbox

**FR-4.1 — Multi-agent Shared Inbox (P0)**

*User story:* As Thandeka, I want all my client's incoming WhatsApp messages to appear in one shared inbox visible to her team, so that no message falls through the cracks.

Features:
- Conversation assignment (auto-assign or manual)
- Conversation status (open, pending, resolved, snoozed)
- Internal notes (team-visible only)
- Typing indicators in agent view
- Customer profile panel (details, tags, history, campaign engagement)
- Canned responses (triggerable by `/` shortcut)

*Acceptance criteria:*
- Given a new inbound message arrives, When no assignment rule matches, Then it appears in the "Unassigned" queue within 3 seconds of Meta webhook receipt.
- Given an agent types a response, When another agent views the same conversation, Then a "Zinhle is typing…" indicator is shown.
- Given an agent marks a conversation "Resolved," When it is re-opened by a new customer message, Then it moves back to "Open" and the assigned agent is notified.
- **Empty state:** Given no conversations exist, When an agent opens the inbox, Then a prompt appears: "No conversations yet — share your WhatsApp link to start receiving messages."

**FR-4.2 — Live Agent Handoff from Chatbot (P0)**

A flow builder node that escalates a conversation from chatbot to human agent.

*Acceptance criteria:*
- Given a chatbot flow reaches a handoff node, When it fires, Then the conversation appears in the agent inbox marked "Bot escalation" with the full conversation history pre-loaded.
- Given the assigned agent has not responded within the SLA window (configurable), When the timer expires, Then a supervisor notification is sent.

**FR-4.3 — Agent Performance Reporting (P1)**

Per-agent dashboard: first response time, conversations handled, resolution time, CSAT scores.

*Acceptance criteria:*
- Given a conversation is resolved, When the automated post-conversation survey response is received, Then the CSAT score is attributed to the last assigned agent and averaged into their scorecard.

---

### Module 5 — Contacts Management

**FR-5.1 — Contact Database (P0)**

*User story:* As Zinhle, I want to see every customer's message history and opt-in status in one profile, so that I can personalise follow-up without needing to dig through my phone.

Each contact record: Name, phone, email, tags, 20 custom fields, opt-in status and consent timestamp, conversation history, campaign engagement history.

*Acceptance criteria:*
- Given a user searches by name or phone number, When results are returned, Then matching contacts are shown within 1 second.
- Given a contact's opt-in status is "Opted out," When a campaign is created targeting that contact, Then the platform prevents them from being included and shows a count of excluded opted-out contacts.

**FR-5.2 — Contact Import (P0)**

Drag-and-drop CSV import with column mapping, duplicate detection, opt-in flagging, and import history log.

*Acceptance criteria:*
- Given a user uploads a CSV with 5,000 rows, When processing completes, Then results are shown within 30 seconds indicating imported, duplicate, and error counts.
- Given the CSV contains a phone number without a country code, When the import is processed, Then the system flags the row with "Missing country code — please add +27 for South Africa" and excludes it from the import.
- Given the opt-in column is not mapped, When a user attempts to complete the import, Then the system blocks the import with a message: "Opt-in consent column is required for POPIA compliance — please map a column."

**FR-5.3 — Opt-in Management (P0 — POPIA requirement)**

Every contact must have a logged opt-in record. Platform must prevent campaigns to contacts without opt-in; record opt-in channel; suppress opt-outs immediately; export full audit trail.

*Acceptance criteria:*
- Given a contact opts out by replying "STOP," When the message is received, Then the contact is suppressed within 60 seconds and cannot receive future campaigns.
- Given a user requests the opt-in audit log, When they download it, Then a CSV or PDF is generated within 30 seconds containing: contact ID, phone (masked), opt-in date, opt-in channel, and any opt-out date.

**FR-5.4 — QR Code & Opt-in Widget Generator (P1)**

WhatsApp QR code and embeddable JS widget; both record opt-in source, channel, and timestamp.

*Acceptance criteria:*
- Given a user generates a QR code, When a customer scans it, Then a pre-filled WhatsApp chat opens and the opt-in confirmation flow triggers within 5 seconds.
- Given the widget is embedded on a website, When a visitor clicks "Chat on WhatsApp," Then the widget opens an opt-in confirmation flow and records the source as "Website widget — [domain]."

---

### Module 6 — Automation Rules Engine

**FR-6.1 — Rule Builder (P1)**

*User story:* As Zinhle, I want to automatically send a follow-up message to any customer who doesn't reply within 24 hours, so that I recover more potential sales.

"If this, then that" automation using supported triggers and actions as defined below.

**Triggers:** Contact created; tagged; field updated; message received with keyword; campaign not opened after X hours; contact birthday/anniversary; date-based.

**Actions:** Send template; start chatbot flow; apply/remove tag; assign to agent; send internal notification; update contact field; trigger webhook; wait X hours/days.

*Acceptance criteria:*
- Given a rule is active, When a trigger event occurs, Then the action fires within 60 seconds.
- Given a rule uses a time-based trigger, When the trigger fires outside business hours (user-configurable), Then the action is queued until the next business hour window.
- Given two rules match the same event, When they fire, Then both execute unless one is configured as a stop-further-rules rule.

**FR-6.2 — Abandoned Conversation Recovery (P1)**

If a conversation is opened but not resolved within X hours, automatically send a follow-up.

**FR-6.3 — Drip Sequences (P2)**

Multi-step message sequences over time, fully visual, drag-and-drop.

*Acceptance criteria:*
- Given a contact enters a drip sequence, When they opt out at any point, Then all remaining sequence messages are cancelled and the contact is suppressed.

---

### Module 7 — Analytics & Reporting

**FR-7.1 — Campaign Analytics Dashboard (P0)**

Visualised as line chart (delivery/read rate over time), bar charts (campaign comparison), and summary table.

**FR-7.2 — Inbox Analytics (P1)**

Total conversations, response time distribution, resolution rate by agent and period.

**FR-7.3 — Contact Growth Report (P1)**

New contacts over time, opt-in rate by source, opt-out rate trend.

**FR-7.4 — Meta Cost Report (P0)**

Real-time view of tenant Meta API spend: message count by category, cost per message, projected monthly spend.

*Acceptance criteria:*
- Given a user views the Meta Cost Report, When costs from the previous day are available, Then they are shown by 08:00 SAST the following day.
- Given projected spend exceeds 80% of a user-set budget, When that threshold is crossed, Then an in-app alert and email notification are sent.

**FR-7.5 — Revenue Attribution (P2)**

UTM tracking and conversion webhook to close the loop between message and revenue.

---

### Module 8 — Template Manager

**FR-8.1 — Template Creation & Submission (P0)**

*User story:* As any persona, I want to create a WhatsApp template and submit it to Meta without needing to understand Meta's backend tools, so that I can start sending approved messages quickly.

Guided template creator: category selection, header/body/footer/CTA, variable management, character count, one-click Meta submission, approval status tracking.

*Acceptance criteria:*
- Given a user fills in a template and clicks "Submit to Meta," When Meta returns an approval decision, Then the status updates in the dashboard within 15 minutes of Meta's response.
- Given a template is rejected, When the status updates, Then the rejection reason from Meta is shown in plain English alongside a suggested fix.
- Given a template body exceeds Meta's character limit, When a user is typing, Then a live character counter turns red and submission is disabled.

**FR-8.2 — Template Library (P0)**

Searchable library with filters by category, language, industry, approval status.

---

### Module 9 — Agency / Reseller Portal

**FR-9.1 — Sub-account Management (P2)**

*User story:* As Thandeka, I want to manage all my clients' WhatsApp accounts from one dashboard, so that I can scale beyond 12 clients without hiring another person.

Agency portal: create/manage client sub-accounts, one-click switching, per-client branding, plan limits, aggregate analytics.

*Acceptance criteria:*
- Given Thandeka switches to a client sub-account, When the switch occurs, Then the dashboard reloads in under 2 seconds showing only that client's data.
- Given Thandeka views aggregate analytics, When the page loads, Then data from all sub-accounts is aggregated and shown in a single table filterable by client.

**FR-9.2 — White-label Mode (P2)**

Custom domain, logo, colour scheme; ChatClan branding removed for Agency tier.

*Acceptance criteria:*
- Given a white-label domain is configured, When a client logs in via that domain, Then zero ChatClan branding appears anywhere in the product.

**FR-9.3 — Client Billing Management (P2)**

Agency pays ChatClan for all sub-accounts, or per-client payment methods configured for direct billing.

---

### Module 10 — Settings & Integrations

**FR-10.1 — API Credentials Management (P0)**

Secure storage of Meta API credentials per phone number; multiple numbers per account based on plan.

**FR-10.2 — Team Member Management (P0)**

Invite by email; role-based access: Owner, Admin, Agent (inbox-only), Analyst (reports-only).

*Acceptance criteria:*
- Given an Owner invites a team member, When the invitee accepts via email link, Then they are added to the account with the assigned role and no additional permissions.
- Given an Agent role user navigates to the Campaign Builder, When they attempt to access it, Then they are shown "Access restricted — contact your account owner" and redirected to the inbox.

**FR-10.3 — Webhook Builder (P1)**

Outbound webhooks to business systems. Events: message received, campaign sent, contact opted in/out, conversation resolved.

**FR-10.4 — Third-party Integrations (P2)**

Native: Shopify, WooCommerce, Google Sheets, Zapier/Make, Yoco, Ozow, Xero.

*Acceptance criteria (Shopify):*
- Given a Shopify order is placed, When the integration is active, Then an order confirmation WhatsApp message is sent to the customer within 2 minutes.
- Given the Shopify API is unavailable, When a trigger fires, Then the failed event is logged and retried up to 3 times with exponential backoff; the user is notified of the failure in their integration dashboard.

**FR-10.5 — Tenant CRM Integrations (P1)**

Workspace Owners and Admins can connect HubSpot, Salesforce, Zoho CRM, and Pipedrive through provider-hosted OAuth consent. ChatClan must never ask a tenant to paste an OAuth access token into the browser.

Required capabilities:
- Provider-specific OAuth callback and one-time, ten-minute state bound to the initiating workspace and user
- Encrypted refresh/access credentials at rest, masked operational reads, least-privilege contact scopes, and provider revocation or uninstall guidance
- Provider-aware default contact mappings with customer-editable remote field names; optional fields remain unmapped until deliberately configured
- Idempotent outbound contact synchronisation using local-to-remote record links and payload hashes
- Initial, manual, and scheduled durable jobs with retries, deduplication, pause/resume, cadence replacement, and queued-job cancellation on disconnect
- Connection tests, health status, last-success timestamp, consecutive failures, record outcomes, duration, retry evidence, and actionable error messages
- A spacious tenant Integrations workspace with provider readiness, summary metrics, sync history, and focused connect/manage drawers

*Acceptance criteria:*
- Given an Owner starts a CRM connection, When OAuth consent completes, Then ChatClan consumes the state once, encrypts offline credentials, records the account endpoint, and queues the initial contact sync.
- Given a callback state belongs to another user or workspace, is expired, or was already consumed, When the callback arrives, Then ChatClan rejects it without exchanging the code.
- Given a contact has not changed since its last successful sync, When a scheduled run executes, Then ChatClan skips the provider write using the stored payload hash.
- Given some records fail, When a run completes, Then the run is marked partial, successful links are preserved, failed records retain error evidence, and the next scheduled run remains queued.
- Given every record or the provider request fails, When retries are exhausted, Then the connection shows an error and failure count without exposing credentials; the tenant can test, retry, pause, remap, or disconnect.
- Given a cadence changes or a connection is paused/disconnected, When settings are saved, Then obsolete queued scheduled jobs are cancelled and the displayed next run agrees with the worker schedule.

---

### Module 11 — Platform Owner & Operations Console *(new)*

The Platform Owner Console is the internal ChatClan control plane. It is separate from tenant workspaces and is available only to authorised ChatClan platform operators. Tenant owners manage their own businesses; platform owners manage the health, safety, revenue, support, and reliability of the entire SaaS platform.

**FR-11.1 — Platform Overview Dashboard (P0)**

*User story:* As the ChatClan platform owner, I want a single operational view of the platform, so that I can understand revenue, tenant health, vendor health, and incidents without querying the database manually.

The dashboard must show:
- Total tenants, active tenants, trials, suspended tenants, and churn-risk tenants
- MRR, failed payments, past-due subscriptions, plan distribution, and ARPA
- Meta connection status by tenant: WABA connected, phone registered, webhook verified, template sync health, quality/rate-limit warnings
- Queue and worker health: pending jobs, failed jobs, oldest queued job, dead-letter count, campaign dispatch backlog
- API/webhook health: uptime, error rate, p95 latency, webhook acknowledgment latency, and recent deploy status
- Vendor health: Meta, PayFast, SMTP, AI providers, database, object storage, and backup status
- Security/compliance health: failed logins, suspicious tenant activity, data deletion backlog, consent audit completeness, admin action anomalies

*Acceptance criteria:*
- Given a platform owner opens `/platform`, When the page loads, Then the dashboard displays tenant, revenue, integration, queue, and incident health within 3 seconds.
- Given any critical dependency is degraded, When the dashboard loads, Then a visible severity banner identifies the affected dependency, customer impact, and next recommended runbook.
- Given a metric crosses an alert threshold, When the condition remains true for the configured window, Then an alert is recorded and routed to the configured operations channel.

**FR-11.2 — Tenant Administration (P0)**

*User story:* As a platform operator, I need to safely support and manage tenant accounts, so that customer issues can be resolved without violating tenant isolation or auditability.

Capabilities:
- Search tenants by business name, owner email, WABA ID, phone number, subscription id, and domain
- View tenant profile, plan, billing state, setup progress, Meta assets, feature flags, usage, and support history
- Suspend, reactivate, downgrade, upgrade, or apply manual billing grace with required reason
- View tenant-level health checks: setup blockers, send failures, opt-in risk, template rejection rate, quality warnings, queue backlog, and AI safety downgrades
- Secure support access using just-in-time approval, explicit reason, time limit, and full audit trail

*Acceptance criteria:*
- Given a platform operator changes a tenant's plan, When the change is saved, Then the action is logged with operator id, reason, before/after values, IP, and timestamp.
- Given support access is requested, When no reason is provided, Then access is denied.
- Given support access is active, When the operator views tenant data, Then all actions are logged and sensitive fields remain masked unless elevated permission is granted.

**FR-11.3 — Incident Management Console (P0)**

*User story:* As the platform owner, I want incidents to be declared, tracked, communicated, and reviewed consistently, so that customer impact is reduced and lessons are captured.

Capabilities:
- Create incidents with severity: SEV1, SEV2, SEV3, SEV4
- Assign incident commander, operations lead, communications owner, and planning owner
- Maintain live incident state: impact, affected tenants, suspected cause, timeline, mitigations, next update time, and linked alerts
- Publish internal updates and customer-facing status updates
- Trigger runbooks for common failures: Meta outage, webhook backlog, PayFast ITN failure, database degradation, AI provider outage, SMTP failure, backup failure
- Close incident only after impact is resolved and follow-up actions are assigned

*Acceptance criteria:*
- Given a SEV1 or SEV2 incident is declared, When it is saved, Then the system requires an incident commander and communications owner.
- Given customer impact is confirmed, When the next-update timer is reached, Then the communications owner receives a reminder to update stakeholders.
- Given an incident is closed, When no postmortem decision is recorded, Then closure is blocked for SEV1 and SEV2 incidents.

**FR-11.4 — Platform Audit & Compliance Evidence (P0)**

*User story:* As the platform owner, I need evidence of security, privacy, and operational controls, so that ChatClan can earn customer trust and prepare for formal audits.

Capabilities:
- Immutable platform admin audit log
- Exportable evidence for backups, restore drills, access reviews, incident response, vulnerability remediation, vendor checks, and data deletion workflows
- Quarterly access review workflow for platform users and high-risk tenant roles
- Subprocessor/vendor register including purpose, data categories, region, contract status, and review date
- Policy acknowledgement tracking for platform operators

*Acceptance criteria:*
- Given an operator performs a high-risk action, When the action completes, Then an audit event is written before the response is returned.
- Given an auditor requests evidence for a period, When an authorised platform owner exports it, Then the export includes control name, date, actor, result, linked record, and tamper-evidence checksum.

**FR-11.5 — Feature Flags, Entitlements, and Kill Switches (P0)**

*User story:* As the platform owner, I want to control feature rollout and emergency disablement centrally, so that new features can be launched safely and risky behaviours can be stopped quickly.

Capabilities:
- Global, plan-level, tenant-level, workflow-level, and conversation-level flags
- Entitlement engine for plans, add-ons, beta access, and manual overrides
- Emergency kill switches for campaign dispatch, template submission, Meta live sends, AI auto-replies, AI provider, PayFast checkout, webhooks, imports, and public signup
- Change history and approval workflow for high-risk flags

*Acceptance criteria:*
- Given a global AI auto-reply kill switch is disabled, When any tenant workflow attempts auto-send, Then the message is downgraded to draft or handoff.
- Given a feature flag is changed for a tenant, When the change is saved, Then the tenant feature state updates within 60 seconds and the change is auditable.

**FR-11.6 — Support & Customer Success Operations (P1)**

*User story:* As a support lead, I want a 360-degree customer operations view, so that support issues can be diagnosed quickly and escalated with context.

Capabilities:
- Tenant support timeline: setup events, billing events, Meta events, failed sends, template rejections, support notes, incidents, and product usage
- Internal support notes and task assignment
- Escalation queues for WABA verification, template rejection, billing failure, campaign failure, data deletion, and AI safety concerns
- Customer health scoring: setup progress, usage trend, failed messages, unresolved inbox backlog, support volume, payment risk, and churn risk
- SLA tracking by plan tier

*Acceptance criteria:*
- Given a tenant has a failed campaign dispatch, When support opens the tenant record, Then the failed job, error reason, affected recipients, and retry option are visible.
- Given a Pro/Agency support ticket is created, When it exceeds the plan SLA, Then it is escalated to the support lead.

**FR-11.7 — FinOps and Margin Management (P1)**

*User story:* As the platform owner, I need to understand cost-to-serve per tenant and feature, so that ChatClan can grow without hidden margin erosion.

Capabilities:
- Per-tenant gross margin estimate: subscription revenue minus Meta message cost estimates, AI provider cost, infrastructure allocation, and support load
- AI cost monitoring by provider, model, workflow, tenant, and resolved conversation
- Meta spend anomaly detection by tenant, category, and phone number
- Infrastructure cost trend and budget alerts
- Plan profitability dashboard and suggested pricing/limit adjustments

*Acceptance criteria:*
- Given a tenant's estimated cost-to-serve exceeds plan revenue, When the margin threshold is crossed, Then the tenant is flagged for review.
- Given AI provider costs exceed a workflow ceiling, When the next AI request is evaluated, Then routing must downgrade to cheaper model, draft-only mode, or disablement based on configured policy.

**FR-11.8 — AI Governance Operations Console (P1)**

*User story:* As the platform owner, I want visibility and control over AI behaviour across tenants, so that AI workflows remain useful, compliant, cost-controlled, and safe.

Capabilities:
- Provider registry for OpenAI, Anthropic, Google, DeepSeek, xAI/Grok, and future providers
- Provider status, latency, error rate, cost, rate-limit, and fallback success
- Per-tenant and per-workflow AI mode: disabled, draft-only, supervised auto-reply, controlled auto-reply
- Prompt template version registry and rollback
- Redacted AI trace viewer with policy checks, grounding sources, confidence, provider/model id, and final action
- Safety review queue for unsafe, hallucinated, off-brand, low-confidence, or agent-rejected outputs
- AI quality dashboard: containment, handoff accuracy, edit rate, unsafe-block rate, reopened conversation rate, CSAT delta, and cost per resolved conversation

*Acceptance criteria:*
- Given an AI output is marked unsafe, When the review is submitted, Then the related prompt version/workflow appears in the AI safety queue.
- Given a provider outage occurs, When fallback is configured, Then successful fallback and failed fallback counts are visible in the provider health panel.

---

## 9. Technical & Non-Functional Requirements

### 9.1 Meta API Compliance

ChatClan must comply with all Meta WhatsApp Business Platform policies:

- All template messages submitted and approved by Meta before use
- Marketing messages only to opted-in users
- 24-hour service window respected
- Webhook endpoint: HTTP 200 within 200ms
- Rate limits respected per phone number tier
- BSUID support when Meta rolls it out (2026)

Since **July 2025**, Meta uses **per-message pricing**. Cost reporting reflects this.

**2026 Meta pricing categories (South Africa recipients):**

| Category | Description | Billing Model |
|----------|-------------|---------------|
| Marketing | Promotional campaigns, re-engagement | Per message — most expensive |
| Utility | Order updates, reminders, notifications | Per message — significantly cheaper |
| Authentication | OTPs, 2FA, verification | Per message — SA rates specifically reduced in 2025 |
| Service | Replies within 24-hour window | Free |

### 9.2 Infrastructure Requirements

- **Data residency:** All South African customer data in South African data centres (Johannesburg primary / Cape Town secondary)
- **Uptime SLA:** 99.9% for API layer and webhook receiver; 99.5% for web dashboard
- **RTO / RPO:** Recovery Time Objective <1 hour; Recovery Point Objective <15 minutes
- **Encryption:** AES-256 at rest, TLS 1.3 in transit
- **Backups:** Daily encrypted; 30-day retention; monthly restore test
- **Audit logs:** All user actions logged (timestamp, user ID, IP); retained 12 months

### 9.3 Security Requirements

- 2FA available (required for Owner role)
- Brute-force and automated-abuse protection: rate limiting plus invisible, server-verified Google reCAPTCHA on tenant sign-in, workspace registration, social-signup completion, password-reset requests, platform-owner sign-in, and Google/Facebook OAuth initiation. Verification must enforce success, expected action, hostname allow-list, score threshold, and token freshness; production fails closed when reCAPTCHA configuration is missing.
- Social identity: Google OpenID Connect and Facebook Login are supported for tenant sign-in and registration. Both require complete client credentials, exact HTTPS callback registration, anti-forgery state validation, verified provider identity, and server-side token exchange. Social authentication must never bypass reCAPTCHA or tenant/session boundaries.
- API key rotation support for Meta credentials
- No plain-text storage of credentials or card data (tokenised payment providers; PCI DSS scope minimised)
- Vulnerability scanning: automated OWASP ZAP scan on every deployment
- Penetration test: annual third-party pentest; remediation of Critical and High findings within 30 days
- OWASP Top 10 mitigations documented and reviewed quarterly

### 9.4 Performance Requirements

- Dashboard page load: under 2 seconds on 10–25 Mbps LTE (South African average)
- Real-time inbox updates: under 3 seconds from Meta webhook receipt to message in agent inbox
- Campaign dispatch throughput: up to 50,000 messages per campaign per tenant (Growth and Pro tiers)
- Webhook receiver: 99.9% of webhooks processed within 200ms under normal load
- Concurrent user target: 500 concurrent dashboard sessions without degradation (Phase 1); 5,000 (Phase 3)

### 9.5 Scalability Requirements *(new)*

- Horizontal scaling of webhook processing layer via message queue (e.g., Redis or SQS equivalent)
- Database: read replicas for analytics queries to prevent dashboard load degrading webhook processing
- Campaign dispatch: async queue-based dispatch; rate-limited per tenant to respect Meta's per-number rate limits
- Multi-tenancy: tenant isolation enforced at query level; no cross-tenant data leakage possible even under load

### 9.6 Accessibility & Browser Requirements *(new)*

- Dashboard must meet WCAG 2.1 Level AA
- Supported browsers: Chrome 120+, Edge 120+, Safari 17+, Firefox 121+
- Mobile-responsive: dashboard usable on 375px viewport (iPhone SE minimum)
- No functionality gated behind browser extensions

### 9.7 Internationalisation *(new)*

- UI language: English (Phase 1); Afrikaans, Zulu (Phase 3)
- Date/time: displayed in SAST (UTC+2) by default; user-overridable
- Currency: ZAR throughout; no USD display in customer-facing UI
- Phone numbers: E.164 format; default country code +27 with selector

### 9.8 Observability, SRE, and Alerting Requirements *(new)*

ChatClan must be operated through explicit service-level indicators (SLIs), service-level objectives (SLOs), actionable alerts, runbooks, and incident review. Monitoring must measure customer-impacting behaviour, not only server liveness.

Required telemetry:
- **Metrics:** request count, error rate, latency percentiles, webhook acknowledgment time, queue depth, job age, failed jobs, campaign throughput, Meta send failures, template rejection rate, payment webhook failures, AI provider latency/cost/error rate, backup success, restore drill status
- **Logs:** structured JSON logs with request id, tenant id, user id where applicable, correlation id, route/action, result, latency, and redacted error details
- **Traces:** distributed traces for API requests, webhook ingestion, campaign dispatch, payment reconciliation, AI workflow calls, and vendor integrations
- **Dashboards:** platform overview, API health, webhook health, campaign dispatch, queue/worker health, database health, vendor health, billing health, AI health, security events, and backup/DR health
- **Alerts:** tied to SLO breach risk or customer impact; every alert must link to an owner, severity, dashboard, and runbook

Baseline SLOs:
- API availability: 99.9% monthly
- Web dashboard availability: 99.5% monthly
- Webhook acknowledgement: 99.9% under 200ms excluding vendor/network incidents
- Inbox delivery latency: 95% of inbound messages visible to agents within 3 seconds after webhook receipt
- Campaign job pickup: 95% of queued recipients picked up within 2 minutes during normal load
- Payment reconciliation: 99% of valid PayFast ITNs reflected in subscription state within 5 minutes
- Backup success: 100% daily backup completion; monthly restore drill required before public launch

### 9.9 Incident Management and Business Continuity Requirements *(new)*

- Incident severities must be defined with customer impact, response time, update cadence, and escalation rules.
- SEV1/SEV2 incidents require incident commander, operations lead, communications owner, live incident document, customer-impact assessment, and postmortem decision.
- Postmortems are required for customer-visible downtime beyond threshold, data loss, security incident, failed backup/restore, prolonged vendor outage, manual production intervention, or SLO breach.
- Every critical dependency must have a documented runbook and tested fallback/degradation behaviour.
- Disaster recovery tests must validate RTO <1 hour and RPO <15 minutes before public launch, then quarterly.

### 9.10 Security Governance Requirements *(new)*

- Security control framework must map ChatClan controls to NIST CSF 2.0 categories: Govern, Identify, Protect, Detect, Respond, Recover.
- Application security verification must target OWASP ASVS Level 2 for public launch and define explicit exceptions where Level 2 is not yet met.
- Quarterly access reviews for platform users, tenant owners, production credentials, and support access.
- Vulnerability management must define severity, owner, SLA, remediation status, and evidence.
- Secrets must be stored only in approved secret stores or encrypted deployment configuration; rotation must be tested.
- Platform admin actions must be append-only audited, with tamper-evidence and exportable evidence.
- Vendor/subprocessor risk reviews must be maintained for Meta, payment processors, email providers, hosting providers, analytics/observability tools, and AI providers.

### 9.11 Platform Reliability Control Plane

- Every production background worker must publish a durable heartbeat containing a stable worker identifier, role, lifecycle state, software version, current job, processed-job count, last error, and last-seen time.
- A worker is stale when it misses the configured liveness window. Thresholds must be deployment configuration, visible to platform operators, and tuned to at least three expected heartbeat intervals.
- Running jobs older than the configured execution threshold must be surfaced as stuck without automatically discarding or replaying them.
- Jobs that exhaust automatic attempts must enter a dead-letter state with the original payload, attempt count, failure detail, and timestamps retained.
- Manual recovery is restricted to the Platform Owner role, requires a reason, creates a new job linked to the original, and writes both a recovery event and platform audit event. Failed records must remain immutable evidence.
- Connector reliability must aggregate Shopify, WooCommerce, and Google Drive sources, sync outcomes, duration, active alerts, and affected tenants across all workspaces for the preceding 24 hours.
- Provider incident signals must trigger when failures affect at least two tenants, or when three or more completed runs have at least a 50% failure rate. Operators must be able to declare a provider-linked incident from the signal without re-entering known evidence.
- Provider-linked incidents must remain part of the normal incident register, severity workflow, ownership model, timeline, guardrail controls, and resolution evidence.
- The Platform Owner reliability UI must use separate Overview, Workers, Providers, and Dead Letters views. Recovery and incident forms must remain hidden in drawers until invoked.
- Reliability APIs must require platform authentication; recovery and incident mutations must require the owner role. Tenant users must never access cross-tenant reliability data.

### 9.12 Reliability Alerting and On-Call Operations

- Worker, stuck-job, dead-letter, and correlated provider signals must create deduplicated platform alerts with severity, current snapshot, first/last detection, ownership, and immutable event history.
- Alerts must be available in-app and optionally delivered by email to configured platform roles, additional addresses, and the active on-call platform user.
- Platform Owners must configure minimum email severity, escalation delay, repeat cadence, notification roles, and on-call ownership without editing deployment files.
- Any authenticated platform operator may acknowledge an alert and accept ownership; assignment changes, policy changes, and incident links require the Platform Owner role.
- Unacknowledged alerts must escalate after the configured delay and repeat while the signal remains active. Delivery failures must be retained as alert events.
- Alerts must resolve automatically when the underlying signal recovers. A later recurrence must reopen the alert with a fresh escalation window while retaining historical evidence.
- Alerts linked to incidents must append a reliability event to the incident timeline and remain navigable from the alert center.
- Alert actions must produce platform audit events containing the actor, target, reason, and non-secret metadata.

### 9.13 Dead-Letter Safety and Resolution

- Queue producers and job processors must validate required identifiers before database, quota, or provider work. Numeric identifiers must be positive safe integers and must not accept string sentinels such as `"null"` or `"undefined"`.
- Validation failures must be classified as non-retryable so malformed work does not consume automatic retry capacity or repeatedly exercise dependencies.
- Linked retry must preserve the original failed record and must refuse payloads that remain structurally invalid. Operators must never substitute an unrelated tenant, campaign, contact, or provider resource merely to make a retry succeed.
- Platform Owners must be able to discard an invalid dead-letter job with a required reason. Discard must preserve the original payload and error, record the actor and timestamp, and emit a platform audit event.
- Dead-letter resolution history must distinguish linked retries from discarded invalid work. Resolved queue signals must immediately clear active alert and navigation counts while retaining historical alert events.

---

## 10. Billing & Monetisation

### 10.1 ChatClan Subscription Plans

| | **Starter** | **Growth** | **Pro** |
|---|---|---|---|
| **Price (ZAR/month, incl. VAT)** | R299 | R799 | R1,999 |
| **WhatsApp numbers** | 1 | 3 | Unlimited |
| **Contacts** | 2,000 | 10,000 | Unlimited |
| **Team seats** | 2 | 5 | Unlimited |
| **Campaigns/month** | 5 | Unlimited | Unlimited |
| **Chatbot flows** | 2 | 10 | Unlimited |
| **Automation rules** | 2 | 20 | Unlimited |
| **API access** | No | No | Yes |
| **Agency portal** | No | No | Yes |
| **White-label** | No | No | Add-on |
| **POPIA Compliance Centre** | Basic | Full | Full |
| **Support** | Email | Email + chat | Priority |

### 10.2 Overage Billing

Contacts above plan limit billed at R0.10/additional contact/month. Meta costs pass through directly — ChatClan does not mark up Meta fees.

### 10.3 Annual Billing Discount

20% discount for annual upfront payment; displayed prominently with monthly equivalent.

### 10.4 Free Trial

14-day free trial on Growth plan. No credit card required to start. Trial expiry surfaced at 7 days, 3 days, and on the day via in-app banners and WhatsApp message (with owner opt-in).

### 10.5 South African Payment Providers

| Provider | Use Case | Fees |
|----------|----------|------|
| **PayFast** | Primary — card, EFT, instant EFT, subscriptions | 3.5% + R2 (card); 2% (EFT) |
| **Ozow** | Instant bank EFT — zero chargeback risk | 1.5% flat |
| **Peach Payments** | Enterprise and international | Custom/volume |
| **PayGate** | Enterprise recurring billing | Quote-based |
| **Yoco** | Mobile-first, payment links | 2.95% |
| **Netcash** | Debit orders, DebiCheck (Q3 2026) | Monthly fee |

PayFast is the recommended default for subscription billing due to its native subscription management API and ITN webhooks.

### 10.6 Revenue Model Summary

ChatClan earns 100% of subscription revenue. Meta API costs are borne directly by the customer's WABA.

Additional future revenue streams:
- White-label agency licence fee (P2)
- Overage contact fees
- Affiliate referral commissions (P2)
- Premium template marketplace (P3)

### 10.7 Failed Payment Handling *(new)*

| Event | System Action |
|---|---|
| First failed payment | Retry after 3 days; email notification to account owner |
| Second failed payment | Retry after 7 days; in-app banner warning |
| Third failed payment | Account downgraded to read-only; campaigns paused |
| 30 days post-downgrade | Account data retained for 60 days; owner notified of pending deletion |
| 60 days post-downgrade | Account and all data deleted (POPIA-compliant data purge) |

---

## 11. Compliance & Legal Requirements

### 11.1 POPIA (Protection of Personal Information Act)

POPIA has been fully enforceable since 1 July 2021. April 2025 amendments strengthened consent requirements and explicitly extended opt-in obligations to WhatsApp as an electronic marketing channel. The Information Regulator's 2025/26 Annual Performance Plan signals tougher enforcement in 2026.

**POPIA requirements directly affecting ChatClan:**

**Consent management (S69 and S11):** Opt-in required for all marketing messages. Every contact must have an opt-in record: consent date, channel, scope. Opt-out mechanism accessible via every marketing message; opted-out contacts suppressed immediately and permanently.

**Data residency:** All personal information of South African data subjects stored in South Africa. ChatClan's data centres must be in South Africa.

**Data subject rights:** Mechanisms for data deletion requests, propagating to all backups within a reasonable timeframe.

**Security-compromise notification:** When ChatClan acts as operator, it must notify the responsible-party customer as soon as reasonably possible after discovering reasonable grounds to believe personal information was accessed or acquired by an unauthorised person. The responsible party must notify the Information Regulator and affected data subjects as soon as reasonably possible in the manner required by POPIA. POPIA does not impose a general 72-hour deadline, and current Information Regulator guidance states that all security compromises must be reported irrespective of assessed risk. Maintain a documented response plan and use the Regulator's current reporting channel.

**POPIA Compliance Centre (in-product):**
- Opt-in audit log (downloadable as PDF or CSV)
- Consent management settings
- Opt-out suppression list view
- Data deletion request workflow
- Privacy policy template for the business owner's own use
- Guidance on what constitutes "direct marketing" under POPIA

### 11.2 Meta Platform Policies

All ChatClan customers must comply with Meta's WhatsApp Business Policy and Commerce Policy. ChatClan must:
- Only send approved templates outside the 24-hour window
- Not allow spam or unsolicited campaigns
- Display clear guidance on opt-in requirements in the campaign builder
- Not allow categories prohibited by Meta (tobacco, weapons, payday loans in certain jurisdictions)

**AI-specific WhatsApp Business Solution constraints (current as of March 2026 terms):**
- ChatClan must not make general-purpose AI, LLM, or generative AI technology the primary product delivered through WhatsApp.
- AI may be used only as an incidental or ancillary service provider inside ChatClan's business messaging workflows.
- Business Solution Data, including anonymous, aggregate, or derived forms of WhatsApp data, must not be used to create, develop, train, or improve general AI models.
- Tenant-exclusive fine-tuning may be considered only where contractually permitted, isolated to that tenant, and not used to improve any other AI model or tenant experience.
- Each AI workflow must declare a business purpose and must not answer outside that purpose. Out-of-scope requests route to human handoff.
- AI providers must be treated as third-party service providers with written terms, security safeguards, purpose limitation, and data-processing restrictions.
- The product must retain a kill switch to disable AI auto-replies globally, per provider, per tenant, per workflow, and per conversation.

ChatClan's AI features are therefore framed as task-specific workflow assistants only: booking assistant, product discovery assistant, order-support assistant, FAQ assistant, agent reply drafter, and flow-building assistant. They are not open-ended WhatsApp AI companions.

### 11.3 Consumer Protection Act (CPA)

Marketing messages must comply with the CPA: clear sender identification, clear opt-out, no deceptive content. Template approval process must incorporate CPA compliance checks.

### 11.4 VAT

ChatClan is registered for VAT. All prices include VAT at 15%. Invoices are VAT-compliant with the VAT registration number displayed.

### 11.5 Data Processing Agreement (DPA) *(new)*

ChatClan acts as an operator of personal information on behalf of its business customers (responsible parties). ChatClan must provide a Data Processing Agreement (DPA) to all customers that:
- Defines ChatClan's obligations as operator
- Prohibits ChatClan from processing customer contact data for any purpose other than providing the platform service
- Specifies sub-processors (Meta, SA data centre provider, PayFast) and commits to notifying customers of sub-processor changes
- Includes a data deletion clause: upon account termination, all customer data deleted within 30 days

### 11.6 Terms of Service & Acceptable Use Policy *(new)*

A published Acceptable Use Policy (AUP) must prohibit:
- Sending unsolicited messages (spam)
- Importing contact lists without documented opt-in
- Using the platform for categories prohibited by Meta's Commerce Policy
- Impersonating another business or person

Violation of the AUP is grounds for immediate account suspension without refund.

---

## 12. Success Metrics & KPIs

### 12.1 Growth Metrics

| Metric | Month 3 Target | Month 6 Target | Month 12 Target |
|--------|---------------|----------------|-----------------|
| Registered accounts | 150 | 500 | 2,000 |
| Paying customers | 50 | 200 | 800 |
| Monthly Recurring Revenue (MRR) | R15,000 | R80,000 | R480,000 |
| Trial-to-paid conversion rate | 20% | 25% | 30% |
| Monthly churn rate | <8% | <6% | <5% |

### 12.2 Product Engagement Metrics

| Metric | Definition | Target (Month 6) |
|--------|-----------|------------------|
| Activation rate | % of signups who send first real campaign | >60% |
| Feature adoption — chatbot | % of paying customers who publish a flow | >35% |
| Feature adoption — inbox | % of paying customers with 2+ agents | >25% |
| DAU/MAU ratio | Daily active users as % of monthly | >40% |
| Time to first campaign | From signup to first campaign sent | <20 minutes |
| Support ticket rate | Tickets per 100 active customers/month | <5 |

### 12.3 Customer Success Metrics

| Metric | Target |
|--------|--------|
| Net Promoter Score (NPS) | >45 |
| CSAT on support interactions | >4.2/5 |
| Messages sent per customer per month | >1,000 |
| Average revenue per account (ARPA) | >R600/month |

### 12.4 AI Workflow Quality Metrics *(new)*

| Metric | Definition | Target |
|--------|------------|--------|
| AI draft acceptance rate | % of AI drafts sent with no or minor edits | >60% by Month 9 |
| AI auto-resolution containment | % of eligible low-risk conversations resolved without agent intervention | 20-35% by Month 12 |
| Human handoff accuracy | % of high-risk/low-confidence AI-routed conversations correctly handed to agents | >95% |
| AI unsafe-block rate | % of AI outputs blocked by policy/grounding checks | Tracked; reviewed weekly |
| Agent edit rate | % of AI drafts substantially rewritten before send | <30% by Month 12 |
| AI CSAT delta | CSAT difference between AI-assisted and human-only resolved conversations | AI-assisted no worse than -0.2 points |
| Provider cost per resolved conversation | LLM provider cost divided by AI-assisted resolved conversations | Below tenant plan margin threshold |
| Provider failover success | % of AI requests recovered through configured fallback provider | >99% for supported providers |
| Knowledge source recall | Expected grounding sources returned by the retrieval evaluation suite | >90% before auto-reply enablement |
| Knowledge isolation pass rate | Evaluation cases where no forbidden tenant/customer source is returned | 100% |
| Grounded draft rate | % of AI drafts with at least one approved source reference | >90% for factual workflows |
| Unsupported claim risk | Candidate-answer sentences without lexical/numeric support in retrieved facts | <5% before auto-reply enablement; heuristic reviewed with sampled human QA |

### 12.5 Compliance Metrics

- % of active accounts with complete POPIA opt-in audit log: >90%
- % of campaigns sent to fully opted-in contact lists: 100%
- Zero reportable data breaches in Year 1
- 100% of AI workflows mapped to a declared business purpose before activation
- 100% of AI provider calls logged with provider, model, purpose, tenant, policy-check outcome, and redacted prompt trace
- 0 instances of WhatsApp Business Solution Data used for cross-tenant or general-model training

### 12.6 Leading Indicator Metrics *(new)*

These metrics predict future health before lagging revenue indicators move:

| Leading Indicator | Why it matters | Alert threshold |
|---|---|---|
| Setup wizard completion rate | Predicts activation | <60% → review wizard UX |
| Time-to-first-campaign | Predicts retention | Median >30 min → investigate |
| Day 7 retention | Early churn predictor | <50% → review onboarding |
| Meta template approval rate | Predicts activation friction | <70% → improve template guidance |
| Support tickets at onboarding | Signals UX friction | >20% of new signups → sprint review |

### 12.7 Platform Operations Metrics *(new)*

| Metric | Definition | Target |
|---|---|---|
| API availability | Successful valid API requests / total valid API requests | 99.9% monthly |
| Webhook acknowledgement latency | % of Meta webhooks acknowledged within target | 99.9% under 200ms |
| Worker queue age | Oldest pending job age during normal operations | <2 minutes P95 |
| Failed job recovery | % of retryable failed jobs recovered automatically | >95% |
| Backup success | Completed daily encrypted backup | 100% daily |
| Restore drill success | Restore-test database verifies and smoke checks pass | Monthly before launch; quarterly after launch |
| Incident MTTA | Mean time to acknowledge SEV1/SEV2 incident | <10 minutes |
| Incident MTTR | Mean time to restore customer-impacting SEV1/SEV2 incident | <60 minutes for core service |
| Alert actionability | % of alerts with owner, runbook, severity, and dashboard | 100% |
| Platform audit completeness | % of high-risk admin actions with complete audit record | 100% |
| Tenant gross margin risk | % of active paid tenants below target margin | Reviewed weekly |
| Vendor health freshness | Time since last successful Meta/PayFast/SMTP/AI provider health check | <15 minutes for critical providers |

---

## 13. Roadmap & Phasing

### Phase 1 — Foundation (Months 1–3)

**Goal:** A sellable, safe, and stable core product.

Features:
- User authentication and account management, including email/password plus Google and Facebook social sign-in protected by server-verified reCAPTCHA
- Meta WABA connection wizard
- Contact import and opt-in management
- Template manager (creation, submission, approval tracking)
- Campaign builder (single broadcast)
- Basic analytics (delivered, read, replied per campaign)
- Unified inbox (basic multi-agent)
- PayFast subscription billing
- POPIA opt-in audit log
- 19-industry template library
- Platform owner console v1: tenant search, tenant health, subscription state, integration health, queue health, and audited admin actions
- Operational readiness v1: structured logs, health/readiness, startup check, beta smoke, backup command, restore drill runbook, production preflight, vendor checks
- Emergency kill switches for live Meta sends, campaign dispatch, PayFast checkout, public signup, and AI auto-replies

**Launch target:** Beta with 20 invited SA businesses.
**Go/No-Go criteria for Phase 2:** ≥15 beta businesses actively using the platform; zero P0 bugs; setup wizard completion rate ≥65%; platform owner can see tenant health, queue health, vendor readiness, failed jobs, billing state, and backup status without database access.

### Phase 2 — Engagement (Months 4–6)

**Goal:** Drive retention and expand value per customer.

Features:
- Chatbot flow builder (visual, with 19 industry templates)
- Automation rules engine
- AI workflow foundation: provider adapter interface, policy gate, redacted logging, and draft-only AI copy assistant beta
- AI-assisted flow builder beta for reviewed, task-specific draft flows
- Advanced contact segmentation
- Meta cost reporting dashboard
- Ozow and Yoco payment provider support
- In-app guided tours
- QR code and opt-in widget generator
- A/B campaign testing
- Observability v1: API/webhook/worker dashboards, alert thresholds, runbook links, request correlation, and SLO reporting
- Incident management v1: severity model, incident state record, owner roles, customer update cadence, and postmortem workflow
- Support operations v1: tenant support timeline, internal notes, escalation queues, SLA tracking

**Launch target:** Public launch; paid marketing begins.
**Go/No-Go criteria for Phase 3:** MRR ≥R80,000; monthly churn <6%; chatbot feature adoption ≥25%; AI features remain draft-only unless AI CSAT, handoff accuracy, and unsafe-block review meet launch thresholds; production SLO dashboards and SEV1/SEV2 incident process are active.

### Phase 3 — Revenue Expansion (Months 7–12)

**Goal:** Increase ARPA and open reseller channel.

Features:
- Agency and reseller portal
- White-label mode
- Shopify and WooCommerce integrations
- Zapier and Make connector
- Advanced analytics (revenue attribution, UTM tracking)
- Provider-neutral AI copy assistant and smart reply drafts
- AI intent router and smart handoff for low-risk workflows
- AI knowledge base with grounded replies from tenant-approved content
- Multi-provider LLM routing across approved providers such as OpenAI, Anthropic, Google, DeepSeek, and xAI/Grok
- Flow testing mode
- Drip sequences
- Multi-language support (Afrikaans and Zulu)
- Netcash and Peach Payments support
- Feature flag and entitlement control plane with tenant-level overrides and approval workflow for high-risk flags
- FinOps dashboard: tenant gross margin, Meta spend anomalies, AI spend, infrastructure allocation, and plan profitability
- Security governance dashboard mapped to NIST CSF and OWASP ASVS evidence

### Phase 4 — Scale (Year 2+)

Features:
- Controlled AI auto-reply for eligible low-risk, high-confidence workflows
- AI provider cost optimization and model A/B testing
- WhatsApp Calling API integration
- WhatsApp Flows (native form builder)
- Business Scoped User ID support
- ChatClan mobile app (iOS and Android)
- Expansion to secondary markets (Nigeria, Kenya, Zimbabwe)
- Public status page, trust center, formal audit evidence pack, advanced data warehouse, and partner operations console
- Mature AI governance: prompt/version registry, eval harness, controlled auto-reply approvals, provider benchmarking, and automated safety regression tests

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Meta changes API pricing in ways that increase customer costs | High | High | Transparent real-time cost reporting; diversify value proposition beyond cost savings |
| Meta rejects a customer's WABA or template | High | Medium | In-app guidance on rejection reasons; support SLA for resolution |
| POPIA enforcement action against a ChatClan customer | Medium | High | POPIA Compliance Centre built-in; contractual obligation on customers to obtain consent; exportable audit log |
| Competitor launches ZAR billing | Medium | Medium | First-mover advantage; POPIA-native design is structural; local brand trust |
| PayFast platform outage | Low | Medium | Multi-provider fallback (Ozow, Yoco); retry logic for subscription payments |
| WhatsApp number quality rating drops for a customer | Medium | Medium | In-app warnings when block rate approaches Meta's threshold; opt-in enforcement |
| Data breach affecting customer contacts | Low | Very High | AES-256 encryption; SA data centres; documented breach response plan; cyber insurance |
| Meta bans a customer's WABA for policy violation | Low | High | Terms of service; content moderation guidance; appeal support |
| AI provider restriction breach triggers Meta enforcement | Low | Very High | AI is ancillary only; declared workflow purposes; provider contracts; no general-purpose WhatsApp AI; monthly policy review |
| AI hallucination gives customers incorrect business information | Medium | High | Grounded retrieval only; confidence thresholds; draft-only default; human handoff; source-backed answer requirements |
| AI provider outage degrades customer conversations | Medium | Medium | Provider fallback routing; deterministic flow fallback; inbox handoff; provider health dashboard |
| AI provider cost overruns reduce gross margin | Medium | Medium | Cost ceilings per tenant/workflow; cheaper classifier models; response caching where compliant; monthly provider cost review |
| AI provider lock-in slows product iteration | Medium | Medium | Shared provider adapter interface; portable prompts/evals/schemas; model A/B testing |
| WhatsApp Business Solution Data is misused for model training | Low | Very High | Contractual prohibition; provider allowlist; no-training API flags where available; redacted logging; vendor audits |
| Platform owner account is compromised | Low | Very High | Mandatory MFA, least privilege, just-in-time support access, IP/device risk checks, admin action audit, emergency revoke procedure |
| Platform lacks operational visibility during a live outage | Medium | Very High | Platform owner console, SLO dashboards, structured logs/traces, runbook-linked alerts, incident command process |
| Backup exists but restore fails during a real incident | Medium | Very High | Monthly restore drills before launch; quarterly DR tests; restore-test database verification; documented RTO/RPO evidence |
| Feature rollout causes tenant-wide regression | Medium | High | Feature flags, staged rollout, tenant kill switches, smoke checks, rollback runbook, error-budget gate |
| Hidden vendor or AI costs erode gross margin | Medium | High | FinOps dashboard, cost ceilings, margin alerts, per-tenant cost attribution, provider routing controls |
| Support team accesses tenant data without appropriate reason | Medium | High | Reason-required support access, masking by default, time-boxed elevation, immutable audit trail, quarterly access review |
| Key engineer departure during Phase 1 build | Medium | High | *(new)* Code documentation standards enforced; pair programming on critical paths; knowledge base maintained; minimum 2 engineers with full-stack knowledge of each system |
| Beta customer feedback requires significant pivot | Medium | Medium | *(new)* Weekly beta check-ins; modular architecture allows feature-level iteration; Phase 2 gate requires validated metrics |
| SA load-shedding impacts data centre availability | Medium | Medium | *(new)* Confirm SA data centre providers have generator backup; SLA commitment from provider; test failover during Phase 1 |

---

## 15. Appendix

### Appendix A — WhatsApp Cloud API — Key Technical Reference

**Primary endpoint:** `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`

**Required headers:**
- `Authorization: Bearer {ACCESS_TOKEN}`
- `Content-Type: application/json`

**Outbound message types supported:**
- `text` — plain text (only within 24-hour service window)
- `template` — pre-approved template (outside service window)
- `interactive` — button lists, reply buttons, CTA URL buttons (within service window)
- `image`, `video`, `document`, `audio` — media messages
- `location` — share a location pin

**Inbound webhook events:**
- `messages` — new message from customer
- `statuses` — delivery/read receipt
- `errors` — failed delivery notifications
- `unsupported` — unsupported message type or unavailable first-message content; route to inbox with a safe fallback
- `order` — customer order from WhatsApp catalog, single-product, or multi-product message

**Message pricing categories (as of July 2025):**
- Per-message pricing model (conversation-based pricing deprecated July 2025)
- Service messages (replies within 24-hour window) free
- Marketing, Utility, Authentication templates charged per message
- South Africa rates are among the lower-priced markets globally following Meta's 2025 reductions

**Conversational automation reference:**
- Meta supports welcome messages, conversation prompts/ice breakers, and bot commands at the WhatsApp Business Account/phone-number level.
- ChatClan AI workflow prompts should map to these primitives where useful, but AI-generated replies still pass through ChatClan's policy gate before send.

**AI workflow reference constraints:**
- AI providers are allowed only as service providers to ChatClan's business messaging workflow.
- AI must be ancillary, not the primary WhatsApp product.
- WhatsApp Business Solution Data must not train, improve, or create general AI models.
- Customer-facing AI must be task-specific, grounded, auditable, and able to hand off to a human.

### Appendix B — 19 Target Industries and Primary Use Cases

| Industry | Primary Bot Use Cases |
|----------|-----------------------|
| E-commerce & Retail | Product discovery, order tracking, returns, flash sale alerts, abandoned cart |
| Healthcare | Appointment booking, symptom triage, medication reminders, lab results |
| Banking & Finance | Balance enquiry, fund transfers, loan applications, fraud alerts |
| Travel & Hospitality | Flight search, hotel booking, itinerary updates, check-in assistance |
| Education | Course enquiry, enrolment, assignment reminders, result notifications |
| Real Estate | Property listings, viewing booking, bond calculator, agent connection |
| Government & Public Services | Service enquiry, appointment booking, document status |
| Insurance | Quote generation, claim filing, policy enquiry, payment reminders |
| Telecom & Tech | Data balance, fault reporting, upgrade offers, SIM swap |
| HR & Recruitment | Job application, interview scheduling, onboarding documents |
| Logistics & Supply Chain | Shipment tracking, ETA updates, delivery confirmation, exception alerts |
| Food & Restaurant | Menu browse, table booking, order placement, delivery tracking |
| Media & News | Breaking news alerts, subscription management, content recommendations |
| NGO & Nonprofit | Donation collection, volunteer coordination, awareness campaigns |
| Automotive | Service booking, parts enquiry, vehicle status, test drive booking |
| Agriculture | Weather alerts, market prices, input ordering, extension services |
| Legal & Professional | Consultation booking, case status, document delivery |
| Manufacturing | Order status, quote requests, technical support |
| Sports & Events | Ticket booking, event reminders, live score updates |

### Appendix C — South African Payment Provider Integration Summary

| Provider | Integration Type | Subscription Support | Settlement Currency |
|----------|-----------------|---------------------|---------------------|
| PayFast | REST API + ITN webhook | Yes (native) | ZAR |
| Ozow | REST API + SHA512 webhook | Via payment links | ZAR |
| Peach Payments | Checkout API + recurring | Yes (REPEATED charge) | ZAR, USD |
| PayGate | PayWeb 3 + status query | Yes (via token) | ZAR |
| Yoco | Charge API + payment links | Via payment links | ZAR |
| Netcash | Debit order API | Yes (DebiCheck — Q3 2026) | ZAR |

### Appendix D — Glossary

| Term | Definition |
|------|-----------|
| WABA | WhatsApp Business Account — the Meta entity that owns a WhatsApp Business number |
| BSP | Business Solution Provider — a Meta-certified intermediary for WhatsApp Cloud API access |
| Cloud API | Meta's hosted WhatsApp API (as opposed to the deprecated On-Premises API) |
| ITN | Instant Transaction Notification — PayFast's server-to-server payment confirmation webhook |
| POPIA | Protection of Personal Information Act — South Africa's primary data protection law |
| Service window | The 24-hour window after a customer-initiated message during which service replies are free |
| Template message | A pre-approved WhatsApp message format required for business-initiated messages outside the service window |
| BSUID | Business Scoped User ID — Meta's 2026 rollout allowing businesses to message customers without phone numbers |
| DebiCheck | A South African authenticated debit order system managed by PASA |
| MRR | Monthly Recurring Revenue |
| ARPA | Average Revenue Per Account |
| UTM | Urchin Tracking Module — URL parameters for marketing attribution |
| QR flow | A WhatsApp QR code that pre-fills a greeting and triggers an automated opt-in flow when scanned |
| AI workflow | A task-specific assistant flow that uses an LLM for a bounded job such as intent classification, drafting, summarisation, or flow generation |
| AI provider | A third-party LLM service provider such as OpenAI, Anthropic, Google, DeepSeek, xAI/Grok, or a future approved provider |
| Grounding | Restricting AI output to tenant-approved data such as FAQs, catalog products, order records, templates, business policies, and conversation summaries |
| Handoff | Routing a conversation from automation or AI to a human agent |
| DPA | Data Processing Agreement — the contract defining obligations between a data operator (ChatClan) and responsible party (the business customer) |
| AUP | Acceptable Use Policy — ChatClan's published policy on permitted and prohibited platform use |
| RTO | Recovery Time Objective — maximum acceptable downtime before service is restored |
| RPO | Recovery Point Objective — maximum acceptable data loss measured in time |

### Appendix E — External Sources Consulted for v2.1 through v2.6 *(new)*

| Source | Requirement Area |
|---|---|
| Meta WhatsApp Business Platform developer documentation: Cloud API messages, templates, webhooks, conversational automation, status webhooks, unsupported messages, and order webhooks | Message routing, template/service-window requirements, webhook processing, commerce payloads, automation primitives |
| WhatsApp Business Solution Terms, last modified 6 March 2026 | AI-provider restrictions, Business Solution Data use limits, third-party service provider obligations |
| Existing ChatClan implementation in `src/services/chatbotFlows.js`, `src/services/chatbotRuntime.js`, `src/services/metaEventProcessor.js`, and `src/services/metaOnboarding.js` | Gap analysis between current deterministic automation and required AI workflow layer |
| NIST Cybersecurity Framework 2.0 | Security governance, risk management, detection, response, recovery, and evidence-ready operating controls |
| OWASP Application Security Verification Standard 5.0 | Application security verification requirements and security acceptance criteria |
| Google Site Reliability Engineering guidance on SLOs, incident management, and postmortems | SLO/SLI design, incident roles, live incident state, postmortem triggers, and reliability practices |
| OpenTelemetry documentation | Vendor-neutral observability model for metrics, logs, traces, instrumentation, and telemetry ownership |
| FinOps Framework | SaaS cost governance, margin visibility, cloud/AI cost accountability, and data-driven technology spend decisions |
| Shopify Admin GraphQL API product query documentation, API version 2026-07 | Product synchronisation endpoint, access-token header, and product/variant response contract |
| WooCommerce REST API v3 documentation | HTTPS Basic Authentication with consumer credentials and product collection synchronisation |
| Google Drive API v3 download, export, and OAuth scope documentation | Folder-scoped file listing, download capability checks, blob downloads, Google Workspace export, and OAuth token handling |
| Google OAuth 2.0 web-server flow and OAuth best-practices documentation | Authorization-code exchange, offline access, incremental scopes, exact redirect handling, CSRF state protection, secure token storage, revocation, and refresh-token lifecycle |
| Google Drive API scope classification documentation | Least-privilege scope selection and the verification/security-assessment gate for restricted `drive.readonly` access |
| Mammoth raw-text extraction documentation and pdf-parse v2 documentation | Server-side DOCX and PDF text extraction from validated buffers |

---

## 16. UX & Design Requirements *(new)*

### 16.1 Design Principles

1. **Local-first clarity.** Language, examples, and defaults should reflect South African business reality — rand amounts, local business types, SAST time zones. Never use US-market defaults.
2. **Mobile-aware, not mobile-first.** Most ChatClan users will manage campaigns from a laptop, but must be able to view the inbox on a phone. Target usability on 375px viewport minimum.
3. **Progressive disclosure.** Beginners (Zinhle) see only what they need to act. Advanced users (Dev, Thandeka) can surface power features without friction.
4. **Compliance without fear.** POPIA requirements are framed as safeguards ("This protects you and your customers"), not warnings. Errors are specific and fixable, not alarming.
5. **Delight at small wins.** Celebrate first campaign sent, first chatbot message handled, first opt-in recorded — with lightweight in-product celebrations.

### 16.2 Information Architecture

The main navigation must contain no more than 6 top-level items for Phase 1:

1. Dashboard (home/overview)
2. Campaigns
3. Inbox
4. Contacts
5. Flows (chatbot builder)
6. Settings

Analytics, Templates, and Automation are reachable from Campaigns and Flows to avoid navigation overload for new users.

### 16.3 Wireframe & Prototype Requirements

Before engineering begins on any P0 module, the design team must produce and get stakeholder sign-off on:
- Low-fidelity wireframes (information layout)
- High-fidelity mockup (visual design, component states)
- Interactive prototype (happy path + key error states)
- Empty states (no campaigns, no contacts, no flows)
- Error states for all destructive or irreversible actions

### 16.4 Component States Required for Every Feature

| State | Required |
|---|---|
| Empty (first use) | Yes — with actionable prompt |
| Loading | Yes — skeleton screens, not spinners |
| Success | Yes — confirmation message with next step |
| Error (recoverable) | Yes — specific error with fix instructions |
| Error (server/API) | Yes — friendly message with retry or support link |
| Disabled (permissions) | Yes — explain why and who can enable |

### 16.5 Accessibility Requirements

- Colour contrast ratio ≥ 4.5:1 for all text (WCAG 2.1 AA)
- All interactive elements keyboard-navigable
- Form fields have associated labels (no placeholder-only labels)
- All icons have accessible alt text or aria-label
- No information conveyed by colour alone

---

## 17. QA & Testing Strategy *(new)*

### 17.1 Testing Levels

| Level | Scope | Owner | When |
|---|---|---|---|
| Unit tests | Individual functions and components | Engineers | On every commit |
| Integration tests | API-to-database, Meta webhook handling | Engineers | On every PR |
| End-to-end (E2E) tests | Full user journeys (happy path + key errors) | QA | On every release candidate |
| Exploratory testing | Edge cases, unusual user behaviour | QA + PM | Weekly sprint review |
| Usability testing | Real users completing core tasks | PM + Design | Before each phase launch |
| Performance testing | Load at 500 and 5,000 concurrent users | Engineers | Before Phase 1 and Phase 3 launch |
| Security testing | OWASP ZAP automated scan | DevSecOps | Every deployment |
| Penetration test | Third-party external pentest | External vendor | Annual |

### 17.2 Critical Test Scenarios (P0 Features)

The following scenarios must pass before any production release:

1. A new user completes the full setup wizard and sends a test message in under 10 minutes.
2. A campaign is sent to 1,000 contacts and all opted-out contacts are automatically excluded.
3. A customer sends "STOP" and is suppressed from all future campaigns within 60 seconds.
4. A chatbot flow escalates to a human agent and the agent sees the full conversation history.
5. A failed PayFast payment triggers the correct retry and downgrade sequence.
6. A data deletion request propagates to conversation logs and contact records within 24 hours.
7. Two tenants cannot see each other's data under any navigation path.

### 17.3 Definition of Done

A feature is production-ready when:
- All acceptance criteria pass
- Unit test coverage ≥80% for the feature
- No P0 or P1 bugs outstanding
- E2E test for the feature's happy path passes
- Empty state, loading state, and error states are implemented and reviewed by design
- Performance tested under expected Phase 1 load
- POPIA-relevant features reviewed by the compliance lead

---

## 18. Go-to-Market Plan *(new)*

### 18.1 Launch Strategy

ChatClan targets a **Product-Led Growth (PLG)** motion supported by an agency channel.

**Phase 1 (Beta, Months 1–3):** 20 invited SA businesses across 5 industries. Selection criteria: 2–10 employees; existing WhatsApp users; willing to provide weekly feedback. Goal: validate product-market fit before public launch.

**Phase 2 (Public Launch, Month 4):** Paid digital acquisition begins. Agency outreach begins.

### 18.2 Acquisition Channels

| Channel | Tactic | Phase | Target CAC |
|---|---|---|---|
| Organic search | SEO-optimised content: "WhatsApp marketing South Africa," "POPIA WhatsApp compliance" | 2+ | R0 (organic) |
| Google Ads | Search ads on competitor terms and "WhatsApp business tool ZAR" | 2 | R800 |
| Meta Ads | Lead generation targeting SA SME owners 30–50 | 2 | R600 |
| Agency referral | Partner programme with digital marketing agencies | 2 | R200 (commission) |
| WhatsApp community | Active presence in SA SME WhatsApp groups | 1+ | R0 |
| PR / local media | Pitch to Ventureburn, Daily Maverick, BusinessTech on POPIA angle | 2 | R0 |

### 18.3 Pricing Communication

- Lead with ZAR pricing prominently
- Use "No USD, no surprises" as a differentiator
- Compare to competitor USD prices converted to ZAR at the prevailing rate
- Emphasise POPIA protection as a risk reduction story

### 18.4 Customer Success Model

| Tier | Support Model |
|---|---|
| Starter | Self-serve: help centre, in-app tooltips, email |
| Growth | Email + live chat; onboarding check-in call at day 3 |
| Pro / Agency | Dedicated CSM; monthly review call; priority support SLA <2 hours |

### 18.5 Launch Metrics

| Metric | Phase 1 Beta Target | Phase 2 Public Launch Target |
|---|---|---|
| Beta businesses active | 20 | — |
| Waitlist sign-ups | 200 | — |
| Paying customers at launch | — | 50 (Month 4) |
| Organic traffic (monthly) | — | 1,000 sessions |

### 18.6 Public Website Information Architecture

The public website is part of the product experience and must reduce uncertainty before registration. It must explain what ChatClan does, who it serves, how WhatsApp and Meta charges work, what is available now, and how customer information is protected.

**Required primary navigation**

| Group | Required destinations |
|---|---|
| Product | Team Inbox, Campaigns, Automation, AI Assist, Commerce, Analytics |
| Solutions | Retail & E-commerce, Services & Appointments, Agencies, Customer Support |
| Integrations | Integration directory, supported connectors, API and webhooks |
| Resources | Help Centre, Meta onboarding guide, pricing guide, changelog |
| Company and trust | Security, Subprocessors, Service Status, Contact, legal notices |
| Conversion | Pricing, Sign in, Start free trial |

**Landing-page content order**

1. Literal product category and South African value proposition.
2. Primary and secondary conversion actions.
3. Real product evidence showing inbox, campaigns, commerce, and governed AI workflows.
4. Outcome journey covering acquisition, service, conversion, and retention.
5. Product capability summaries linked to detailed pages.
6. Supported integrations and clear availability labels.
7. AI grounding, approval, escalation, audit, and provider-choice controls.
8. POPIA-conscious controls, security practices, and operational trust links.
9. ZAR subscription pricing separated from Meta message charges.
10. Guided Meta onboarding steps and prerequisites.
11. Frequently asked questions addressing numbers, templates, consent, billing, trial limits, and support.
12. Verified customer evidence when permission and source records exist.
13. Final conversion action and comprehensive footer navigation.

**Public page acceptance requirements**

- Every product page must state the customer problem, supported workflows, actual capabilities, safeguards, plan availability, related integrations, and next action.
- Product screenshots must come from the current product or an explicitly labelled illustrative environment.
- Solution pages must use workflows relevant to South African SMEs and must not imply legal, financial, medical, or regulatory outcomes that ChatClan cannot guarantee.
- The pricing page must distinguish ChatClan subscription charges from Meta usage charges and must state billing assumptions, plan limits, trial restrictions, cancellation handling, and tax treatment where confirmed.
- The integration directory must label every connector as available, beta, planned, or external. Planned integrations must not be presented as usable.
- Public documentation must provide searchable or clearly grouped setup, messaging, consent, template, billing, troubleshooting, integration, API, and security guidance.
- All public pages must have unique titles, descriptions, semantic headings, keyboard support, visible focus, responsive layouts, and no horizontal overflow at supported breakpoints.

### 18.7 Trust, Evidence, and Content Governance

ChatClan must compete through credible evidence rather than unsupported superlatives.

| Requirement | Rule |
|---|---|
| Partnership claims | Do not use “official Meta partner”, “BSP”, certification, or approval language until documentary evidence is recorded and current. |
| Customer proof | Logos, testimonials, case studies, customer counts, conversion figures, and savings claims require written permission and a traceable source. |
| Reliability claims | Uptime percentages require production monitoring history, an agreed measurement window, and published incident exclusions. |
| Security claims | Describe implemented controls. Do not imply ISO, SOC, PCI, or other certification before successful independent certification. |
| Feature availability | Use `Available`, `Beta`, `Planned`, and `External` labels backed by the release catalogue. |
| Pricing accuracy | Assign an owner and review subscription and Meta pricing explanations whenever Meta changes its rate model. |
| Legal accuracy | Privacy, POPIA, terms, subprocessors, retention, and cross-border disclosures require owner approval and dated revisions. |
| Competitive comparisons | Comparisons must be dated, sourced from public competitor material, factual, and reviewed before publication. |

**Required trust-centre pages**

- Security overview with implemented application, credential, tenant-isolation, monitoring, backup, and incident controls.
- Subprocessor register containing purpose, data category, processing location where known, and change date.
- Service-status page backed by production health monitoring before public launch.
- Privacy, terms, POPIA commitment, data deletion, and contact pages.
- Responsible security-reporting instructions and incident contact route.

**Content operations**

- Product Marketing owns positioning and page-level conversion goals.
- Product owns capability and availability accuracy.
- Engineering and Security approve technical and security statements.
- Legal or the Information Officer approves regulated and privacy content.
- Customer Success owns setup and troubleshooting accuracy.
- Every public page records an owner, review date, and review interval in the content catalogue.
- Broken-link, accessibility, metadata, and public-route smoke checks are release requirements.

### 18.8 Public Conversion and Lead Operations

ChatClan must turn public interest into an accountable sales workflow without treating an enquiry as marketing consent or creating a tenant prematurely.

**Lead capture requirements**

- Provide dedicated contact-sales and guided-demo routes with concise, responsive forms and an accessible confirmation state.
- Collect only the business-contact and workflow information needed to respond and qualify product fit.
- Require explicit permission to respond to the enquiry. Optional product-update consent must be a separate, unchecked choice.
- State clearly that a public enquiry does not create WhatsApp marketing consent.
- Protect submissions with reCAPTCHA, a honeypot, server-side validation, request-rate controls, payload limits, and generic error responses.
- Hash the requester IP rather than retaining the raw address for lead-abuse evidence. Define and enforce a lead-record retention period.
- Deduplicate repeated submissions from the same email and enquiry type within 24 hours while retaining an attempt count and the latest enquiry context.
- Return a non-sequential public reference and send an acknowledgement without exposing internal priority, ownership, or routing rules.

**Routing and platform operations**

- Route leads by declared use case, team size, expected conversation volume, and demo intent.
- Expose new, contacted, qualified, disqualified, and converted lifecycle states in the Platform Owner dashboard.
- Keep leads outside tenant workspaces until a deliberate conversion or signup action creates a tenant.
- Record owner assignment and lifecycle updates in the platform audit trail.
- Store source path and allowlisted UTM fields; do not store arbitrary tracking payloads or complete referrer URLs.
- Internal notifications must route to a configured sales mailbox and use the prospect email only as a reply address.

**Privacy-aware measurement and discoverability**

- Essential storage and optional analytics consent must be explained separately; optional analytics remains off until affirmative choice.
- Public analytics integrations may initialize only after consent and must receive allowlisted events without form contents, email, phone, message text, or other direct identifiers.
- Every indexable public page must provide a unique title, description, canonical URL, Open Graph metadata, and CSP-compliant structured data.
- Conversion events must distinguish trial signup, demo request, contact-sales submission, and authenticated activation without double-counting duplicate submissions.
- Release checks cover keyboard submission, error and success announcements, mobile layout, consent persistence, reCAPTCHA action matching, deduplication, email delivery, platform-owner visibility, and audit evidence.

### 18.9 Sales Operations and CRM Interoperability

Public enquiries must progress through an accountable sales workflow without turning ChatClan into an unrestricted repository of prospect data.

**Ownership, response, and activity requirements**

- Assign configurable response deadlines by priority and show on-track, at-risk, breached, met, and closed states in the Platform Owner queue.
- Support explicit owner assignment, next-follow-up scheduling, disqualification reasons, and overdue follow-up indicators.
- Keep an append-only activity timeline for creation, assignment, lifecycle changes, notes, CRM attempts, and delivery outcomes.
- Require a reason before disqualifying a lead. Record conversion timestamps without deleting earlier qualification evidence.
- Measure lead volume, open work, high-priority work, SLA breaches, conversion rate, and average first-response time without exposing prospect data in aggregate telemetry.

**CRM and export requirements**

- CRM delivery is disabled by default and may activate only when an operator configures an HTTPS endpoint and secret through deployment secrets.
- Outbound CRM payloads include only the consented contact, qualification, routing, and allowlisted attribution fields required for sales processing. IP hashes, user agents, internal audit data, and credentials must never leave ChatClan.
- Sign the exact JSON request body with HMAC-SHA256 and include unique delivery and event identifiers so receivers can authenticate and deduplicate requests.
- Process CRM delivery through the durable worker queue with bounded timeouts, exponential retries for network, rate-limit, and server errors, and non-retryable handling for permanent client/configuration failures.
- Record delivery state and attempt evidence in the lead timeline without retaining remote response bodies that may contain secrets or personal information.
- Platform Owner CSV export must omit abuse/security evidence and neutralise spreadsheet formulas in user-controlled values.
- CRM destinations are subprocessors when they receive personal information and must be reflected in agreements, privacy disclosures, retention controls, and operator records before production activation.
- Platform Owners must configure CRM credentials through a drawer that returns masked values only; credentials must be encrypted at rest, auditable, replaceable without environment-file editing, and never returned to browser code after submission.
- HubSpot authentication should use an organisation-owned, least-privilege Service Key. ChatClan must track the key owner and rotation date while HubSpot Service Keys remain in beta.
- HubSpot delivery must expose `Contacts only` and `Contacts + Leads` modes. Contacts-only is the compatibility default; Contacts + Leads may be enabled only after a live account capability test confirms Leads API access.
- Provider health checks and delivery errors must identify the failed provider operation without logging credentials or remote response bodies containing personal information.

---

## 19. Open Questions & Decisions Log *(new)*

| # | Question | Owner | Status | Due Date |
|---|---|---|---|---|
| OQ-01 | Will ChatClan apply for BSP status directly, or partner with an existing BSP for Phase 1? BSP status provides more control and higher messaging limits but takes 2–4 months to obtain. | CEO / CTO | Open | Month 1, Week 2 |
| OQ-02 | What is the pricing model for white-label: flat monthly add-on or per-seat? | Head of Product | Open | Phase 2 kickoff |
| OQ-03 | Which SA data centre provider will host primary infrastructure? Preference is for a provider with ISO 27001 certification and published SA data residency commitment. Candidates: AWS Cape Town (af-south-1), Azure South Africa North, or a local provider. | CTO | Open | Month 1, Week 3 |
| OQ-04 | Do we require phone number verification (OTP) at signup, or is email verification sufficient for Phase 1? | Head of Product | Open | Phase 1 sprint planning |
| OQ-05 | Will the Starter plan include the POPIA Compliance Centre at "Basic" level — what specifically is excluded in Basic vs. Full? | Head of Product / Legal | Open | Phase 1 sprint planning |
| OQ-06 | Who is the accountable Information Officer under POPIA for ChatClan? This is a legal obligation. | CEO / Legal | Open | Before Phase 1 launch |
| OQ-07 | What is the agency commission rate for the referral programme, and how is it structured (flat fee, % of MRR, etc.)? | CEO / Sales | Open | Phase 2 kickoff |
| OQ-08 | Should the 14-day trial be on Growth (as written) or Starter? Growth gives users access to more features but may create downgrade friction at trial end. | Head of Product | Open | Phase 1 sprint planning |

---

## 20. Document Changelog *(new)*

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | June 2026 | Product Team | Initial draft |
| 2.0 | June 2026 | Product Team (revised) | Added user stories and acceptance criteria to all FR items; added UX & Design Requirements (Section 16); added QA & Testing Strategy (Section 17); added Go-to-Market Plan (Section 18); added Open Questions Log (Section 19); added Document Changelog (Section 20); added system dependencies and data architecture to Section 7; added scalability, accessibility, i18n to Section 9; added failed payment handling to Section 10; added DPA and AUP to Section 11; added leading indicator metrics to Section 12; added go/no-go criteria to Section 13; added three new risks to Section 14; added competitive risk scenarios to Section 4; added validated assumptions to Section 2; added scope statement to Section 1; added strategic bets to Section 5; added persona pain/gain map to Section 6 |
| 2.1 | July 2026 | Product Team + Meta docs review | Added provider-neutral AI workflow orchestration layer; clarified AI as ancillary/task-specific under WhatsApp Business Solution Terms; added LLM provider routing for OpenAI, Anthropic, Google, DeepSeek, and xAI/Grok; added AI-assisted flow builder, intent router, grounded replies, quality feedback loop, AI metrics, AI risks, roadmap gates, and external sources consulted |
| 2.2 | July 2026 | Product Team + SaaS operations review | Added Platform Owner & Operations Console; expanded observability, SRE, incident management, security governance, support operations, feature flags, entitlements, kill switches, FinOps, AI governance operations, platform operations metrics, roadmap gates, and risks using current SaaS best-practice references |
| 2.3 | July 2026 | Product Team + AI quality review | Added governed CSV/text/Markdown knowledge ingestion, provenance and deduplication requirements, normalized external adapter contract, repeatable retrieval evaluation suites, grounding and isolation quality gates, and unsupported-claim risk measurement |
| 2.4 | July 2026 | Product Team + connector documentation review | Added PDF/DOCX extraction; live Shopify, WooCommerce, and Google Drive knowledge connectors; encrypted and masked credentials; scheduled retryable sync; health and credential rotation controls; and deletion semantics that cancel work and archive derived knowledge |
| 2.5 | July 2026 | Product Team + Google OAuth and connector operations review | Added Google Drive OAuth consent, tenant-bound one-time state, encrypted offline tokens, revocation, restricted-scope rollout gates, connector sync-run telemetry, retry history, freshness SLAs, and an operations dashboard with actionable alerts |
| 2.6 | July 2026 | Product Team + connector reliability review | Added machine-checkable OAuth sandbox and production readiness, a Google rollout runbook, durable connector alerts, role-based and additional email routing, delivery evidence, acknowledgement ownership, timed escalation, and automatic recovery history |
| 2.7 | July 2026 | Product Team + platform operations review | Added durable worker heartbeat telemetry, stale worker and stuck-job detection, immutable dead-letter replay with owner audit evidence, cross-tenant connector reliability aggregation, provider incident correlation, and a responsive reliability operations workspace |
| 2.8 | July 2026 | Product Team + on-call operations review | Added durable platform reliability alerts, email and in-app notification delivery, configurable on-call ownership, acknowledgement and assignment controls, timed repeat escalation, automatic resolution, delivery evidence, and incident timeline linking |
| 2.9 | July 2026 | Product Team + queue safety review | Added strict asynchronous job payload validation, non-retryable validation failures, guarded dead-letter replay, audited invalid-job discard with preserved evidence, queue action history, and immediate active-alert count reconciliation |
| 2.10 | July 2026 | Product Team + Google OAuth production-readiness review | Added strict Google web-client and secret validation, exact callback-to-application-origin matching, valid sandbox tester checks, full-folder scope enforcement, DirectAdmin rollout controls, release evidence requirements, and a separate future Google Picker plus `drive.file` least-privilege mode |
| 2.11 | July 2026 | Product Team + competitive public-experience review | Added outcome-led public information architecture, detailed product and solution education, pricing transparency, trust-centre requirements, evidence integrity controls, content ownership, accessibility and SEO acceptance criteria, and public-route release gates informed by Twilio, WATI, respond.io, 360dialog, SleekFlow, and Clickatell. |
| 2.12 | July 2026 | Product Team + conversion operations review | Added governed contact-sales and demo lead capture, explicit response consent separate from marketing opt-in, abuse protection, hashed IP evidence, deduplication, source attribution, routing priority, acknowledgement and sales notifications, Platform Owner lead lifecycle controls, privacy-aware analytics consent, CSP-compliant structured data, and conversion release gates. |
| 2.13 | July 2026 | Product Team + sales operations review | Added configurable lead response SLAs, ownership, follow-up scheduling, disqualification evidence, append-only activity history, conversion analytics, privacy-scoped CSV export, and durable HMAC-signed CRM webhook delivery with retries and audit evidence. |
| 2.14 | July 2026 | Product Team + HubSpot documentation review | Added native HubSpot private-app delivery, email-based contact upsert, idempotent Lead creation and association, provider-neutral CRM routing, retry classification, and deadline-driven lead SLA reminders and escalation notifications. |
| 2.15 | July 2026 | Product Team + HubSpot Service Keys documentation and live sandbox review | Replaced legacy private-app guidance with least-privilege Service Keys, encrypted owner-managed CRM configuration, masked status, live health checks, explicit Contacts-only and Contacts + Leads capability modes, and endpoint-specific delivery diagnostics. |
| 2.16 | July 2026 | Product Team + CRM OAuth documentation review | Added tenant-facing HubSpot, Salesforce, Zoho CRM, and Pipedrive OAuth connections, provider-aware field mapping, encrypted offline tokens, idempotent scheduled contact sync, run history, health checks, pause/resume, and failure recovery. |

---

*ChatClan Product Requirements Document — Version 2.16 — July 2026*
*Confidential — Internal use only*
