const lastUpdated = '22 July 2026';

const officialReferences = {
  popia: { label: 'Protection of Personal Information Act 4 of 2013', href: 'https://www.gov.za/documents/protection-personal-information-act' },
  regulator: { label: 'Information Regulator South Africa', href: 'https://inforegulator.org.za/' },
  regulatorServices: { label: 'Information Regulator eServices', href: 'https://eservices.inforegulator.org.za/services.aspx' },
  cpa: { label: 'Consumer Protection Act 68 of 2008', href: 'https://www.gov.za/documents/consumer-protection-act' },
  whatsappPolicy: { label: 'WhatsApp Business Messaging Policy', href: 'https://whatsappbusiness.com/policy/' },
  whatsappTerms: { label: 'WhatsApp Business Terms of Service', href: 'https://www.whatsapp.com/legal/business-terms/' },
  whatsappGuidelines: { label: 'WhatsApp Messaging Guidelines', href: 'https://www.whatsapp.com/legal/messaging-guidelines/' },
  metaCommerce: { label: 'Meta Commerce Policies', href: 'https://www.facebook.com/policies_center/commerce' }
};

const publicInformationPages = {
  '/privacy': {
    title: 'Privacy Notice',
    label: 'Your information',
    lastUpdated,
    introduction: 'This notice explains what personal information ChatClan processes, why we process it, who receives it, and the choices available to customers, workspace users, website visitors, and people who communicate with a business through WhatsApp.',
    notice: 'ChatClan has two privacy roles. We are the responsible party for our website, accounts, billing, security, and direct customer relationships. For personal information a business places in its workspace, the business is generally the responsible party and ChatClan acts as its operator.',
    sections: [
      {
        id: 'scope',
        title: '1. Scope and who we are',
        paragraphs: [
          'This notice applies to the ChatClan website, dashboard, APIs, support channels, and related services operated by {{legalName}}. It does not replace the privacy notice of a business that uses ChatClan to communicate with its own customers.',
          'If you received a WhatsApp message from one of our customers, direct requests about that business’s message or customer record to the business first. ChatClan will assist the business where the information is processed through our platform.'
        ]
      },
      {
        id: 'information',
        title: '2. Information we process',
        paragraphs: ['The information involved depends on how you use ChatClan. It may include:'],
        bullets: [
          'Account information: name, work email address, password hash, role, workspace membership, authentication events, and account preferences.',
          'Business information: trading and legal names, industry, addresses, registration details, WhatsApp Business Account and phone-number identifiers, business profile, team members, and subscription plan.',
          'Customer and messaging information: names, telephone numbers, consent evidence, opt-out events, segments, message content, attachments, message templates, delivery/read status, conversation assignments, notes, service-level events, and customer satisfaction responses.',
          'Commerce information: product and catalogue records, orders, discounts, payment status and references, fulfilment details, returns, and customer-service history. ChatClan does not need to store full payment-card numbers; payment entry is handled by the configured payment provider.',
          'AI and knowledge information: approved knowledge sources, imported documents or connector records, selected conversation context, prompts, generated drafts, citations, provider attempts, safety results, agent edits, and quality telemetry.',
          'Connector information: encrypted credentials or OAuth tokens, provider account identifiers, synchronisation history, source freshness, failures, and audit records for services you choose to connect.',
          'Technical and operational information: IP address, browser and device information, request identifiers, session records, security events, API and webhook logs, worker/job health, feature usage, and diagnostic information.',
          'Billing and support information: invoices, transaction references, payment status, support correspondence, incident reports, and authorised support actions.'
        ]
      },
      {
        id: 'sources',
        title: '3. Where information comes from',
        bullets: [
          'Directly from you when you register, configure a workspace, import records, contact support, or use a feature.',
          'From the organisation that invited you to its workspace or uploaded customer records.',
          'From Meta and WhatsApp through authorised APIs and webhooks, including inbound messages and delivery events.',
          'From services you deliberately connect, such as Google Drive, Shopify, WooCommerce, payment providers, and configured AI providers.',
          'Automatically from the operation and security of the website, application, APIs, and background workers.'
        ]
      },
      {
        id: 'purposes',
        title: '4. Why we process information',
        paragraphs: ['We process information only where there is an appropriate purpose and justification under applicable law. Purposes include:'],
        bullets: [
          'Creating and administering accounts, workspaces, subscriptions, and authorised access.',
          'Delivering inbox, campaign, template, automation, commerce, analytics, connector, and AI-assistance functionality requested by the customer.',
          'Routing messages through Meta, recording consent and opt-outs, and maintaining delivery and audit evidence.',
          'Securing the service, detecting abuse, enforcing rate limits and acceptable-use rules, investigating incidents, and restoring service.',
          'Providing support, service notices, invoices, and communications needed for the customer relationship.',
          'Complying with legal obligations and responding to lawful requests.',
          'Improving reliability and usability using appropriately limited operational metrics. Customer WhatsApp content is not used by ChatClan to train a general-purpose AI model.'
        ]
      },
      {
        id: 'ai',
        title: '5. AI-assisted workflows',
        paragraphs: [
          'ChatClan owns the workflow, safety, retrieval, approval, and audit layer while customers may configure supported AI providers. Relevant conversation text and approved knowledge may be sent to the selected provider to produce a draft or task-specific result.',
          'The platform is designed for grounded, business-purpose assistance with human review and handoff controls. Customers must not use AI features to request passwords, authentication codes, full financial account details, identity documents, or other information that is unnecessary for the stated workflow. Provider processing is also subject to the selected provider’s terms and the customer’s configuration.'
        ]
      },
      {
        id: 'sharing',
        title: '6. Recipients and service providers',
        paragraphs: ['We disclose information only as needed for the service, on documented instructions, for security, or where law requires it. Recipient categories may include:'],
        bullets: [
          'Meta and WhatsApp for business messaging, templates, webhooks, profiles, and catalogues.',
          'Hosting, database, backup, email, monitoring, and security providers supporting the platform.',
          'Payment providers such as PayFast for checkout, payment confirmation, and subscription administration.',
          'AI providers selected and configured for a workspace, which may include OpenAI, Google, Anthropic, DeepSeek, xAI, or a compatible provider.',
          'Customer-authorised connectors such as Google Drive, Shopify, and WooCommerce.',
          'Professional advisers, auditors, insurers, regulators, courts, law-enforcement bodies, or a successor in a legitimate corporate transaction, subject to applicable safeguards.'
        ]
      },
      {
        id: 'transfers',
        title: '7. Cross-border processing',
        paragraphs: [
          'Some providers may process information outside South Africa. Before enabling or using such processing, ChatClan and the customer must consider POPIA section 72 and use an applicable safeguard, such as adequate legal protection, a binding agreement that provides an adequate level of protection, the data subject’s consent where appropriate, or another lawful basis permitted by POPIA.',
          'The location and terms of a customer-selected Meta, connector, payment, or AI provider may affect where information is processed.'
        ]
      },
      {
        id: 'retention',
        title: '8. Retention and deletion',
        paragraphs: [
          'We retain information only for as long as needed for the stated purpose, the customer contract, security and fraud prevention, dispute resolution, audit evidence, backup integrity, and applicable legal or tax obligations. Different records therefore have different retention periods.',
          'Workspace deletion and verified data-subject requests trigger deletion or de-identification in active systems where no lawful reason requires retention. Encrypted backup copies are protected from ordinary use and expire through the applicable backup lifecycle. Audit, billing, security, and legal records may be retained where necessary, with access restricted.'
        ]
      },
      {
        id: 'security',
        title: '9. Security safeguards',
        paragraphs: ['ChatClan uses safeguards appropriate to the service and the risks involved, including tenant isolation, role-based access, password hashing, signed sessions, encryption of connector and Meta credentials, request and audit identifiers, rate limiting, webhook verification, job controls, backup procedures, and operational monitoring. No internet service can guarantee absolute security. Customers remain responsible for their users, devices, credentials, connected services, and lawful workspace configuration.']
      },
      {
        id: 'rights',
        title: '10. Your privacy rights',
        paragraphs: ['Subject to POPIA and other applicable law, you may ask whether we hold your personal information and request access, correction, deletion, restriction or objection where applicable. You may also withdraw consent where processing depends on consent and opt out of direct marketing.'],
        bullets: [
          'Send the request to {{privacyEmail}} and identify the account, workspace, or business involved.',
          'We may verify identity and authority before disclosing or changing information.',
          'If a ChatClan customer controls the record, we may forward the request to that responsible party and assist it.',
          'Some requests may be limited by legal duties, another person’s rights, privilege, security, or records we must retain.'
        ]
      },
      {
        id: 'marketing-cookies',
        title: '11. Direct marketing and cookies',
        paragraphs: [
          'ChatClan service messages are used for account, security, billing, and operational purposes. Marketing communications must provide a practical opt-out. ChatClan customers are responsible for establishing a lawful basis for their own WhatsApp marketing, retaining consent evidence where required, and promptly respecting STOP, unsubscribe, block, and objection requests.',
          'The application uses essential session and security mechanisms needed to sign users in and protect requests. ChatClan does not currently require third-party advertising cookies for the core service. If non-essential analytics or advertising technologies are introduced, this notice and the relevant consent controls must be updated before activation.'
        ]
      },
      {
        id: 'children',
        title: '12. Children and special personal information',
        paragraphs: ['ChatClan is a business service and is not directed to children. Customers must not process children’s information or special personal information through ChatClan unless they have a lawful basis, the processing is appropriate for the service, and all required authorisations and safeguards are in place.']
      },
      {
        id: 'changes-contact',
        title: '13. Changes, questions, and complaints',
        paragraphs: [
          'We may update this notice when the service, providers, or legal requirements change. Material updates will be communicated through an appropriate account or website notice.',
          'Contact the Information Officer or privacy team at {{privacyEmail}}. You may also lodge a complaint with the Information Regulator using its official website or eServices portal.'
        ]
      }
    ],
    references: [officialReferences.popia, officialReferences.regulator, officialReferences.regulatorServices]
  },

  '/terms': {
    title: 'Terms of Service',
    label: 'Service agreement',
    lastUpdated,
    introduction: 'These terms govern access to and use of ChatClan by a business customer and its authorised users. They should be read with the Privacy Notice, POPIA Commitment, plan description, order or quotation, and applicable Meta policies.',
    notice: 'By creating an account, accepting an order, or using the service on behalf of an organisation, you confirm that you are authorised to bind that organisation. Consumer rights that cannot lawfully be excluded remain unaffected.',
    sections: [
      {
        id: 'provider-agreement',
        title: '1. Provider and agreement',
        paragraphs: [
          'The service is provided by {{legalName}}, registration number {{registrationNumber}}, registered in {{placeOfRegistration}}, with its registered or principal business address at {{physicalAddress}}.',
          'The agreement consists of these terms, the selected plan or signed order, incorporated policies, and any written data-processing or service-level terms agreed by the parties. If a signed order expressly conflicts with these terms, the signed order controls for that conflict.'
        ]
      },
      {
        id: 'eligibility',
        title: '2. Eligibility and accounts',
        bullets: [
          'You must use ChatClan for lawful business purposes and have authority to act for the customer organisation.',
          'Account, billing, business, and Meta information must be accurate and kept current.',
          'Each user must use an individual account. Credentials may not be shared, sold, or exposed to unauthorised people.',
          'The customer is responsible for assigning appropriate roles, removing former users, securing devices and connected accounts, and promptly reporting suspected unauthorised access.',
          'An owner or administrator who configures a workspace represents that they are authorised to instruct ChatClan to process the organisation’s data.'
        ]
      },
      {
        id: 'service',
        title: '3. The ChatClan service',
        paragraphs: [
          'ChatClan provides business tools for WhatsApp onboarding, team inboxes, templates, campaigns, consent records, automations, commerce, analytics, integrations, operational monitoring, and task-specific AI assistance. Features depend on the selected plan, configuration, third-party approvals, and rollout status.',
          'Meta controls WhatsApp Business Accounts, phone registration, display names, templates, messaging limits, quality ratings, policy enforcement, and access to its APIs. ChatClan cannot guarantee Meta approval, delivery to a recipient, or continued availability of a third-party feature.'
        ]
      },
      {
        id: 'customer-duties',
        title: '4. Customer responsibilities',
        bullets: [
          'Obtain and retain every notice, permission, consent, and other lawful basis needed to collect customer information and communicate through WhatsApp.',
          'Provide a clear business identity and customer-support route, use accurate content, and honour every opt-out, block, objection, or deletion request promptly.',
          'Use approved message templates when required and respect the applicable customer-service window, message category, rate limit, and country or age restriction.',
          'Ensure imported lists have documented provenance and permission. Purchased, scraped, guessed, or unlawfully shared contact lists are prohibited.',
          'Comply with POPIA, the Consumer Protection Act, sector rules, intellectual-property rights, sanctions, export controls, and all other laws applicable to the customer’s business and communications.',
          'Review campaign audiences, templates, automations, catalogue items, AI outputs, prices, and destination details before sending or publishing them.'
        ]
      },
      {
        id: 'acceptable-use',
        title: '5. Acceptable use',
        paragraphs: ['You may not use, enable, or assist anyone to use ChatClan to:'],
        bullets: [
          'Send spam, unsolicited communications, deceptive promotions, harassment, threats, hate, exploitation, or illegal content.',
          'Impersonate another person or business, misrepresent affiliation, commit fraud, or infringe privacy, publicity, copyright, trademark, or other rights.',
          'Offer, promote, or facilitate products, services, organisations, or conduct prohibited or restricted by WhatsApp or Meta policies.',
          'Collect unnecessary passwords, one-time codes, full payment-card or bank-account numbers, government identifiers, or other sensitive credentials in messages or AI prompts.',
          'Upload malware; probe, disrupt, overload, bypass, reverse engineer, scrape, or gain unauthorised access to the service or another tenant.',
          'Circumvent quotas, safeguards, human-approval controls, consent suppression, billing, security, or provider restrictions.',
          'Use ChatClan as an emergency service, or rely on it for autonomous medical, legal, credit, employment, insurance, or other high-impact decisions without qualified human review and all legally required safeguards.'
        ]
      },
      {
        id: 'ai',
        title: '6. AI-assisted features',
        paragraphs: [
          'AI features produce drafts, classifications, retrieval results, and workflow suggestions that may be incomplete, inaccurate, or unsuitable. Unless ChatClan expressly enables a reviewed automation under written customer instructions, an authorised person must review outputs before they are sent or used.',
          'The customer chooses the business purpose, approved knowledge, provider configuration, recipients, and final content. The customer must maintain a clear human handoff path and must not use an AI workflow as a general-purpose WhatsApp assistant outside the approved business purpose.',
          'ChatClan may block, redact, route for human review, or refuse an AI request where safety, privacy, consent, provider, or policy controls require it.'
        ]
      },
      {
        id: 'data',
        title: '7. Customer data and privacy',
        paragraphs: [
          'As between the parties, the customer retains its rights in customer content and data. The customer grants ChatClan and its authorised operators a limited right to host, copy, transmit, transform, display, and otherwise process that data only as needed to provide, secure, support, and lawfully administer the service.',
          'For workspace customer data, the customer generally acts as the responsible party and ChatClan as operator. The customer’s instructions include the configured use of Meta, payment, connector, infrastructure, and AI providers. Additional data-processing terms may apply to regulated or enterprise use.',
          'ChatClan may create aggregated operational statistics only where they do not identify the customer or a data subject. ChatClan does not acquire ownership of customer content and does not use WhatsApp customer content to train a general-purpose AI model.'
        ]
      },
      {
        id: 'fees',
        title: '8. Plans, fees, taxes, and provider charges',
        paragraphs: [
          'The customer must pay the subscription fees, usage charges, and applicable taxes shown in the plan, checkout, quotation, or invoice. Unless expressly stated otherwise, ChatClan subscription fees do not include charges imposed by Meta, payment providers, mobile networks, AI providers, or other connected services.',
          'Plans may include limits for contacts, numbers, seats, campaigns, messages, storage, AI usage, connectors, or support. ChatClan may prevent additional usage, request an upgrade, or charge agreed overage fees when a limit is reached. We will not silently substitute a paid plan without the customer’s instruction.'
        ]
      },
      {
        id: 'renewal',
        title: '9. Trials, renewal, cancellation, and refunds',
        bullets: [
          'Trial duration and limitations are shown at signup. A trial may expire or become read-only unless a plan is activated.',
          'Recurring subscriptions renew for the period shown at checkout until cancelled. The customer may cancel future renewal through the available account or support process.',
          'Cancellation stops future renewal but does not erase amounts already due. Access ordinarily continues to the end of the paid period unless the account is suspended for cause or the parties agree otherwise.',
          'Refunds are provided where required by law, where a written order provides for them, or where ChatClan confirms a billing error. Nothing in these terms restricts a non-excludable cooling-off, cancellation, refund, or other consumer right.',
          'If a fixed-term consumer agreement is governed by section 14 of the Consumer Protection Act, the statutory notice, expiry, renewal, and reasonable-cancellation rules apply to the extent applicable.'
        ]
      },
      {
        id: 'third-parties',
        title: '10. Third-party services',
        paragraphs: [
          'Meta, WhatsApp, PayFast, Google, Shopify, WooCommerce, AI providers, and other connected services are independent services governed by their own terms, policies, availability, and charges. The customer authorises the exchanges needed for each enabled integration.',
          'ChatClan is responsible for its own service and its operator obligations, but is not responsible for a third party’s independent decision, outage, policy change, account suspension, data practice, or act beyond ChatClan’s reasonable control. We will provide reasonable operational evidence and assistance where available.'
        ]
      },
      {
        id: 'ip',
        title: '11. Intellectual property and feedback',
        paragraphs: [
          'ChatClan and its licensors retain all rights in the platform, software, design, documentation, templates supplied by ChatClan, and related intellectual property. No ownership transfers to the customer. The customer receives a limited, non-exclusive, non-transferable right to use the service during the agreement for its internal business operations.',
          'The customer retains its rights in its brands, products, content, and data and confirms it has permission to use and provide them. Feedback may be used to improve ChatClan without an obligation to pay for it, provided we do not publicly identify the customer without permission.'
        ]
      },
      {
        id: 'security-confidentiality',
        title: '12. Security and confidentiality',
        paragraphs: [
          'Each party must protect the other party’s confidential information with reasonable care and use it only for the agreement. Disclosure is permitted to authorised personnel and providers bound by appropriate duties, or where law requires it.',
          'The customer must notify ChatClan promptly of suspected account compromise. ChatClan will maintain proportionate technical and organisational safeguards and follow its incident process. Security obligations do not make either party responsible for risks created by the other party’s systems, users, instructions, or unauthorised integrations.'
        ]
      },
      {
        id: 'availability',
        title: '13. Availability and service changes',
        paragraphs: [
          'We aim to operate a reliable service, but maintenance, security work, internet conditions, third-party failures, force majeure, and evolving provider APIs may interrupt or change features. Any binding uptime, support, recovery, or service-credit commitment must be stated in a separate written service-level agreement.',
          'We may modify features to improve the service, comply with law or provider policy, address security, or retire unsupported functionality. We will give reasonable notice of a material reduction where practicable.'
        ]
      },
      {
        id: 'suspension',
        title: '14. Suspension and termination',
        paragraphs: [
          'We may limit sending, disable a feature, or suspend access where reasonably necessary to address non-payment, a security threat, unlawful use, material breach, excessive risk, harm to another tenant, or Meta/provider enforcement. Where circumstances allow, we will explain the reason and provide an opportunity to remedy the issue.',
          'Either party may terminate as provided in the plan or order. On termination, the customer must stop using the service and settle amounts due. The customer should export needed data before access ends. ChatClan will delete or de-identify customer data under the Privacy Notice and applicable processing terms, subject to backups and records lawfully retained.'
        ]
      },
      {
        id: 'warranties-liability',
        title: '15. Warranties and liability',
        paragraphs: [
          'ChatClan will provide the service with reasonable care and skill. Except for express commitments and rights that cannot be excluded, the service is provided subject to its documented functionality and dependencies. We do not warrant that every message will be delivered, every template or account approved, every AI output accurate, or the service uninterrupted.',
          'To the maximum extent permitted by law, neither party is liable for indirect, special, punitive, or consequential loss, or for lost profit, revenue, goodwill, or data that could reasonably have been avoided through required backups or controls. ChatClan’s aggregate liability arising from the service is limited to fees paid to ChatClan for the affected service during the 12 months preceding the event.',
          'The limitations do not apply where prohibited by law or to fraud, wilful misconduct, gross negligence, infringement of the other party’s intellectual property, breach of confidentiality, or liability that cannot legally be limited. Consumer rights under applicable South African law remain unaffected.'
        ]
      },
      {
        id: 'indemnity',
        title: '16. Third-party claims',
        paragraphs: ['To the extent permitted by law, the customer must protect ChatClan against a third-party claim arising from the customer’s unlawful content, absence of consent, prohibited messaging or commerce, infringement, or material breach of these terms. ChatClan must promptly notify the customer and allow reasonable participation in the defence. This clause does not cover loss caused by ChatClan’s own breach, gross negligence, or wilful misconduct.']
      },
      {
        id: 'law-disputes',
        title: '17. Governing law and disputes',
        paragraphs: [
          'South African law governs the agreement. The parties must first try in good faith to resolve a dispute through authorised representatives after written notice. This does not prevent urgent court relief or a complaint to a regulator or consumer body.',
          'Subject to any mandatory consumer forum or jurisdiction, the courts of South Africa have jurisdiction. The parties may agree in writing to mediation or arbitration for a particular dispute.'
        ]
      },
      {
        id: 'general',
        title: '18. General terms',
        bullets: [
          'Neither party may assign the agreement without the other’s consent, except to an affiliate or as part of a genuine merger, reorganisation, or sale of substantially all relevant assets, subject to continued obligations.',
          'A delay in enforcing a right is not a waiver. If a clause is unenforceable, it will be limited or removed without invalidating the remainder.',
          'Electronic notices and acceptance are valid to the extent permitted by law. Notices to ChatClan must be sent to {{legalEmail}}; account notices may be sent to the customer’s registered owner email.',
          'We may update these terms for legal, security, provider, or product reasons. Material changes will receive reasonable notice. If the customer does not accept a material change, it may stop using and cancel the service before the change takes effect.'
        ]
      }
    ],
    references: [officialReferences.cpa, officialReferences.whatsappTerms, officialReferences.whatsappPolicy, officialReferences.whatsappGuidelines, officialReferences.metaCommerce]
  },

  '/popia': {
    title: 'POPIA Commitment',
    label: 'South African privacy',
    lastUpdated,
    introduction: 'This statement explains how ChatClan applies the Protection of Personal Information Act 4 of 2013 to its own processing and to the platform services it provides to South African business customers.',
    notice: 'This statement describes the platform’s compliance approach; it is not a substitute for each customer’s own privacy notice, consent process, impact assessment, Information Officer duties, PAIA obligations, or sector-specific legal advice.',
    sections: [
      {
        id: 'roles',
        title: '1. Responsible party and operator roles',
        bullets: [
          'ChatClan is the responsible party for personal information used to operate its website, customer accounts, contracts, billing, security, support, and platform administration.',
          'A business customer is generally the responsible party for contact lists, WhatsApp conversations, campaigns, orders, connected business data, knowledge sources, and instructions placed in its workspace.',
          'ChatClan generally acts as operator for that workspace information and processes it only to provide, secure, support, and administer the service under the customer’s instructions and applicable law.',
          'Meta, payment, connector, hosting, and AI providers may be operators, independent responsible parties, or both depending on their service and terms. Customers must review enabled providers for their use case.'
        ]
      },
      {
        id: 'conditions',
        title: '2. The eight POPIA conditions',
        paragraphs: ['ChatClan’s privacy programme is organised around POPIA’s conditions for lawful processing:'],
        bullets: [
          'Accountability: assign responsibility, document controls, maintain policies, and review risk and compliance evidence.',
          'Processing limitation: process adequate, relevant, non-excessive information with a lawful justification and appropriate collection method.',
          'Purpose specification: define the purpose before collection and retain records only as long as the purpose or law requires.',
          'Further processing limitation: assess compatibility before using information for a new purpose.',
          'Information quality: provide tools and processes to keep material information complete, accurate, current, and not misleading.',
          'Openness: maintain notices, processing records, provider transparency, and accessible contact routes.',
          'Security safeguards: apply appropriate technical and organisational controls and manage operator obligations and incidents.',
          'Data-subject participation: support access, correction, deletion, objection, and complaint processes.'
        ]
      },
      {
        id: 'customer-controls',
        title: '3. Platform controls supporting customers',
        bullets: [
          'Tenant isolation and role-based workspace access.',
          'Consent-event records, import validation, audience preparation, and opt-out suppression.',
          'STOP-keyword processing and exclusion of opted-out contacts from campaign preparation.',
          'Data-deletion workflows that redact relevant contact, inbox, and campaign information while retaining necessary audit evidence.',
          'Encrypted Meta and connector credentials, signed sessions, webhook verification, request identifiers, and security middleware.',
          'Human review, purpose limits, redaction, provider controls, citations, and audit telemetry for AI-assisted drafts.',
          'Platform-owner separation, reliability monitoring, incident records, and audited recovery actions.'
        ]
      },
      {
        id: 'customer-obligations',
        title: '4. Customer obligations as responsible party',
        bullets: [
          'Publish an accurate privacy notice and identify the business and Information Officer.',
          'Determine and document the lawful justification and purpose for each processing activity.',
          'Collect only necessary data and ensure contacts are not imported or messaged without the required permission.',
          'Keep consent evidence and promptly implement objections, opt-outs, corrections, and deletions.',
          'Configure roles, connected providers, retention, campaigns, automations, and AI workflows appropriately.',
          'Assess special personal information, children’s data, automated decisions, cross-border transfers, and sector requirements before processing.',
          'Notify ChatClan promptly of incidents and cooperate with investigation and legally required notifications.'
        ]
      },
      {
        id: 'direct-marketing',
        title: '5. Direct marketing and WhatsApp consent',
        paragraphs: [
          'POPIA section 69 regulates unsolicited electronic direct marketing. Customers must determine whether a recipient is an existing customer who may lawfully be approached under the statutory conditions or whether prior consent is required. A request for consent may itself be made only as permitted by POPIA.',
          'In addition, WhatsApp requires the person’s number and opt-in permission before business-initiated communication, requires approved templates outside the customer-service window, and requires businesses to respect opt-outs. ChatClan’s consent controls assist with, but do not decide, a customer’s legal compliance.'
        ]
      },
      {
        id: 'special-information',
        title: '6. Special personal information and children',
        paragraphs: ['Customers must not process special personal information or information about children unless a POPIA authorisation applies and appropriate notices, permissions, security, minimisation, and human oversight are in place. A general-purpose messaging or AI workflow should not be used for highly confidential health, financial, legal, employment, biometric, or identity information without a documented assessment and suitable contractual and technical controls.']
      },
      {
        id: 'automation',
        title: '7. Automated decision-making and AI',
        paragraphs: ['ChatClan’s AI layer is designed primarily for task-specific assistance, grounded drafts, and workflow support with human approval and escalation. Customers must not configure solely automated decisions that produce legal or substantial effects unless POPIA permits the decision and the required safeguards, explanation, and opportunity for human intervention are implemented.']
      },
      {
        id: 'operators-transfers',
        title: '8. Operators, subprocessors, and cross-border transfers',
        paragraphs: [
          'ChatClan limits providers to services needed for infrastructure, messaging, payments, email, support, connectors, monitoring, and configured AI functionality. Access should be purpose-limited and governed by appropriate security and processing terms.',
          'Where personal information leaves South Africa, the parties must satisfy POPIA section 72 through an applicable mechanism, such as adequate protection in the recipient country or organisation, a binding agreement, consent where suitable, performance of a contract in the data subject’s interest, or another mechanism allowed by law. Customer-selected provider location and terms remain relevant to that assessment.'
        ]
      },
      {
        id: 'requests',
        title: '9. Data-subject requests',
        paragraphs: ['A data subject may request confirmation and access, correction or deletion, and may object to certain processing or direct marketing, subject to POPIA and PAIA. Requests should be sent to the responsible party identified in the relevant privacy notice.'],
        bullets: [
          'For ChatClan account, website, billing, or support information, contact {{privacyEmail}}.',
          'For a message or record controlled by a ChatClan customer, contact that business; ChatClan will provide reasonable operator assistance.',
          'Identity, authority, scope, and the applicable record must be verified before action.',
          'The response may preserve information required by law, legal proceedings, security, billing, or the rights of another person.'
        ]
      },
      {
        id: 'security-compromise',
        title: '10. Security compromises',
        paragraphs: [
          'If ChatClan discovers reasonable grounds to believe workspace personal information has been accessed or acquired by an unauthorised person while ChatClan acts as operator, ChatClan will notify the responsible-party customer as soon as reasonably possible and provide available information needed for assessment and notification.',
          'The responsible party remains responsible for notifying the Information Regulator and affected data subjects as soon as reasonably possible in the manner required by POPIA. POPIA does not prescribe a general 72-hour threshold and the Information Regulator states that all security compromises must be reported; risk level does not remove the reporting duty.'
        ]
      },
      {
        id: 'officer-complaints',
        title: '11. Information Officer and complaints',
        paragraphs: [
          'ChatClan Information Officer: {{informationOfficerName}}. Contact: {{informationOfficerEmail}}. Postal or physical address: {{physicalAddress}}.',
          'Send privacy requests or concerns to {{privacyEmail}}. If the concern is not resolved, a person may submit a POPIA complaint through the Information Regulator or its eServices portal.'
        ]
      }
    ],
    references: [officialReferences.popia, officialReferences.regulator, officialReferences.regulatorServices, officialReferences.whatsappPolicy]
  },

  '/data-deletion': {
    title: 'Data Deletion Instructions',
    label: 'Privacy request',
    lastUpdated,
    introduction: 'Use this process to request deletion of personal information associated with ChatClan, including information received through Google or Facebook sign-in. We verify identity and authority before deleting or irreversibly de-identifying records.',
    sections: [
      {
        id: 'request',
        title: 'How to submit a request',
        paragraphs: [
          'Email {{privacyEmail}} from the email address associated with your ChatClan account. Use the subject “Data deletion request” and include your full name, account email, workspace name if applicable, and whether the request concerns your ChatClan account, Google sign-in, Facebook sign-in, or customer-message data.',
          'Do not include a password, access token, one-time code, identity document, full message export, or other unnecessary personal information in the initial email.'
        ]
      },
      {
        id: 'verification',
        title: 'Identity and authority checks',
        paragraphs: [
          'We may ask you to verify control of the account or email address and to clarify the records covered by the request. If you act for another person or a business, we may require evidence of authority. These checks help prevent an unauthorised person from deleting someone else’s information.'
        ]
      },
      {
        id: 'scope',
        title: 'What we delete',
        paragraphs: [
          'Once the request is verified and approved, ChatClan deletes or irreversibly de-identifies the applicable account profile, linked social identity, active sessions, provider tokens, workspace membership, and other personal information that is no longer required. Where a ChatClan customer controls the requested message or contact data, we will assist that customer as operator and may direct you to the responsible business.'
        ]
      },
      {
        id: 'retention',
        title: 'Information that may be retained',
        paragraphs: [
          'Limited records may be retained where required for security, fraud prevention, billing, tax, legal claims, regulatory duties, or proof that the request was completed. Backup copies are isolated from ordinary use and expire under the applicable retention schedule. Retained information remains access-controlled and is not used for marketing.'
        ]
      },
      {
        id: 'timing',
        title: 'Confirmation and timing',
        paragraphs: [
          'We acknowledge the request, explain any verification needed, and confirm completion or a lawful reason for retaining specific information. Timing depends on the request’s scope and applicable law. You may follow up at {{privacyEmail}} using the original email thread.'
        ]
      },
      {
        id: 'disconnect',
        title: 'Disconnecting social sign-in',
        paragraphs: [
          'Removing ChatClan from your Google Account or Facebook settings stops future access but does not by itself delete information already held by ChatClan. Submit the deletion request above when you also want ChatClan-held information removed.'
        ]
      }
    ],
    references: [officialReferences.popia, officialReferences.regulator, officialReferences.regulatorServices]
  },

  '/contact': {
    title: 'Contact ChatClan',
    label: 'Customer support',
    lastUpdated,
    introduction: 'Contact the appropriate ChatClan team for account, onboarding, billing, privacy, security, or legal matters. Never send a password, access token, one-time code, full payment-card number, or unnecessary customer-message export by email.',
    sections: [
      {
        id: 'company',
        title: 'Company information',
        facts: [
          ['Legal name', '{{legalName}}'],
          ['Registration number', '{{registrationNumber}}'],
          ['Place of registration', '{{placeOfRegistration}}'],
          ['Office bearers', '{{officeBearers}}'],
          ['Physical address', '{{physicalAddress}}'],
          ['Website', '{{website}}'],
          ['Telephone', '{{telephone}}']
        ]
      },
      {
        id: 'support',
        title: 'Product and account support',
        paragraphs: ['Email {{supportEmail}} with your workspace name, account email, the affected feature, approximate time of the issue, and a request ID if one is visible. Redact customer content unless it is essential to diagnose the issue.']
      },
      {
        id: 'billing',
        title: 'Billing and cancellation',
        paragraphs: ['Email {{billingEmail}} from an owner or billing contact. Include the workspace name and invoice or payment reference. Do not email payment-card or bank-account credentials.']
      },
      {
        id: 'privacy',
        title: 'Privacy and Information Officer',
        paragraphs: ['Information Officer: {{informationOfficerName}}. Email {{privacyEmail}} for access, correction, deletion, objection, consent, data-processing, or POPIA enquiries. We may verify identity and authority before acting.']
      },
      {
        id: 'security',
        title: 'Security incidents',
        paragraphs: ['Report suspected account compromise, exposed credentials, unauthorised access, or a possible personal-information compromise to {{securityEmail}} as soon as possible. State that the matter is security-sensitive, provide safe contact details, and avoid sending exposed secrets in the report.']
      },
      {
        id: 'legal',
        title: 'Legal notices',
        paragraphs: ['Send formal legal notices to {{legalEmail}} and the physical address above. A support ticket or social-media message is not a substitute for a formal notice where the Terms of Service or law requires one.']
      },
      {
        id: 'regulator',
        title: 'Information Regulator',
        paragraphs: ['Privacy complaints may also be submitted to the Information Regulator South Africa. Use the official website or eServices portal below for current forms, submission channels, and contact details.']
      }
    ],
    references: [officialReferences.regulator, officialReferences.regulatorServices]
  }
};

module.exports = { publicInformationPages };
