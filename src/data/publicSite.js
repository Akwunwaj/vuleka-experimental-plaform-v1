const productPages = {
  '/product/team-inbox': {
    kind: 'Product',
    title: 'A shared WhatsApp inbox your whole team can work from',
    description: 'Assign conversations, retain customer context, collaborate privately, and keep human ownership visible from first reply to resolution.',
    availability: 'Available',
    proofTitle: 'Keep every customer conversation accountable',
    proofItems: [
      ['Ownership', 'Assign conversations to the right person and make responsibility visible.'],
      ['Context', 'Review contact history, notes, consent, and conversation events together.'],
      ['Handoff', 'Move from automation or AI assistance to a person without losing the thread.']
    ],
    sections: [
      { title: 'Work as one service team', body: 'ChatClan centralises WhatsApp conversations so teams do not depend on one phone or an informal handover process.', bullets: ['Conversation assignment and ownership', 'Unread and service-level visibility', 'Internal notes and customer context', 'Human-controlled replies and escalation'] },
      { title: 'Use AI as assistance, not an invisible operator', body: 'Agents can prepare grounded drafts from approved knowledge while retaining the decision to edit, send, reject, or escalate.', bullets: ['Knowledge-grounded drafting', 'Provider-neutral model routing', 'Citation and quality evidence', 'Human approval and audit history'] },
      { title: 'Designed for accountable customer service', body: 'Workspace roles, tenant boundaries, consent evidence, and operational events help businesses manage customer communication consistently.' }
    ],
    faq: [
      ['Can multiple agents use one WhatsApp number?', 'Yes. Team access is managed in ChatClan while the number remains connected through the WhatsApp Business Platform. Plan seat limits apply.'],
      ['Does AI send replies automatically?', 'The current assisted-inbox workflow prepares drafts for human review. Broader automation remains controlled by workspace policies and rollout gates.']
    ]
  },
  '/product/campaigns': {
    kind: 'Product',
    title: 'WhatsApp campaigns built around consent and delivery evidence',
    description: 'Segment opted-in contacts, prepare approved templates, control dispatch, and understand delivery outcomes without losing compliance context.',
    availability: 'Available',
    proofTitle: 'Move from audience to measured delivery',
    proofItems: [
      ['Prepare', 'Build a campaign around an approved WhatsApp template and a defined audience.'],
      ['Protect', 'Suppress opted-out contacts and retain consent evidence before dispatch.'],
      ['Measure', 'Review queued, sent, delivered, read, failed, and cost-related events.']
    ],
    sections: [
      { title: 'Campaign preparation with guardrails', body: 'ChatClan checks plan access, recipient readiness, consent state, and template requirements before messages enter the dispatch queue.', bullets: ['Audience segmentation', 'Consent-aware recipient preparation', 'Template selection and readiness', 'Scheduled and controlled dispatch'] },
      { title: 'Delivery and cost visibility', body: 'Webhook events and Meta cost records create an operational view of what happened after a campaign was submitted.', bullets: ['Delivery status tracking', 'Failure diagnostics', 'Read and response analytics', 'Meta cost reporting separated from subscription fees'] },
      { title: 'Built for responsible direct marketing', body: 'ChatClan provides controls and evidence, while each customer remains responsible for determining a lawful basis and following POPIA and WhatsApp policy requirements.' }
    ],
    faq: [
      ['Can I message any imported contact?', 'No. Campaign preparation requires appropriate consent or another valid customer basis, and opted-out contacts are suppressed.'],
      ['Are Meta message charges included?', 'No. ChatClan subscription fees and Meta usage charges are separate. Applicable Meta charges depend on message category and recipient market.']
    ]
  },
  '/product/automation': {
    kind: 'Product',
    title: 'Build repeatable WhatsApp workflows without losing human control',
    description: 'Create structured flows for FAQs, bookings, order updates, qualification, and support, with explicit fallbacks and handoff paths.',
    availability: 'Available',
    proofTitle: 'Turn common requests into dependable workflows',
    proofItems: [
      ['Start', 'Use a workflow starter tailored to common South African business scenarios.'],
      ['Adapt', 'Configure messages, buttons, conditions, variables, and business actions.'],
      ['Test', 'Simulate the flow and confirm fallback and human-handoff behaviour.']
    ],
    sections: [
      { title: 'Structured automation first', body: 'Deterministic flow steps remain useful for high-confidence tasks where predictable wording and outcomes matter.', bullets: ['Replies and interactive choices', 'Conditions and routing', 'Business-hour and fallback handling', 'Human handoff'] },
      { title: 'AI where language is less predictable', body: 'Task-specific AI can classify intent or prepare grounded content while workflow policy controls what happens next.', bullets: ['Intent assistance', 'Knowledge retrieval', 'Quality evaluation', 'Provider fallback and audit evidence'] },
      { title: 'Test before customer exposure', body: 'Flow simulation and controlled rollout reduce the chance of broken branches, unsupported answers, and dead ends.' }
    ],
    faq: [
      ['Do I need to code?', 'No for normal workflow construction. API and webhook options are intended for teams that need deeper integration.'],
      ['Can a customer reach a person?', 'Flows should include a clear human-handoff route, especially where the request is sensitive, unsupported, or unresolved.']
    ]
  },
  '/product/ai-assist': {
    kind: 'Product',
    title: 'Provider-independent AI grounded in approved business knowledge',
    description: 'Use OpenAI, Google, Anthropic, DeepSeek, or xAI through a governed workflow layer that controls retrieval, approval, fallback, quality, and audit evidence.',
    availability: 'Beta',
    proofTitle: 'ChatClan owns the workflow; providers supply models',
    proofItems: [
      ['Ground', 'Retrieve from approved FAQs, products, policies, documents, and connectors.'],
      ['Govern', 'Apply tenant policy, model routing, redaction, approval, and escalation.'],
      ['Evaluate', 'Measure citation support, completeness, unsupported claims, latency, and adoption.']
    ],
    sections: [
      { title: 'Choose providers without rebuilding workflows', body: 'The model provider is configurable infrastructure. ChatClan keeps the business workflow, knowledge boundaries, approval rules, and evidence consistent.', bullets: ['OpenAI adapter', 'Google adapter', 'Anthropic adapter', 'DeepSeek adapter', 'xAI/Grok adapter'] },
      { title: 'Knowledge with provenance', body: 'Imported and connected knowledge retains source identity, freshness, indexing state, and deletion controls.', bullets: ['CSV, text, Markdown, PDF, and DOCX ingestion', 'Shopify, WooCommerce, and Google Drive connectors in beta', 'Citation-aware retrieval', 'Freshness and connector health monitoring'] },
      { title: 'Human review remains a product feature', body: 'AI drafts can be edited, rejected, or escalated. ChatClan records feedback and quality evidence rather than treating model output as automatically correct.' }
    ],
    faq: [
      ['Does ChatClan train a public model on my conversations?', 'ChatClan does not operate its own public foundation model. Processing depends on the provider selected and the applicable customer and provider configuration.'],
      ['Can I switch providers?', 'The architecture supports provider routing and fallback. Production availability depends on configured credentials, plan access, and provider health.']
    ]
  },
  '/product/commerce': {
    kind: 'Product',
    title: 'Turn product conversations into trackable orders',
    description: 'Bring products, stock context, customer conversations, order preparation, and follow-up automation into one WhatsApp-oriented workspace.',
    availability: 'Beta',
    proofTitle: 'Keep the sale connected to the conversation',
    proofItems: [
      ['Discover', 'Share products and answer product questions with current catalogue context.'],
      ['Prepare', 'Create and review orders while retaining customer and conversation history.'],
      ['Follow up', 'Use reminders and status messages without rebuilding the customer journey.']
    ],
    sections: [
      { title: 'A practical commerce workspace', body: 'ChatClan combines catalogue records, product selection, order state, coupons, returns, and customer segments for conversational selling.', bullets: ['Products and collections', 'Inventory alerts', 'Order preparation and status', 'Coupons and abandoned-cart workflows', 'Returns and customer segments'] },
      { title: 'Connect existing stores', body: 'Shopify and WooCommerce connectors are in beta for knowledge and catalogue-related workflows. Availability depends on credentials and connector health.' },
      { title: 'Payments require explicit integration', body: 'ChatClan must not imply that payment is complete until a supported payment provider confirms the transaction and the order record is reconciled.' }
    ],
    faq: [
      ['Can customers pay inside WhatsApp today?', 'Native in-chat payment is not currently claimed. Payment and checkout behaviour depends on the configured provider and released integration.'],
      ['Can I connect Shopify or WooCommerce?', 'Connector adapters exist in beta. Production use requires credential configuration, live sandbox validation, and operational monitoring.']
    ]
  },
  '/product/analytics': {
    kind: 'Product',
    title: 'See messaging performance, customer operations, and platform health',
    description: 'Understand campaign delivery, conversation workload, Meta costs, commerce activity, AI quality, and connector reliability from accountable source events.',
    availability: 'Available',
    proofTitle: 'Metrics that lead to an operational decision',
    proofItems: [
      ['Messaging', 'Track delivery, reads, responses, failures, templates, and Meta cost records.'],
      ['Service', 'Review conversation ownership, unread demand, and team activity.'],
      ['Quality', 'Monitor AI evaluations, connector freshness, incidents, and recovery evidence.']
    ],
    sections: [
      { title: 'Campaign and messaging analytics', body: 'Delivery and webhook events create a traceable view of campaign and conversation performance.', bullets: ['Delivery funnel', 'Read and response outcomes', 'Template and recipient diagnostics', 'Meta cost reporting'] },
      { title: 'AI and connector operations', body: 'Quality and reliability views expose whether knowledge is fresh, evaluations pass, providers are healthy, and background work is progressing.' },
      { title: 'No invented business outcomes', body: 'Revenue and conversion metrics must be tied to configured commerce or attribution records. ChatClan does not infer sales that cannot be supported by source data.' }
    ],
    faq: [
      ['Can I export reports?', 'Current export availability depends on the report and plan. Public descriptions will be updated as each export is released.'],
      ['Does ChatClan include Meta charges?', 'ChatClan records available Meta cost data separately from the platform subscription so customers can understand both layers.']
    ]
  }
};

const solutionPages = {
  '/solutions/retail': {
    kind: 'Solution',
    title: 'Conversational retail for South African stores and online sellers',
    description: 'Help customers discover products, ask questions, receive order updates, and return for relevant offers through one accountable WhatsApp workflow.',
    availability: 'Use case',
    proofTitle: 'A connected retail journey',
    proofItems: [['Acquire', 'Capture opted-in leads from campaigns, QR codes, and customer enquiries.'], ['Convert', 'Answer product questions and prepare trackable orders.'], ['Retain', 'Send relevant updates, replenishment reminders, and service follow-ups.']],
    sections: [
      { title: 'Useful retail workflows', body: 'Start with product enquiries, availability, promotions, order status, abandoned carts, returns, and loyalty follow-ups.', bullets: ['Product and catalogue assistance', 'Segmented consent-aware campaigns', 'Order updates and service conversations', 'Human handoff for exceptions'] },
      { title: 'Designed for local cost visibility', body: 'ZAR subscription pricing remains separate from Meta message charges, helping businesses understand platform and usage costs.' }
    ],
    faq: [['Is ChatClan a replacement for my online store?', 'No. ChatClan can connect conversational workflows to commerce data; the existing store or order system remains an important system of record.']]
  },
  '/solutions/services': {
    kind: 'Solution',
    title: 'Bookings, quotations, reminders, and support in one WhatsApp journey',
    description: 'Give service businesses a structured way to qualify enquiries, coordinate appointments, send reminders, and keep follow-up ownership visible.',
    availability: 'Use case',
    proofTitle: 'Reduce missed enquiries and manual follow-up',
    proofItems: [['Qualify', 'Collect the service, location, timing, and contact details needed to proceed.'], ['Schedule', 'Guide booking requests and reminders through structured workflows.'], ['Resolve', 'Escalate exceptions to a person with the customer context attached.']],
    sections: [
      { title: 'Useful service workflows', body: 'Applicable examples include professional services, property enquiries, hospitality, automotive, education, and appointment-led businesses.', bullets: ['Lead qualification', 'Quotation information capture', 'Appointment reminders', 'FAQ and document guidance', 'Service follow-up'] },
      { title: 'Sensitive work stays human-governed', body: 'AI should assist with approved information and routine tasks, not replace qualified judgement in regulated or high-impact decisions.' }
    ],
    faq: [['Does ChatClan provide a calendar?', 'ChatClan can orchestrate booking workflows, while live availability and confirmation depend on a released calendar or business-system integration.']]
  },
  '/solutions/agencies': {
    kind: 'Solution',
    title: 'Manage multiple client WhatsApp workspaces with operational discipline',
    description: 'Give agencies repeatable onboarding, templates, campaign operations, permissions, and reliability visibility without mixing client data.',
    availability: 'Planned',
    proofTitle: 'A safer route from one client to many',
    proofItems: [['Separate', 'Keep tenant data, credentials, users, and audit evidence isolated.'], ['Standardise', 'Reuse reviewed workflow and campaign starters across appropriate clients.'], ['Operate', 'Monitor onboarding, provider health, usage, and incidents across the portfolio.']],
    sections: [
      { title: 'Agency capabilities are being phased', body: 'Tenant isolation and platform operations exist, while the dedicated reseller portal and white-label controls remain roadmap items.', bullets: ['Client workspace separation', 'Reusable libraries', 'Role and entitlement controls', 'Cross-tenant reliability operations'] },
      { title: 'Availability must remain explicit', body: 'ChatClan will not market white-label or reseller billing as available until the complete agency workflow is released and tested.' }
    ],
    faq: [['Can agencies white-label ChatClan today?', 'No. White-label functionality is planned and must pass product, billing, support, and tenant-safety release gates before sale.']]
  },
  '/solutions/customer-support': {
    kind: 'Solution',
    title: 'Customer support that combines automation, AI assistance, and people',
    description: 'Resolve routine questions quickly while preserving ownership, escalation, approved knowledge, and a clear route to a human agent.',
    availability: 'Available',
    proofTitle: 'Automate the routine; surface the important',
    proofItems: [['Answer', 'Use structured flows and approved knowledge for common questions.'], ['Route', 'Assign conversations by context, ownership, and escalation need.'], ['Improve', 'Review outcomes, feedback, unresolved demand, and AI quality evidence.']],
    sections: [
      { title: 'A layered service model', body: 'Structured workflows handle predictable steps, AI assists with language and retrieval, and people retain control over exceptions and sensitive cases.', bullets: ['FAQ and self-service flows', 'Grounded draft replies', 'Conversation assignment', 'Notes and customer history', 'Escalation and audit evidence'] },
      { title: 'Measure service honestly', body: 'Operational metrics should reflect real events such as unread demand, ownership, response activity, delivery status, and resolution evidence.' }
    ],
    faq: [['Is this an autonomous support agent?', 'The current product emphasises assisted and governed workflows. Automation scope depends on workspace policy, released capabilities, and human-handoff controls.']]
  }
};

const directoryPages = {
  '/pricing': {
    kind: 'Pricing',
    title: 'Straightforward ZAR plans with Meta usage shown separately',
    description: 'Choose a ChatClan subscription for your workspace, then monitor applicable WhatsApp message charges as a separate usage layer.',
    availability: '14-day trial',
    proofTitle: 'Understand the full cost before sending',
    proofItems: [['Platform', 'A monthly ChatClan subscription based on workspace capabilities and limits.'], ['Messaging', 'Meta usage charges based on its maintained message categories and destination rates.'], ['Optional services', 'Only enabled providers and integrations can introduce additional external charges.']],
    sections: [
      { title: 'A controlled free trial', body: 'The trial is intended for setup, product evaluation, and approved internal testing. Live messaging and paid-provider actions may require activation, credentials, or a funded external account.' },
      { title: 'Plan limits are enforced in the product', body: 'Contact, campaign, seat, number, integration, and API entitlements are checked by the workspace rather than presented as marketing-only limits.' },
      { title: 'Meta pricing can change', body: 'ChatClan links to maintained Meta pricing information and reviews its explanation when Meta updates categories, free entry points, service windows, or destination rates.' }
    ],
    faq: [
      ['Are Meta WhatsApp charges included in the monthly price?', 'No. ChatClan subscription charges and Meta usage charges are separate.'],
      ['Do I need a credit card for the trial?', 'No credit card is required to create the 14-day trial workspace. Some external providers may require their own funded or verified account.'],
      ['Can I change plans?', 'Workspace owners can review available plans and billing status. Upgrade, downgrade, proration, and cancellation behaviour must follow the released billing workflow and terms.']
    ]
  },
  '/integrations': {
    kind: 'Integrations',
    title: 'Connect ChatClan to the tools that hold your business context',
    description: 'Bring approved commerce, document, and AI-provider context into governed WhatsApp workflows with explicit availability and health controls.',
    availability: 'Directory',
    proofTitle: 'Current integration catalogue',
    proofItems: [['WhatsApp Cloud API - Available', 'Messaging, templates, webhooks, delivery events, and account onboarding.'], ['Shopify and WooCommerce - Beta', 'Commerce and knowledge connector adapters with scheduled synchronisation.'], ['Google Drive - Beta', 'OAuth-based document knowledge synchronisation pending production credential approval.'], ['AI providers - Beta', 'Provider adapters for OpenAI, Google, Anthropic, DeepSeek, and xAI/Grok.']],
    sections: [
      { title: 'Connector operations are part of the product', body: 'Credentials are encrypted, synchronisation is observable, failures can retry, stale sources can alert, and deletion controls archive derived knowledge.', bullets: ['Encrypted credential storage', 'Scheduled background synchronisation', 'Retry and dead-letter handling', 'Freshness and provider health', 'Audited deletion'] },
      { title: 'Availability labels matter', body: 'Available means released for normal use. Beta requires configuration and controlled validation. Planned items are not represented as usable integrations.' }
    ],
    faq: [['Can I request another integration?', 'Yes. Contact support with the business system, required workflow, data ownership, expected volume, and security requirements.']]
  },
  '/security': {
    kind: 'Trust centre',
    title: 'Security controls designed for accountable customer communication',
    description: 'ChatClan combines tenant boundaries, role checks, protected credentials, verified events, audit evidence, and operational recovery controls.',
    availability: 'Implemented controls',
    proofTitle: 'Security by control, not certification claims',
    proofItems: [['Access', 'Signed sessions, password hashing, workspace roles, and platform-owner separation.'], ['Data', 'Tenant-scoped operations and encryption for supported connector and Meta credentials.'], ['Operations', 'Request identifiers, webhook verification, worker health, incidents, alerts, and dead-letter recovery.']],
    sections: [
      { title: 'Application safeguards', body: 'Implemented safeguards include tenant-aware data access, role-based routes, protected authentication flows, rate limiting, security headers, and encrypted integration secrets.', bullets: ['Tenant isolation', 'Role and entitlement checks', 'Password and session protection', 'Credential encryption and masking', 'Webhook signature verification'] },
      { title: 'Operational safeguards', body: 'Reliability controls cover worker heartbeat, stuck work, dead letters, provider correlation, incident timelines, acknowledgement, escalation, and audited recovery.' },
      { title: 'Deployment controls still matter', body: 'Production TLS, secret management, database backups, restoration tests, host hardening, and monitoring must be configured and evidenced in the deployment environment.' },
      { title: 'No certification claim', body: 'ChatClan does not currently claim ISO 27001, SOC 2, PCI DSS, or another independent security certification.' }
    ],
    faq: [['How do I report a security concern?', 'Use the security contact listed on the Contact page. Do not include passwords, tokens, or unnecessary customer content in the first report.']]
  },
  '/subprocessors': {
    kind: 'Trust centre',
    title: 'Service providers and optional processing integrations',
    description: 'A transparent view of external services ChatClan may use, with optional providers activated only when configured for the relevant workflow.',
    availability: 'Pre-production register',
    proofTitle: 'Provider categories in the current architecture',
    proofItems: [['Meta', 'WhatsApp Business Platform messaging and account services.'], ['Google', 'Optional social sign-in and Google Drive OAuth workflows.'], ['AI providers', 'Optional OpenAI, Google, Anthropic, DeepSeek, or xAI model processing.'], ['Payments and email', 'Configured billing and transactional-email providers for the deployment.']],
    sections: [
      { title: 'Production register requirement', body: 'The final production register must identify the enabled legal entity, purpose, data category, processing location where known, and effective date before live customer data is accepted.' },
      { title: 'Optional provider choice', body: 'AI and knowledge connectors process data only when the customer enables the relevant provider and workflow, subject to plan, credential, policy, and operational controls.' },
      { title: 'Changes', body: 'Material provider changes must be recorded, reviewed for privacy and cross-border implications, and communicated according to the customer agreement.' }
    ],
    faq: [['Is every listed provider active?', 'No. Some providers are optional or deployment-specific. The production register will distinguish enabled subprocessors from available integrations.']]
  }
};

module.exports = {
  publicMarketingPages: { ...productPages, ...solutionPages, ...directoryPages }
};
