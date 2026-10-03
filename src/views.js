const { brand } = require('./config/app');
const { listPlans, publicPlan } = require('./services/planCatalog');

function money(value) {
  return `R ${Number(value).toLocaleString('en-ZA')}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-ZA');
}

function formatDate(value) {
  if (!value || value === 'Trial') return value || '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderPublicInformationPage({ path, title, label, lastUpdated, introduction, notice, sections = [], references = [] }) {
  const normalizedSections = sections.map((section, index) => ({ ...section, id: section.id || `section-${index + 1}` }));
  const values = {
    legalName: brand.legalName,
    registrationNumber: brand.registrationNumber,
    physicalAddress: brand.physicalAddress,
    telephone: brand.telephone,
    placeOfRegistration: brand.placeOfRegistration,
    officeBearers: brand.officeBearers,
    informationOfficerName: brand.informationOfficerName,
    website: brand.domain
  };
  const emails = {
    supportEmail: brand.supportEmail,
    billingEmail: brand.billingEmail,
    privacyEmail: brand.privacyEmail,
    securityEmail: brand.securityEmail,
    legalEmail: brand.legalEmail,
    informationOfficerEmail: brand.informationOfficerEmail
  };
  const renderInline = (content) => {
    let rendered = escapeHtml(content);
    for (const [token, value] of Object.entries(values)) rendered = rendered.replaceAll(`{{${token}}}`, escapeHtml(value));
    for (const [token, value] of Object.entries(emails)) {
      const safeEmail = escapeHtml(value);
      rendered = rendered.replaceAll(`{{${token}}}`, `<a href="mailto:${safeEmail}">${safeEmail}</a>`);
    }
    return rendered;
  };
  const policyLinks = [
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
    ['/popia', 'POPIA'],
    ['/contact', 'Contact']
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(brand.name)}</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="docs-body">
  <main class="legal-shell">
    <nav class="legal-nav">
      <a class="brand" href="/"><span class="brand-mark">${escapeHtml(brand.mark)}</span><span>${escapeHtml(brand.name)}</span></a>
      <div class="legal-nav-actions">${policyLinks.map(([href, text]) => `<a ${href === path ? 'aria-current="page"' : ''} href="${href}">${text}</a>`).join('')}<a class="button" href="/login">Sign in</a></div>
    </nav>
    <header class="legal-header"><p class="section-label">${escapeHtml(label)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(introduction)}</p>${lastUpdated ? `<small>Last updated ${escapeHtml(lastUpdated)}</small>` : ''}</header>
    ${notice ? `<aside class="legal-notice"><strong>Important</strong><p>${renderInline(notice)}</p></aside>` : ''}
    <div class="legal-layout">
      <aside class="legal-toc"><strong>On this page</strong><nav>${normalizedSections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title.replace(/^\d+\.\s*/, ''))}</a>`).join('')}</nav></aside>
      <article class="legal-content">
        ${normalizedSections.map((section) => `<section id="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${(section.paragraphs || []).map((paragraph) => `<p>${renderInline(paragraph)}</p>`).join('')}${section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>` : ''}${section.facts?.length ? `<dl class="legal-facts">${section.facts.map(([term, detail]) => `<div><dt>${escapeHtml(term)}</dt><dd>${renderInline(detail)}</dd></div>`).join('')}</dl>` : ''}</section>`).join('')}
        ${references.length ? `<section class="legal-references" id="official-sources"><h2>Official sources</h2><p>These links are provided so you can verify the governing legislation and third-party policies at their maintained sources.</p><ul>${references.map((reference) => `<li><a href="${escapeHtml(reference.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(reference.label)}</a></li>`).join('')}</ul></section>` : ''}
      </article>
    </div>
    <footer class="legal-footer">
      <span>Questions? <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></span>
      <a href="/">Back to ${escapeHtml(brand.name)}</a>
    </footer>
  </main>
</body>
</html>`;
}

function renderPublicSiteNav(activePath = '/') {
  const current = (href) => activePath === href ? 'aria-current="page"' : '';
  const productLinks = [
    ['/product/team-inbox', 'Team Inbox'],
    ['/product/campaigns', 'Campaigns'],
    ['/product/automation', 'Automation'],
    ['/product/ai-assist', 'AI Assist'],
    ['/product/commerce', 'Commerce'],
    ['/product/analytics', 'Analytics']
  ];
  const solutionLinks = [
    ['/solutions/retail', 'Retail & e-commerce'],
    ['/solutions/services', 'Services & appointments'],
    ['/solutions/customer-support', 'Customer support'],
    ['/solutions/agencies', 'Agencies']
  ];
  const renderMenuLinks = (links) => links.map(([href, label]) => `<a ${current(href)} href="${href}">${label}</a>`).join('');
  return `<header class="site-header">
    <nav class="main-nav" aria-label="Primary navigation">
      <a class="brand mini-brand" href="/"><span class="brand-mark">${escapeHtml(brand.mark)}</span><span>${escapeHtml(brand.name)}</span></a>
      <div class="main-nav-links">
        <details class="nav-dropdown"><summary>Product</summary><div class="nav-dropdown-panel"><strong>Operate customer conversations</strong>${renderMenuLinks(productLinks)}</div></details>
        <details class="nav-dropdown"><summary>Solutions</summary><div class="nav-dropdown-panel"><strong>Built around business outcomes</strong>${renderMenuLinks(solutionLinks)}</div></details>
        <a ${current('/integrations')} href="/integrations">Integrations</a>
        <details class="nav-dropdown"><summary>Resources</summary><div class="nav-dropdown-panel"><strong>Learn and verify</strong><a href="/docs">Help centre</a><a href="/security">Security</a><a href="/subprocessors">Service providers</a><a href="/status">Service status</a><a href="/demo">Book a demo</a><a href="/contact">Contact</a></div></details>
        <a ${current('/pricing')} href="/pricing">Pricing</a>
      </div>
      <div class="main-nav-actions">
        <a class="nav-signin" href="/login">Sign in</a>
        <a class="nav-trial" href="/signup" data-analytics-event="nav_start_trial">Start free trial <span aria-hidden="true">&#8599;</span></a>
        <button class="nav-menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="landingMobileNav" data-landing-nav-toggle>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
    <nav class="mobile-site-nav" id="landingMobileNav" aria-label="Mobile navigation" hidden>
      <div><strong>Product</strong>${renderMenuLinks(productLinks)}</div>
      <div><strong>Solutions</strong>${renderMenuLinks(solutionLinks)}</div>
      <div><strong>Explore</strong><a href="/integrations">Integrations</a><a href="/pricing">Pricing</a><a href="/docs">Help centre</a><a href="/security">Security</a><a href="/status">Service status</a><a href="/demo">Book a demo</a><a href="/contact">Contact</a><a href="/login">Sign in</a></div>
    </nav>
  </header>`;
}

function renderPublicSiteFooter() {
  return `<footer class="footer public-footer">
    <div class="footer-brand"><a class="brand" href="/"><span class="brand-mark">${escapeHtml(brand.mark)}</span><span>${escapeHtml(brand.name)}</span></a><p>WhatsApp customer operations for South African businesses, with governed AI and local-first controls.</p></div>
    <div class="footer-links"><section><strong>Product</strong><a href="/product/team-inbox">Team Inbox</a><a href="/product/campaigns">Campaigns</a><a href="/product/automation">Automation</a><a href="/product/ai-assist">AI Assist</a></section><section><strong>Solutions</strong><a href="/solutions/retail">Retail</a><a href="/solutions/services">Services</a><a href="/solutions/customer-support">Customer support</a><a href="/solutions/agencies">Agencies</a></section><section><strong>Resources</strong><a href="/integrations">Integrations</a><a href="/pricing">Pricing</a><a href="/demo">Book a demo</a><a href="/docs">Help centre</a><a href="/contact">Contact</a></section><section><strong>Trust</strong><a href="/security">Security</a><a href="/subprocessors">Service providers</a><a href="/status">Status</a><a href="/popia">POPIA</a></section></div>
    <div class="footer-legal"><p>&copy; 2026 ${escapeHtml(brand.legalName)}. Cape Town, South Africa.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a><a href="https://whatsappbusiness.com/policy/" target="_blank" rel="noopener noreferrer">WhatsApp Policy</a></div></div>
  </footer>`;
}

function renderMarketingPage(page, { authenticated = false, nonce = '' } = {}) {
  const sections = page.sections || [];
  const faq = page.faq || [];
  const proofItems = page.proofItems || [];
  const isPricing = page.path === '/pricing';
  const availabilitySlug = String(page.availability || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const availabilityClass = /^\d/.test(availabilitySlug) ? `status-${availabilitySlug}` : availabilitySlug;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(page.description)}">
  ${renderPublicSeoHead({ title: page.title, description: page.description, path: page.path, nonce })}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="marketing-body">
  ${renderPublicSiteNav(page.path)}
  <main class="marketing-main">
    <section class="public-page-hero">
      <div class="public-page-copy"><div class="section-label">${escapeHtml(page.kind)}</div><span class="availability-label ${escapeHtml(availabilityClass)}">${escapeHtml(page.availability)}</span><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p><div class="hero-actions"><a class="btn-hero" href="/signup" data-analytics-event="product_start_trial">Start free - no credit card</a><a class="btn-hero-outline" href="/demo" data-analytics-event="product_book_demo">Book a demo</a></div></div>
      <aside class="public-proof" aria-label="${escapeHtml(page.proofTitle)}"><header><small>Illustrative workflow</small><h2>${escapeHtml(page.proofTitle)}</h2></header><div>${proofItems.map(([title, detail], index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></article>`).join('')}</div></aside>
    </section>
    ${isPricing ? renderPublicPricing(page, authenticated) : ''}
    <section class="public-content-sections">${sections.map((section, index) => `<article><div><span>${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(section.title)}</h2></div><div><p>${escapeHtml(section.body)}</p>${section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</div></article>`).join('')}</section>
    ${faq.length ? `<section class="public-faq"><div class="section-label">Questions answered</div><h2>Know what to expect before you connect.</h2><div>${faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</div></section>` : ''}
    <section class="public-page-cta"><div><span class="section-label">Start with a controlled workspace</span><h2>Bring your first customer workflow into ChatClan.</h2><p>Use the guided setup, validate your Meta connection, and test with an approved internal recipient before live messaging.</p></div><a class="btn-hero" href="/signup">Start your free trial</a></section>
  </main>
  ${renderPublicSiteFooter()}
  ${renderPublicConsentBanner()}
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderPublicLeadPage({ leadType = 'sales', recaptcha = {}, nonce = '' } = {}) {
  const isDemo = leadType === 'demo';
  const path = isDemo ? '/demo' : '/contact';
  const title = isDemo ? 'Book a guided ChatClan demo' : 'Talk to the ChatClan team';
  const description = isDemo
    ? 'See how ChatClan can support your WhatsApp inbox, campaigns, automation, commerce, and governed AI workflows.'
    : 'Contact ChatClan about WhatsApp onboarding, sales, partnerships, and product fit for your South African business.';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${renderPublicSeoHead({ title, description, path, nonce })}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="marketing-body">
  ${renderPublicSiteNav(path)}
  <main class="conversion-main">
    <section class="conversion-intro">
      <div><span class="section-label">${isDemo ? 'Guided product demo' : 'Contact sales'}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
      <div class="conversion-expectations">
        <article><span>01</span><div><strong>Tell us what you need</strong><p>Share the workflow, team size, and messaging volume that matter to your business.</p></div></article>
        <article><span>02</span><div><strong>Reach the right person</strong><p>Your enquiry is routed by use case and scale, without placing you into a tenant workspace.</p></div></article>
        <article><span>03</span><div><strong>Get a practical response</strong><p>We respond using your preferred channel and keep promotional consent separate.</p></div></article>
      </div>
    </section>
    <section class="conversion-workspace">
      <form class="conversion-form" id="publicLeadForm" data-recaptcha-action="public_lead">
        <input name="leadType" type="hidden" value="${isDemo ? 'demo' : 'sales'}">
        <input name="sourcePath" type="hidden" value="${path}">
        <div class="form-honeypot" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></div>
        <header><div><span class="section-label">Your details</span><h2>${isDemo ? 'Shape the demo around your workflow' : 'Start a useful conversation'}</h2></div><span class="status">Required fields marked *</span></header>
        <div class="conversion-form-grid">
          <label>Full name *<input name="name" autocomplete="name" maxlength="180" required></label>
          <label>Work email *<input name="workEmail" type="email" autocomplete="email" maxlength="180" required></label>
          <label>Company *<input name="company" autocomplete="organization" maxlength="180" required></label>
          <label>Role<input name="roleTitle" autocomplete="organization-title" maxlength="120"></label>
          <label>Phone or WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="+27"></label>
          <label>Preferred response<select name="preferredContact"><option value="email">Email</option><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option></select></label>
          <label>Team size<select name="teamSize"><option value="">Select team size</option><option value="1-2">1-2 people</option><option value="3-5">3-5 people</option><option value="6-20">6-20 people</option><option value="21-50">21-50 people</option><option value="51+">51+ people</option></select></label>
          <label>Monthly conversations<select name="monthlyConversations"><option value="">Select volume</option><option value="under-500">Under 500</option><option value="500-2000">500-2,000</option><option value="2001-10000">2,001-10,000</option><option value="10000+">More than 10,000</option></select></label>
          <label class="field-span-two">Primary use case<select name="useCase"><option value="">Choose a use case</option><option value="sales">Sales conversations</option><option value="support">Customer support</option><option value="campaigns">Campaigns</option><option value="commerce">Conversational commerce</option><option value="automation">Workflow automation</option><option value="agency">Agency or client management</option><option value="other">Another workflow</option></select></label>
          <label class="field-span-two">What would you like to achieve? *<textarea name="message" rows="5" maxlength="2000" required placeholder="Describe the customer journey, current tools, and the result you need."></textarea></label>
        </div>
        <div class="conversion-consent">
          <label class="toggle-row"><input name="consentToContact" type="checkbox" required><span>I allow ChatClan to use these details to respond to this enquiry. *</span></label>
          <label class="toggle-row"><input name="marketingOptIn" type="checkbox"><span>I would also like occasional product and WhatsApp operations updates.</span></label>
          <p>Submitting this form does not create a WhatsApp marketing opt-in. Read our <a href="/privacy">Privacy Notice</a>.</p>
        </div>
        <div class="conversion-submit"><button class="btn-hero" type="submit">${isDemo ? 'Request my demo' : 'Send enquiry'}</button><small id="publicLeadStatus" role="status" aria-live="polite">Security verification runs when you submit.</small></div>
      </form>
      <aside class="conversion-channels">
        <span class="section-label">Other routes</span><h2>Send sensitive matters to the correct team.</h2>
        <div><article><strong>Account support</strong><p>Include your workspace and request ID, but never send passwords or tokens.</p><a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></article><article><strong>Privacy and POPIA</strong><p>Use the privacy route for access, correction, deletion, objection, or operator questions.</p><a href="mailto:${escapeHtml(brand.privacyEmail)}">${escapeHtml(brand.privacyEmail)}</a></article><article><strong>Security</strong><p>Report suspected compromise without including exposed secrets in the first message.</p><a href="mailto:${escapeHtml(brand.securityEmail)}">${escapeHtml(brand.securityEmail)}</a></article></div>
      </aside>
    </section>
  </main>
  ${renderPublicSiteFooter()}
  ${renderPublicConsentBanner()}
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderPublicSeoHead({ title, description, path = '/', noindex = false, nonce = '' }) {
  const base = String(brand.domain || 'https://chatclan.co.za').replace(/\/$/, '');
  const canonical = `${base}${path === '/' ? '' : path}`;
  const fullTitle = `${title} - ${brand.name}`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': path === '/' ? 'SoftwareApplication' : 'WebPage',
    name: title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: brand.name, url: base },
    ...(path === '/' ? { applicationCategory: 'BusinessApplication', operatingSystem: 'Web', offers: { '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: '299', highPrice: '1999' } } : {})
  }).replace(/</g, '\\u003c');
  return `<title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(brand.name)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json"${nonce ? ` nonce="${escapeHtml(nonce)}"` : ''}>${structuredData}</script>`;
}

function renderPublicConsentBanner() {
  return `<aside class="consent-banner" id="publicConsentBanner" aria-labelledby="consentBannerTitle" hidden><div><strong id="consentBannerTitle">Your privacy choices</strong><p>ChatClan uses essential browser storage for security and preferences. Optional analytics stays off unless you allow it.</p></div><div><button class="button ghost" type="button" data-consent-choice="essential">Essential only</button><button class="button primary" type="button" data-consent-choice="analytics">Allow analytics</button><a href="/privacy">Privacy</a></div></aside>`;
}

function renderPublicPricing(page, authenticated) {
  return `<section class="public-pricing-section"><header><div class="section-label">Platform subscription</div><h2>Choose the workspace that fits your team.</h2><p>These prices cover ChatClan software. Meta message charges are separate and depend on message category and recipient market.</p></header><div class="pricing-grid">${renderPriceCard('starter', 'Starter', 299, 'For solo operators and small teams', ['1 WhatsApp number', '2,000 contacts', '5 campaigns/month', '2 team seats', '25 templates', '3 chatbot flows'], ['API access', 'Advanced automations', 'Priority support'], false, authenticated)}${renderPriceCard('growth', 'Growth', 799, 'For growing service and sales teams', ['3 WhatsApp numbers', '10,000 contacts', 'Unlimited campaigns', '5 team seats', '100 templates', '15 chatbot flows', 'Advanced automations', 'Priority support'], ['API access'], true, authenticated)}${renderPriceCard('pro', 'Pro', 1999, 'For agencies and multi-location operations', ['Unlimited WhatsApp numbers', 'Unlimited contacts', 'Unlimited campaigns', 'Unlimited team seats', 'Unlimited templates and flows', 'Advanced automations', 'API access', 'Priority support'], [], false, authenticated)}</div><div class="pricing-explainer"><article><strong>1. ChatClan subscription</strong><p>A predictable monthly ZAR fee for workspace features, limits, users, support, and platform operations.</p></article><article><strong>2. Meta usage</strong><p>Applicable WhatsApp charges vary by message category, destination market, and Meta's maintained rate model.</p></article><article><strong>3. Optional services</strong><p>External AI, commerce, connector, or payment-provider charges apply only when the relevant service is enabled.</p></article></div></section>`;
}

function renderPage(data, { authenticated = false, nonce = '' } = {}) {
  const { business, metrics, campaigns, contacts, inbox, templates, products = [], orders = [], plans, providers } = data;
  const activeInbox = inbox[0] || {};
  const appCta = authenticated ? 'data-open-app' : 'href="/signup"';
  const landingClass = authenticated ? 'landing hidden' : 'landing';
  const appShell = authenticated ? renderAppShell({ business, metrics, campaigns, contacts, inbox, templates, products, orders, providers, activeInbox }) : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${renderPublicSeoHead({ title: 'WhatsApp customer operations for South African businesses', description: 'Manage WhatsApp campaigns, team conversations, consent, commerce, automation, and human-reviewed AI workflows in one ChatClan workspace.', path: '/', nonce })}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <section class="${landingClass}" id="landing">
    ${renderPublicSiteNav('/')}
    <header class="hero">
      <div class="hero-eyebrow">Built on the WhatsApp Business Platform</div>
      <h1 class="hero-h1">
        Manage customer conversations<br>
        and sales on <span class="green">WhatsApp</span>
      </h1>
      <p class="hero-sub">Bring campaigns, team conversations, customer consent, commerce, and human-reviewed AI workflows into one workspace built for South African businesses.</p>
      <div class="hero-actions">
        <a class="btn-hero" ${appCta}>Start free — no credit card</a>
        <a class="btn-hero-outline" ${authenticated ? 'data-open-app' : 'href="/login"'}>${authenticated ? 'Open dashboard →' : 'Sign in to view dashboard →'}</a>
      </div>
      <div class="hero-trust">
        <span>POPIA-conscious consent controls</span>
        <span>South African billing and support</span>
        <span>Human approval for AI drafts</span>
      </div>

      <div class="hero-mockup">
        <div class="mockup-bar"><i></i><i></i><i></i><span>Illustrative ${brand.name} workspace</span></div>
        <div class="mockup-content">
          <aside class="mock-sidebar">
            <div class="mock-nav-item active">Dashboard</div>
            <div class="mock-nav-item">Campaigns</div>
            <div class="mock-nav-item">Contacts</div>
            <div class="mock-nav-item">Inbox</div>
            <div class="mock-nav-item muted">Templates</div>
            <div class="mock-nav-item muted">Analytics</div>
          </aside>
          <section class="mock-main">
            <div class="mock-stats">
              <article><strong>12,450</strong><span>Messages sent</span></article>
              <article><strong>84%</strong><span>Read rate</span></article>
              <article><strong>R 48k</strong><span>Revenue driven</span></article>
              <article><strong>2,341</strong><span>Contacts</span></article>
            </div>
            <div class="mock-chart">${[42, 56, 48, 74, 58, 82, 63].map((height) => `<span style="height:${height}%"></span>`).join('')}</div>
          </section>
        </div>
      </div>

    </header>

    <section class="journey-band" aria-labelledby="journeyTitle">
      <div class="journey-inner">
        <header class="journey-intro">
          <div class="section-label">Connected customer journey</div>
          <h2 id="journeyTitle">Move every conversation forward.</h2>
          <p>One shared workspace from first message to resolved request and repeat sale.</p>
        </header>
        <ol class="journey-steps">
          <li class="journey-step inbox"><span class="journey-index">01</span><strong>Team inbox</strong><span>Assign, collaborate, and resolve customer conversations.</span></li>
          <li class="journey-step campaigns"><span class="journey-index">02</span><strong>Campaigns</strong><span>Reach consented audiences with measurable broadcasts.</span></li>
          <li class="journey-step commerce"><span class="journey-index">03</span><strong>Commerce</strong><span>Turn product questions into trackable orders and sales.</span></li>
          <li class="journey-step ai-assist"><span class="journey-index">04</span><strong>AI assist</strong><span>Prepare grounded replies while people retain control.</span></li>
        </ol>
      </div>
    </section>

    <section class="features" id="features">
      <div class="section-label">Everything you need</div>
      <h2 class="section-h2">One platform.<br>Endless conversations.</h2>
      <div class="features-grid">
        <a class="feature-card" href="/product/campaigns"><div class="feat-icon" aria-hidden="true">01</div><h3>Broadcast Campaigns</h3><p>Build segmented campaigns, prepare opted-in recipients, and monitor delivery and read outcomes from one workspace.</p><span>Explore campaigns &#8599;</span></a>
        <a class="feature-card" href="/product/automation"><div class="feat-icon" aria-hidden="true">02</div><h3>Chatbot Flows</h3><p>Build structured reply flows for FAQs, order tracking, appointments, and support, with clear handoff to a person.</p><span>Explore automation &#8599;</span></a>
        <a class="feature-card" href="/product/team-inbox"><div class="feat-icon" aria-hidden="true">03</div><h3>Unified Inbox</h3><p>Review customer replies, ownership, notes, service levels, and AI-assisted drafts without leaving the conversation.</p><span>Explore the inbox &#8599;</span></a>
        <a class="feature-card" href="/product/commerce"><div class="feat-icon" aria-hidden="true">04</div><h3>Conversational Commerce</h3><p>Keep products, customer questions, order preparation, and follow-up workflows connected to the conversation.</p><span>Explore commerce &#8599;</span></a>
        <a class="feature-card" href="/product/ai-assist"><div class="feat-icon" aria-hidden="true">05</div><h3>Governed AI Assist</h3><p>Ground drafts in approved knowledge, choose providers, evaluate quality, and keep human approval visible.</p><span>Explore AI controls &#8599;</span></a>
        <a class="feature-card" href="/product/analytics"><div class="feat-icon" aria-hidden="true">06</div><h3>Operational Analytics</h3><p>Track campaign delivery, messaging costs, response performance, commerce activity, and platform health.</p><span>Explore analytics &#8599;</span></a>
      </div>
    </section>

    <section class="landing-trust">
      <header><div class="section-label">Built for local operating reality</div><h2>Clear controls before clever claims.</h2><p>ChatClan combines the practical tools businesses need with honest boundaries around cost, consent, AI, and feature availability.</p></header>
      <div><article><span>ZAR</span><h3>Local subscription clarity</h3><p>Workspace plans are priced in rand, with Meta usage explained as a separate cost layer.</p><a href="/pricing">Understand pricing &#8599;</a></article><article><span>POPIA</span><h3>Consent evidence by design</h3><p>Opt-in records, suppression controls, audit context, and deletion workflows support accountable communication.</p><a href="/popia">Review our commitment &#8599;</a></article><article><span>AI</span><h3>Provider choice with guardrails</h3><p>Knowledge grounding, human review, quality evaluation, and provider fallback stay in ChatClan's workflow layer.</p><a href="/product/ai-assist">Review AI controls &#8599;</a></article></div>
    </section>

    <section class="landing-integrations">
      <div><div class="section-label">Connected context</div><h2>Bring the right business information into the conversation.</h2><p>Every connector is labelled by availability, monitored for freshness, and governed by credential and deletion controls.</p><a class="button" href="/integrations">View all integrations</a></div>
      <div class="integration-preview"><article><strong>WhatsApp Cloud API</strong><span class="availability-label available">Available</span></article><article><strong>Shopify</strong><span class="availability-label beta">Beta</span></article><article><strong>WooCommerce</strong><span class="availability-label beta">Beta</span></article><article><strong>Google Drive</strong><span class="availability-label beta">Beta</span></article><article><strong>OpenAI, Google, Anthropic</strong><span class="availability-label beta">Beta</span></article><article><strong>DeepSeek and xAI/Grok</strong><span class="availability-label beta">Beta</span></article></div>
    </section>

    <section class="pricing" id="pricing">
      <div class="section-center">
        <div class="section-label">Simple pricing</div>
        <h2 class="section-h2">No surprises. No hidden fees.</h2>
        <p>Your ChatClan subscription is separate from Meta messaging charges, which vary by message category and recipient market.</p>
      </div>
      <div class="pricing-grid">
        ${renderPriceCard('starter', 'Starter', 299, 'Perfect for side hustles & solo traders', ['1 WhatsApp number', '2,000 contacts', '5 campaigns/month', '2 team seats', '25 templates', '3 chatbot flows'], ['API access', 'Advanced automations', 'Priority support'], false, authenticated)}
        ${renderPriceCard('growth', 'Growth', 799, 'For growing shops & service businesses', ['3 WhatsApp numbers', '10,000 contacts', 'Unlimited campaigns', '5 team seats', '100 templates', '15 chatbot flows', 'Advanced automations', 'Priority support'], ['API access'], true, authenticated)}
        ${renderPriceCard('pro', 'Pro', 1999, 'For agencies & multi-location businesses', ['Unlimited WhatsApp numbers', 'Unlimited contacts', 'Unlimited campaigns', 'Unlimited team seats', 'Unlimited templates and flows', 'Advanced automations', 'API access', 'Priority support'], [], false, authenticated)}
      </div>
    </section>

    <section class="public-onboarding">
      <header><div class="section-label">Guided Meta onboarding</div><h2>From workspace to controlled test in four clear stages.</h2><p>ChatClan keeps business verification, consent, templates, and live-message readiness in the right order.</p></header>
      <ol><li><span>01</span><div><strong>Create the workspace</strong><p>Choose a plan and confirm the owner and business profile.</p></div></li><li><span>02</span><div><strong>Prepare Meta details</strong><p>Gather company, website, address, and display-name evidence.</p></div></li><li><span>03</span><div><strong>Connect and validate</strong><p>Complete Embedded Signup, verify webhooks, and review account readiness.</p></div></li><li><span>04</span><div><strong>Run an internal test</strong><p>Confirm consent, template approval, delivery events, and costs before live use.</p></div></li></ol>
      <a class="button" href="/docs">Open the setup guide</a>
    </section>

    <section class="public-faq landing-faq"><div class="section-label">Before you start</div><h2>Questions businesses should ask before connecting WhatsApp.</h2><div><details><summary>Is ChatClan the same as the WhatsApp Business app?</summary><p>No. ChatClan provides a multi-user workspace built around the WhatsApp Business Platform for campaigns, team operations, automation, commerce, and analytics.</p></details><details><summary>Are Meta messaging charges included in the plan?</summary><p>No. The ChatClan subscription covers platform access. Applicable Meta usage charges are separate and depend on message category and recipient market.</p></details><details><summary>Can ChatClan guarantee POPIA compliance?</summary><p>No software can make a business compliant by itself. ChatClan provides consent, suppression, access, audit, deletion, and security controls that support accountable use.</p></details><details><summary>Does AI reply without a person checking it?</summary><p>The current inbox-assist workflow prepares grounded drafts for human review. Broader automation remains subject to workspace policy, evaluation, escalation, and rollout controls.</p></details></div></section>

    <section class="cta-banner">
      <h2>Ready to start selling<br>on WhatsApp?</h2>
      <p>Create a workspace and complete the guided Meta connection checklist.</p>
      <a class="btn-hero" ${appCta}>Start your free trial — 14 days, no card needed</a>
    </section>

    ${renderPublicSiteFooter()}
    ${renderPublicConsentBanner()}
  </section>

  ${appShell}
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderAppShell({ business, metrics, campaigns, contacts, inbox, templates, products, orders, providers, activeInbox }) {
  const unreadInbox = inbox.reduce((total, item) => total + Number(item.unreadCount || item.unread || 0), 0);
  const contactUsage = Math.min(100, Math.round((business.contactsUsed / business.contactsLimit) * 100));
  const pendingCampaigns = campaigns.filter((campaign) => String(campaign.status || '').toLowerCase() !== 'sent').length;
  const safeBusinessName = escapeHtml(business.name);
  const safeBusinessPlan = escapeHtml(business.plan);
  return `<main class="app" id="app">
    <aside class="sidebar">
      <a class="brand app-brand" href="/dashboard"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
      <button class="business-switcher" type="button" title="Current workspace">
        <span>
          <strong>${safeBusinessName}</strong>
          <small>${safeBusinessPlan} plan</small>
        </span>
        <b>⌄</b>
      </button>
      <div class="business-card">
        <strong>Workspace health</strong>
        <small>${formatNumber(business.contactsUsed)}/${formatNumber(business.contactsLimit)} contacts used · renews ${escapeHtml(formatDate(business.billingRenewal))}</small>
        <span><i style="width:${contactUsage}%"></i></span>
      </div>
      <div class="nav-group">
        <small>Manage</small>
        <button class="nav-item active" data-page="dashboard" data-title="Home">⌂ <span>Home</span></button>
        <button class="nav-item" data-page="inbox" data-title="Inbox">☏ <span>Inbox</span>${unreadInbox ? `<em>${unreadInbox}</em>` : ''}</button>
        <button class="nav-item" data-page="campaigns" data-title="Campaigns">▣ <span>Campaigns</span></button>
        <button class="nav-item" data-page="contacts" data-title="Contacts">◎ <span>Contacts</span></button>
        <button class="nav-item" data-page="crm" data-title="Subscriber CRM">♧ <span>Subscriber CRM</span></button>
        <button class="nav-item" data-page="commerce" data-title="Commerce">◧ <span>Commerce</span></button>
      </div>
      <div class="nav-group">
        <small>Build</small>
        <button class="nav-item" data-page="templates" data-title="Templates">□ <span>Templates</span></button>
        <button class="nav-item" data-page="flows" data-title="Automations">◇ <span>Automations</span></button>
        <button class="nav-item" data-page="intelligence" data-title="Knowledge & AI">◈ <span>Knowledge & AI</span></button>
        <button class="nav-item" data-page="analytics" data-title="Insights">◌ <span>Insights</span></button>
      </div>
      <div class="nav-group">
        <small>Business</small>
        <button class="nav-item" data-page="integrations" data-title="Integrations">⇄ <span>Integrations</span></button>
        <button class="nav-item" data-page="billing" data-title="Billing">R <span>Billing</span></button>
        <button class="nav-item" data-page="settings" data-title="Settings & API">⚙ <span>Settings & API</span></button>
      </div>
      <a class="nav-item muted" href="/">← <span>Public site</span></a>
    </aside>
    <button class="sidebar-scrim" type="button" data-mobile-nav-close aria-label="Close navigation"></button>
    <section class="workspace">
      <header class="topbar">
        <div class="topbar-heading">
          <button class="mobile-nav-toggle" type="button" data-mobile-nav-toggle aria-label="Open navigation" title="Open navigation">☰</button>
          <div><p class="workspace-kicker">Business Suite</p><h2 id="pageTitle">Home</h2></div>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" data-page-link="campaigns" type="button">Create campaign</button>
          <button class="notification-button" id="notificationsButton" type="button" aria-expanded="false" aria-controls="notificationCenter" title="View notifications"><span aria-hidden="true">♢</span><em id="notificationCount" ${unreadInbox ? '' : 'hidden'}>${unreadInbox}</em><span class="sr-only">View notifications</span></button>
          <button class="account-menu" id="logoutBtn" type="button" title="Sign out"><span class="avatar">AM</span><span>Sign out</span></button>
        </div>
      </header>
      <section class="page active" id="page-dashboard">
        <div class="suite-hero">
          <div>
            <p class="workspace-kicker">Today</p>
            <h1>Run your WhatsApp business from one secure workspace.</h1>
            <p class="muted-copy">Review setup, conversations, campaigns, customer growth, and Meta connection health before you send.</p>
          </div>
          <div class="hero-command-panel">
            <strong>${unreadInbox} unread conversations</strong>
            <span>${pendingCampaigns} campaigns need attention</span>
            <button class="button primary" data-page-link="inbox" type="button">Open inbox</button>
          </div>
        </div>
        <div class="metric-grid">${metrics.map((metric) => `<article class="metric"><small>${escapeHtml(metric.label)}</small><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.change)}</span></article>`).join('')}</div>
        <div class="ops-grid">
          <article class="panel setup-wizard" id="setupWizard">
            <header>
              <div>
                <h3>Launch checklist</h3>
                <p class="muted-copy" id="setupWizardSummary">Loading setup progress...</p>
              </div>
              <span class="status" id="setupWizardPercent">0%</span>
            </header>
            <div class="setup-progress"><span id="setupWizardBar" style="width:0%"></span></div>
            <div class="setup-steps" id="setupWizardSteps"></div>
          </article>
          <aside class="panel command-center">
            <h3>Action queue</h3>
            <button data-page-link="inbox"><strong>Respond to customers</strong><span>${unreadInbox || inbox.length} active inbox items</span></button>
            <button data-page-link="campaigns"><strong>Prepare campaign</strong><span>${pendingCampaigns} draft or scheduled campaigns</span></button>
            <button data-page-link="commerce"><strong>Sell on WhatsApp</strong><span>${products.length} catalogue products · ${orders.length} orders</span></button>
            <button data-page-link="settings"><strong>Verify Meta setup</strong><span>Credentials, webhook, and test message</span></button>
            <button data-page-link="billing"><strong>Review account</strong><span>${safeBusinessPlan} plan · ${contactUsage}% contact usage</span></button>
          </aside>
        </div>
        <div class="two-col">
          <article class="panel"><header><h3>Recent campaigns</h3><button class="link-button" data-page-link="campaigns">New campaign</button></header>${campaignTable(campaigns)}</article>
          <article class="panel"><header><h3>Inbox snapshot</h3><button class="link-button" data-page-link="inbox">View all</button></header><div class="inbox-list compact">${inbox.slice(0, 4).map(renderInboxListItem).join('')}</div></article>
        </div>
      </section>
      <section class="page" id="page-campaigns">
        <div class="page-heading"><div><h1>Campaigns</h1><p class="muted-copy">Create approved WhatsApp broadcasts, prepare compliant audiences, and track delivery.</p></div><button class="button primary" type="submit" form="campaignForm">Save campaign</button></div>
        <div class="builder-grid">
          <form class="panel form-panel" id="campaignForm"><h3>Campaign builder</h3><label>Name<input name="name" value="Winter Sale Broadcast"></label><label>Message<textarea name="body" id="messageBody">Hi {{first_name}}, our winter sale is live. Reply SHOP to see deals or STOP to opt out.</textarea></label><label>Audience<select name="audience"><option>All contacts</option><option>VIP customers</option><option>Inactive 30d</option></select></label><label>Schedule<select name="scheduleType"><option value="now">Send now</option><option value="later">Schedule later</option></select></label><button class="button primary" type="submit">Save campaign</button></form>
          <article class="phone-preview"><div class="phone-top">WhatsApp Business</div><div class="chat-bubble" id="phoneMessage">Hi {{first_name}}, our winter sale is live. Reply SHOP to see deals or STOP to opt out.</div><div class="reply-row"><button>SHOP</button><button>STOP</button></div></article>
        </div>
      </section>
      <section class="page" id="page-contacts"><div class="page-heading"><div><h1>Contacts</h1><p class="muted-copy">Keep opted-in WhatsApp audiences segmented and ready for campaigns.</p></div><button class="button primary" id="addContactBtn" type="button">Add contact</button></div><article class="panel" id="contactTablePanel">${contactTable(contacts)}</article></section>
      <section class="page" id="page-crm"><div class="page-heading"><div><h1>Subscriber CRM</h1><p class="muted-copy">A lightweight, built-in CRM for following up with WhatsApp subscribers without another subscription.</p></div><button class="button primary" id="crmAddContactButton" type="button">Add subscriber</button></div><div class="metric-grid crm-summary"><article class="metric"><small>Subscribers</small><strong id="crmContactCount">${contacts.length}</strong><span>Customer records in ChatClan</span></article><article class="metric"><small>Follow-up queue</small><strong id="crmFollowUpCount">${unreadInbox}</strong><span>Unread conversations need attention</span></article><article class="metric"><small>Ready to campaign</small><strong>${contacts.filter((contact) => contact.optedIn !== false).length}</strong><span>Opted-in contacts</span></article></div><div class="crm-board"><article class="panel"><header><div><h3>Subscriber pipeline</h3><p class="muted-copy">Move contacts through a simple sales and support workflow.</p></div></header><div class="crm-stages" id="crmStages"><div><strong>New</strong><span>${contacts.length}</span><small>Imported and newly added</small></div><div><strong>In conversation</strong><span>${unreadInbox}</span><small>Requires a reply</small></div><div><strong>Follow up</strong><span>${pendingCampaigns}</span><small>Campaign or sales touchpoint</small></div><div><strong>Customer</strong><span>${orders.length}</span><small>Commerce orders</small></div></div></article><article class="panel"><header><h3>Recent subscribers</h3><button class="link-button" data-page-link="contacts" type="button">Open contacts</button></header><div class="crm-contact-list" id="crmContactList">${contacts.slice(0, 6).map((contact) => `<article><span>${escapeHtml(contact.name || 'Subscriber').slice(0, 1)}</span><div><strong>${escapeHtml(contact.name || 'Subscriber')}</strong><small>${escapeHtml(contact.phone || contact.phoneNumber || 'WhatsApp contact')}</small></div><em>${contact.optedIn === false ? 'Opt-out' : 'Opted in'}</em></article>`).join('') || '<p class="muted-copy">Add your first subscriber to start managing relationships here.</p>'}</div></article></div></section>
      <section class="page" id="page-commerce">
        <div class="page-heading"><div><h1>Commerce</h1><p class="muted-copy">Create product catalogues, share product cards on WhatsApp, and track orders from chat.</p></div><span class="status">${products.length} products</span></div>
        <div class="metric-grid commerce-metrics" id="commerceMetrics">
          <article class="metric"><small>Products</small><strong>${products.length}</strong><span>Catalogue ready</span></article>
          <article class="metric"><small>Orders</small><strong>${orders.length}</strong><span>From WhatsApp and manual sales</span></article>
          <article class="metric"><small>Revenue</small><strong>R 0.00</strong><span>Paid orders</span></article>
          <article class="metric"><small>Stock alerts</small><strong>0</strong><span>Low inventory</span></article>
        </div>
        <div class="commerce-toolbar"><button class="button primary" type="button" data-open-modal="productForm">Add product</button><button class="button" type="button" data-open-modal="shareCatalogForm">Share on WhatsApp</button><button class="button" type="button" data-open-modal="productImportForm">Bulk import</button><button class="button" type="button" data-open-modal="collectionForm">New collection</button><button class="button" type="button" data-open-modal="couponForm">Create coupon</button><button class="button" type="button" data-open-modal="variantForm">Add variant</button></div>
        <div class="commerce-grid">
          <form class="panel form-panel modal-source" id="productForm">
            <h3>Add product</h3>
            <input name="productId" type="hidden">
            <label>Name<input name="name" value="Winter Knit Dress" required></label>
            <label>SKU<input name="sku" value="winter-knit-dress"></label>
            <label>Price (ZAR)<input name="price" type="number" min="1" step="0.01" value="699" required></label>
            <label>Stock<input name="inventoryCount" type="number" min="0" value="18"></label>
            <label>Image URL<input name="imageUrl" placeholder="https://..."></label>
            <label>Meta Catalog ID<input name="metaCatalogId" placeholder="Optional Meta catalog id"></label>
            <label>Product Retailer ID<input name="metaProductRetailerId" placeholder="Usually SKU"></label>
            <label>Payment or product URL<input name="paymentLinkUrl" placeholder="https://..."></label>
            <label>Status<select name="status"><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <label>Description<textarea name="description">Warm midi dress available in olive and black.</textarea></label>
            <div class="commerce-row-actions">
              <button class="button primary" id="productSubmitBtn" type="submit">Save product</button>
              <button class="button" id="cancelProductEditBtn" type="button">Clear</button>
            </div>
          </form>
          <article class="panel">
            <header><h3>Catalogue</h3><button class="link-button" id="refreshCommerceBtn" type="button">Refresh</button></header>
            <div class="product-grid" id="productGrid">${products.map(renderProductCard).join('') || '<p class="muted-copy">Add your first product to start selling on WhatsApp.</p>'}</div>
          </article>
        </div>
        <div class="commerce-grid commerce-actions-grid">
          <div class="commerce-form-stack">
            <form class="panel form-panel modal-source" id="shareCatalogForm">
              <h3>Share on WhatsApp</h3>
              <label>Customer WhatsApp number<input name="to" placeholder="27821234567" required></label>
              <label>Message<textarea name="body">Browse our latest products and reply here if you need help checking out.</textarea></label>
              <button class="button primary" type="submit">Send catalogue</button>
              <small class="muted-copy">Uses Meta catalog/carousel payloads when product catalogue IDs are configured. Local and staging sends remain mock-safe unless live mode is enabled.</small>
            </form>
            <form class="panel form-panel" id="catalogSyncForm">
              <h3>Meta catalog sync</h3>
              <label>Catalog ID<input name="catalogId" placeholder="Use product Meta Catalog ID"></label>
              <label><input name="includeVariants" type="checkbox" checked> Include variants as catalog items</label>
              <div class="commerce-sync-status" id="catalogSyncStatus"><p class="muted-copy">Loading catalog readiness...</p></div>
              <div class="commerce-row-actions">
                <button class="button" id="previewCatalogSyncBtn" type="button">Preview sync</button>
                <button class="button primary" type="submit">Sync catalog</button>
              </div>
              <small class="muted-copy">Preview builds the Meta items_batch payload. Live sync only runs when META_CATALOG_MODE is set to live.</small>
            </form>
            <form class="panel form-panel modal-source" id="productImportForm">
              <h3>Bulk product import</h3>
              <label>CSV products<textarea name="csvText" rows="8">name,sku,price,stock,image_url,catalog_id,retailer_id,url,description
Classic Tee,classic-tee,199,25,https://example.co.za/classic-tee.jpg,demo_catalog_za,classic-tee,https://example.co.za/products/classic-tee,Everyday cotton tee</textarea></label>
              <div class="commerce-row-actions">
                <button class="button" id="previewProductImportBtn" type="button">Preview import</button>
                <button class="button primary" type="submit">Import products</button>
              </div>
              <small class="muted-copy" id="productImportStatus">Columns: name, sku, price, stock, image_url, catalog_id, retailer_id, url, description.</small>
            </form>
            <form class="panel form-panel modal-source" id="collectionForm">
              <h3>Product collection</h3>
              <label>Name<input name="name" value="New arrivals" required></label>
              <label>Product IDs<input name="productIds" placeholder="1000,1001" required></label>
              <label>Description<textarea name="description">A focused set of products to share on WhatsApp.</textarea></label>
              <button class="button primary" type="submit">Save collection</button>
              <small class="muted-copy">Use product IDs from the cards above. Collections share through the WhatsApp catalogue payload.</small>
            </form>
            <form class="panel form-panel modal-source" id="couponForm">
              <h3>Coupon</h3>
              <label>Code<input name="code" value="WINTER10" required></label>
              <label>Name<input name="name" value="Winter WhatsApp offer"></label>
              <label>Type<select name="discountType"><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label>
              <label>Value<input name="discountValue" type="number" min="1" value="10" required></label>
              <label>Minimum order (ZAR)<input name="minimumOrder" type="number" min="0" step="0.01" value="0"></label>
              <label>Max redemptions<input name="maxRedemptions" type="number" min="1" placeholder="Optional"></label>
              <button class="button primary" type="submit">Save coupon</button>
            </form>
            <form class="panel form-panel modal-source" id="variantForm">
              <h3>Add variant</h3>
              <label>Product ID<input name="productId" placeholder="Product ID" required></label>
              <label>Option<input name="optionName" value="Size"></label>
              <label>Value<input name="optionValue" value="Medium" required></label>
              <label>Variant SKU<input name="sku" placeholder="winter-knit-dress-medium"></label>
              <label>Price override (ZAR)<input name="price" type="number" min="0" step="0.01"></label>
              <label>Variant stock<input name="inventoryCount" type="number" min="0" value="5"></label>
              <button class="button" type="submit">Save variant</button>
            </form>
          </div>
          <article class="panel">
            <header><h3>Orders</h3><span class="status" id="commerceOrderCount">${orders.length}</span></header>
            <div id="orderTable">${orderTable(orders)}</div>
            <div class="order-detail" id="orderDetail"><p class="muted-copy">Select an order action to view items, events, and payment state.</p></div>
          </article>
        </div>
        <article class="panel">
          <header><h3>Abandoned carts</h3><span class="status" id="abandonedCartCount">0</span></header>
          <div class="abandoned-cart-list" id="abandonedCartList"><p class="muted-copy">Unpaid WhatsApp carts ready for recovery will appear here.</p></div>
        </article>
        <article class="panel">
          <header><h3>Returns & refunds</h3><span class="status" id="returnRequestCount">0</span></header>
          <div class="return-request-list" id="returnRequestList"><p class="muted-copy">Return and refund requests will appear here.</p></div>
        </article>
        <article class="panel">
          <header><h3>Customer segments</h3><span class="status" id="customerSegmentCount">0</span></header>
          <div class="customer-segment-list" id="customerSegmentList"><p class="muted-copy">Buyer segments will appear after orders are created.</p></div>
        </article>
        <article class="panel">
          <header><h3>Automation rules</h3><div class="commerce-row-actions"><button class="link-button" id="syncCommerceAutomationTemplatesBtn" type="button">Sync templates</button><span class="status" id="commerceAutomationRuleCount">0</span></div></header>
          <div class="automation-insight-strip" id="commerceAutomationInsightStrip"><span>Scheduled 0</span><span>Sent 0</span><span>Suppressed 0</span><span>Revenue R 0.00</span><span>Cost R 0.00</span><span>ROI --</span><span>Rate 0%</span></div>
          <div class="automation-readiness" id="commerceAutomationReadiness"><p class="muted-copy">Template readiness will appear here.</p></div>
          <div class="automation-recommendation-list" id="commerceAutomationRecommendationList"><p class="muted-copy">Automation recommendations will appear after activity.</p></div>
          <div class="automation-activity-list" id="commerceAutomationActivityList"><p class="muted-copy">Automation activity will appear here.</p></div>
          <div class="automation-preview-panel hidden" id="commerceAutomationPreviewPanel"></div>
          <div class="automation-rule-list" id="commerceAutomationRuleList"><p class="muted-copy">Post-purchase automation rules will appear here.</p></div>
        </article>
        <article class="panel">
          <header><h3>Collections</h3><span class="status" id="collectionCount">0</span></header>
          <div class="collection-grid" id="collectionGrid"><p class="muted-copy">Create a collection to share a focused product set.</p></div>
        </article>
        <article class="panel">
          <header><h3>Inventory alerts</h3><span class="status" id="inventoryAlertCount">0</span></header>
          <div class="inventory-alert-list" id="inventoryAlertList"><p class="muted-copy">Low and out-of-stock products will appear here.</p></div>
        </article>
        <article class="panel">
          <header><h3>Coupons</h3><span class="status" id="couponCount">0</span></header>
          <div class="coupon-grid" id="couponGrid"><p class="muted-copy">Create WhatsApp-only offers and apply them to orders.</p></div>
        </article>
      </section>
      <section class="page" id="page-inbox"><div class="page-heading"><div><h1>Inbox</h1><p class="muted-copy">Manage customer conversations, ownership, notes, SLA, replies, and CSAT.</p></div><span class="status">${unreadInbox} unread</span></div><div class="inbox-grid"><article class="panel inbox-list" id="inboxList">${inbox.map(renderInboxListItem).join('')}</article><article class="panel conversation" id="inboxConversation" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><header><div><h3 id="inboxCustomerName">${escapeHtml(activeInbox.customerName || activeInbox.name || 'Conversation')}</h3><p class="muted-copy" id="inboxCustomerMeta">${escapeHtml(activeInbox.customerPhone || 'WhatsApp customer')}</p></div><span class="status" id="inboxSlaBadge">${escapeHtml(activeInbox.slaStatus || 'open')}</span></header><div class="inbox-meta"><span id="inboxAssigned">${activeInbox.assignedUserName ? `Assigned to ${escapeHtml(activeInbox.assignedUserName)}` : 'Unassigned'}</span><span id="inboxCsat">${activeInbox.csatScore ? `CSAT ${escapeHtml(activeInbox.csatScore)}/5` : 'No CSAT yet'}</span></div><div class="conversation-stream" id="inboxMessages"><p class="chat-left">${escapeHtml(activeInbox.preview || activeInbox.lastMessagePreview || 'Select a conversation to view messages.')}</p></div><p class="typing-indicator" id="typingIndicator"></p><div class="reply-tools"><button class="button" id="generateInboxAiDraftButton" type="button">AI draft</button></div><form id="replyForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}" data-ai-draft-id=""><input name="body" placeholder="Type a reply"><button class="button primary">Send</button></form><form class="inline-form" id="noteForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><input name="body" placeholder="Add an internal note"><button class="button">Add note</button></form><div class="note-list" id="inboxNotes"></div><form class="inline-form" id="csatForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><select name="score"><option value="">CSAT</option><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Bad</option></select><input name="comment" placeholder="Optional CSAT note"><button class="button">Save</button></form></article></div></section>
      <section class="page" id="page-flows">
        <div class="page-heading"><div><h1>Automations</h1><p class="muted-copy">Build WhatsApp chatbot flows from industry templates and test them before publishing.</p></div><button class="button" id="refreshFlowsBtn" type="button">Refresh</button></div>
        <div class="flows-grid">
          <article class="panel">
            <header><h3>Industry flow templates</h3></header>
            <div class="flow-template-grid" id="flowTemplateGrid"><p class="muted-copy">Loading flow templates...</p></div>
          </article>
          <article class="panel">
            <header><h3>Workspace flows</h3><button class="link-button" id="publishFlowBtn">Publish selected</button></header>
            <div class="flow-list" id="flowList"><p class="muted-copy">Duplicate a template to start.</p></div>
          </article>
        </div>
        <div class="flows-grid flow-sim-grid">
          <article class="panel">
            <header><h3>Flow editor</h3><span class="status" id="flowValidationStatus">No flow selected</span></header>
            <textarea id="flowDefinitionEditor" class="code-editor" spellcheck="false" placeholder="Select a flow to edit its JSON definition"></textarea>
            <div class="editor-actions"><button class="button primary" id="saveFlowBtn">Save definition</button><button class="button" id="simulateFlowBtn">Run test</button></div>
          </article>
          <article class="phone-preview flow-phone">
            <div class="phone-top">ChatClan Bot Test</div>
            <div class="flow-test-input"><input id="flowTestInput" value="Product discovery" placeholder="Simulated customer message"><button class="button primary" id="sendFlowTestBtn">Test</button></div>
            <div class="flow-transcript" id="flowTranscript"><p class="chat-left">Choose a flow and run a test message.</p></div>
          </article>
        </div>
      </section>
      <section class="page" id="page-intelligence">
        <div class="page-heading"><div><h1>Knowledge & AI</h1><p class="muted-copy">Control approved business facts and monitor AI-assisted inbox outcomes.</p></div><button class="button primary" id="addKnowledgeItemButton" type="button">Add knowledge</button></div>
        <div class="intelligence-subnav" role="tablist" aria-label="Knowledge and AI views"><button class="active" data-intelligence-tab="knowledge" type="button">Knowledge</button><button data-intelligence-tab="sources" type="button">Sources & evals</button><button data-intelligence-tab="connectors" type="button">Connector ops</button><button data-intelligence-tab="quality" type="button">AI quality</button></div>
        <section class="intelligence-view active" id="intelligenceKnowledgeView">
          <div class="metric-grid intelligence-summary" id="knowledgeSummary"><article class="metric"><small>Approved</small><strong>0</strong><span>Loading</span></article></div>
          <div class="knowledge-layout"><article class="panel"><header><div><h3>Approved sources</h3><p class="muted-copy">FAQs, policies, and agent instructions available to retrieval.</p></div><span class="status" id="knowledgeStatus">Loading</span></header><div class="knowledge-list" id="knowledgeItemList"><p class="muted-copy">Loading knowledge...</p></div></article><article class="panel"><h3>Structured sources</h3><div class="source-readiness-list"><div><strong>Catalogue</strong><span>Active products and stock</span></div><div><strong>Customer orders</strong><span>Phone-scoped order status</span></div><div><strong>Workspace</strong><span>Business identity and plan</span></div></div></article></div>
        </section>
        <section class="intelligence-view" id="intelligenceSourcesView">
          <div class="workspace-action-row"><div><h2>Sources & evaluations</h2><p class="muted-copy">Import reviewable content, connect normalized data feeds, and test retrieval before expanding automation.</p></div><div><button class="button primary" id="importKnowledgeButton" type="button">Import file</button><button class="button" id="addKnowledgeConnectorButton" type="button">Add connector</button><button class="button" id="addKnowledgeEvalButton" type="button">New evaluation</button></div></div>
          <div class="metric-grid intelligence-summary" id="knowledgeOpsSummary"><article class="metric"><small>Sources</small><strong>0</strong><span>Loading</span></article></div>
          <div class="two-col knowledge-ops-grid"><article class="panel"><header><div><h3>Ingestion sources</h3><p class="muted-copy">Uploads and adapter feeds with their latest sync health.</p></div></header><div class="quality-list" id="knowledgeSourceList"><p class="muted-copy">Loading sources...</p></div></article><article class="panel"><header><div><h3>Evaluation suite</h3><p class="muted-copy">Repeatable cases for grounding, completeness, and isolation.</p></div><button class="button ghost" id="runKnowledgeEvalsButton" type="button">Run suite</button></header><div class="quality-list" id="knowledgeEvalCaseList"><p class="muted-copy">No evaluation cases yet.</p></div></article></div>
          <article class="panel"><header><div><h3>Latest evaluation</h3><p class="muted-copy" id="knowledgeEvalMethod">Metrics use deterministic source-reference, term, isolation, and lexical support checks.</p></div><span class="status" id="knowledgeEvalStatus">Not run</span></header><div class="eval-metric-strip" id="knowledgeEvalResults"><p class="muted-copy">Run the suite after adding at least one evaluation case.</p></div></article>
        </section>
        <section class="intelligence-view" id="intelligenceConnectorsView">
          <div class="workspace-action-row"><div><h2>Connector operations</h2><p class="muted-copy">Monitor source freshness, synchronisation outcomes, retries, and provider health.</p></div><button class="button" id="refreshConnectorOpsButton" type="button">Refresh</button></div>
          <div class="metric-grid intelligence-summary" id="connectorOpsSummary"><article class="metric"><small>Active</small><strong>0</strong><span>Loading</span></article></div>
          <div class="two-col connector-ops-grid"><article class="panel"><header><div><h3>Health alerts</h3><p class="muted-copy">Freshness and failure signals requiring attention.</p></div><div class="panel-header-actions"><span class="status" id="connectorAlertStatus">Loading</span><button class="button ghost" id="connectorAlertSettingsButton" type="button">Alert settings</button></div></header><div class="quality-list" id="connectorAlertList"><p class="muted-copy">Loading alerts...</p></div></article><article class="panel"><header><div><h3>Google Drive OAuth</h3><p class="muted-copy">Platform authorization and scope readiness.</p></div><span class="status" id="googleDriveOAuthStatus">Checking</span></header><div id="googleDriveOAuthReadiness" class="connector-readiness"><p class="muted-copy">Loading OAuth configuration...</p></div></article></div>
          <article class="panel"><header><div><h3>Source freshness</h3><p class="muted-copy">Current SLA, last success, next run, and recent reliability.</p></div></header><div class="connector-health-table" id="connectorHealthList"><p class="muted-copy">No live connectors yet.</p></div></article>
          <article class="panel"><header><div><h3>Recent sync attempts</h3><p class="muted-copy">Every worker attempt, including retries and record outcomes.</p></div></header><div class="connector-run-list" id="connectorRunList"><p class="muted-copy">No synchronisation attempts yet.</p></div></article>
          <article class="panel"><header><div><h3>Alert history</h3><p class="muted-copy">Notification, acknowledgement, escalation, and recovery evidence.</p></div></header><div class="connector-alert-history" id="connectorAlertHistory"><p class="muted-copy">No connector alerts recorded.</p></div></article>
        </section>
        <section class="intelligence-view" id="intelligenceQualityView">
          <div class="metric-grid intelligence-summary" id="aiQualitySummary"><article class="metric"><small>Drafts</small><strong>0</strong><span>Loading</span></article></div>
          <div class="two-col"><article class="panel"><header><h3>Provider performance</h3></header><div class="quality-list" id="aiProviderQuality"><p class="muted-copy">No provider data yet.</p></div></article><article class="panel"><header><h3>Safety signals</h3></header><div class="quality-list" id="aiSafetySignals"><p class="muted-copy">No safety flags recorded.</p></div></article></div>
          <article class="panel"><header><h3>Recent draft outcomes</h3></header><div class="quality-list" id="aiDraftOutcomes"><p class="muted-copy">No AI drafts recorded.</p></div></article>
        </section>
      </section>
      <section class="page" id="page-templates"><div class="page-heading"><div><h1>Templates</h1><p class="muted-copy">Maintain Meta-approved templates for compliant outbound messages.</p></div><button class="button primary" id="createTemplateButton" type="button">Create template</button></div><div class="template-grid" id="templateGrid">${templates.map((tpl) => `<article class="panel template"><small>${escapeHtml(tpl.category)} · ${escapeHtml(tpl.status)}</small><h3>${escapeHtml(tpl.name)}</h3><p>${escapeHtml(tpl.body)}</p><button class="button ghost" data-page-link="campaigns">Use template</button></article>`).join('')}</div></section>
      <section class="page" id="page-analytics"><div class="page-heading"><div><h1>Insights</h1><p class="muted-copy">Track WhatsApp campaign performance, customer response trends, and Meta delivery costs.</p></div><button class="button" id="refreshInsightsBtn" type="button">Refresh</button></div><div class="metric-grid" id="insightSummary"><article class="metric"><small>Sent</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Delivered</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Read rate</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Replies</small><strong>--</strong><span>Loading</span></article></div><div class="two-col"><article class="panel"><header><h3>Campaign performance</h3><span class="status" id="insightStatus">Loading</span></header><div class="bar-chart" id="insightChart"></div></article><article class="panel"><header><h3>Actionable insights</h3><span class="status" id="insightCost">Cost loading</span></header><div class="insight-list" id="insightActions"><p class="muted-copy">Loading recommendations...</p></div></article></div><article class="panel"><header><h3>Campaign ranking</h3></header><div id="insightCampaigns"><p class="muted-copy">Loading campaigns...</p></div></article></section>
      <section class="page" id="page-integrations">
        <div class="page-heading"><div><h1>CRM integrations</h1><p class="muted-copy">Keep consented customer records aligned with the sales tools your team already uses.</p></div><button class="button primary" id="connectTenantCrmButton" type="button">Connect CRM</button></div>
        <div class="metric-grid" id="tenantCrmSummary"><article class="metric"><small>Connected</small><strong>0</strong><span>Loading</span></article></div>
        <div class="integration-provider-strip" id="tenantCrmProviderStrip"><p class="muted-copy">Loading provider readiness...</p></div>
        <article class="panel"><header><div><h3>Connected CRMs</h3><p class="muted-copy">Connection health, sync cadence, and account-safe controls.</p></div><button class="button ghost" id="refreshTenantCrmButton" type="button">Refresh</button></header><div class="tenant-crm-list" id="tenantCrmConnectionList"><p class="muted-copy">No CRM connected yet.</p></div></article>
        <article class="panel"><header><div><h3>Sync history</h3><p class="muted-copy">Durable worker attempts with record outcomes and failure evidence.</p></div></header><div class="connector-run-list" id="tenantCrmRunList"><p class="muted-copy">No CRM synchronisation attempts yet.</p></div></article>
      </section>
      <section class="page" id="page-billing"><div class="page-heading"><div><h1>Billing</h1><p class="muted-copy">Manage plan, payment provider, contact usage, and account renewal.</p></div></div><div class="two-col"><article class="panel"><h3>Current plan: ${safeBusinessPlan}</h3><p>Renews ${escapeHtml(business.billingRenewal)}. PayFast is the recommended first production provider for subscriptions on this build.</p><div class="provider-grid">${providers.map((p) => `<article><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.strength)}</span><small>${escapeHtml(p.fees)}</small><em>${escapeHtml(p.status)}</em></article>`).join('')}</div></article><article class="panel"><h3>Usage</h3><p>${Number(business.contactsUsed || 0)} of ${Number(business.contactsLimit || 0)} contacts used.</p><div class="meter"><span style="width:${contactUsage}%"></span></div></article></div></section>
      <section class="page" id="page-settings"><div class="page-heading"><div><h1>Settings & API</h1><p class="muted-copy">Configure Meta assets, encrypted credentials, team access, webhooks, and POPIA workflows.</p></div></div><div class="two-col"><div class="settings-stack"><article class="panel form-panel"><h3>Meta Business Verification</h3><p class="muted-copy">For South African businesses, keep CIPC registration documents, director ID, proof of address, display name evidence, and website/domain details ready before submitting in Meta Business Manager.</p><button class="button" id="markVerificationCompleteBtn" type="button">Mark verification ready</button><small class="muted-copy">Use this once Meta Business Manager shows the account as verified or ready for WABA review.</small></article><article class="panel form-panel" id="metaOnboardingPanel"><h3>Embedded Signup</h3><p class="muted-copy">Launch Meta onboarding, capture WABA and phone assets, exchange the returned code, and save the business token securely.</p><div class="setup-steps compact" id="metaOnboardingChecks"><p class="muted-copy">Loading Meta onboarding status...</p></div><button class="button primary" id="launchMetaSignupBtn" type="button">Launch Embedded Signup</button><small id="metaOnboardingStatus" class="muted-copy">Configure META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID for live launch.</small></article><form class="panel form-panel" id="metaEmbeddedSignupForm"><h3>Complete signup</h3><label>OAuth code<input name="code" value="demo_embedded_signup_code" required></label><label>WABA ID<input name="wabaId" value="demo_waba_signup" required></label><label>Phone Number ID<input name="phoneNumberId" value="demo_phone_signup" required></label><label>Business phone<input name="phoneNumber" placeholder="27821234567"></label><label>Verify token<input name="verifyToken" placeholder="Webhook verify token"></label><button class="button" type="submit">Save signup result</button><small class="muted-copy">In mock mode this simulates Meta's code exchange. In live mode it calls Meta's OAuth token endpoint.</small></form><form class="panel form-panel" id="metaPhoneRegistrationForm"><h3>Phone registration</h3><label>6 digit PIN<input name="pin" inputmode="numeric" minlength="6" maxlength="6" placeholder="123456" required></label><label>Data localization country<input name="dataLocalizationRegion" maxlength="2" placeholder="Optional, e.g. ZA"></label><button class="button" type="submit">Register phone</button><small id="metaPhoneRegistrationStatus" class="muted-copy">Register after Embedded Signup returns a verified phone number ID.</small></form><form class="panel form-panel" id="metaCredentialsForm"><h3>Meta Credentials</h3><p class="muted-copy">Credentials are encrypted at rest and scoped to this business workspace.</p><label>WABA ID<input name="wabaId" placeholder="WhatsApp Business Account ID" required></label><label>Phone Number ID<input name="phoneNumberId" placeholder="Meta Phone Number ID" required></label><label>Access Token<input name="accessToken" type="password" placeholder="Permanent or system-user token" required></label><label>Verify Token<input name="verifyToken" placeholder="Webhook verification token"></label><button class="button primary" type="submit">Save encrypted credentials</button><small id="metaCredentialStatus" class="muted-copy">Not connected</small></form><form class="panel form-panel" id="testMessageForm"><h3>Meta Cloud API</h3><p class="muted-copy">Send a test message using encrypted workspace credentials, or environment fallback in local mode.</p><label>Test recipient<input name="to" placeholder="27821234567"></label><label>Message<textarea name="text">Hello from ${brand.name}.</textarea></label><button class="button primary">Send test message</button></form><form class="panel form-panel" id="dataDeletionForm"><h3>POPIA Data Deletion</h3><p class="muted-copy">Submit a data subject deletion request. Matching contact data, campaign recipients, and inbox conversation content are redacted while the audit record is retained.</p><label>Customer WhatsApp number<input name="phone" placeholder="+27821234567" required></label><label>Reason<input name="reason" value="Customer requested deletion"></label><button class="button danger-button" type="submit">Process deletion request</button><small id="dataDeletionStatus" class="muted-copy">Owners and admins can process POPIA deletion requests.</small><div class="request-list" id="dataDeletionRequests"></div></form><form class="panel form-panel" id="teamUserForm"><h3>Team Access</h3><label>Name<input name="name" placeholder="Team member name" required></label><label>Email<input name="email" type="email" placeholder="teammate@example.co.za" required></label><label>Role<select name="role"><option value="agent">Agent</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></label><button class="button primary" type="submit">Add team member</button><small id="teamUserStatus" class="muted-copy">Owners and admins can add workspace users.</small></form></div><article class="panel"><h3>Webhook URLs</h3><code>/webhooks/meta</code><code>/webhooks/payfast/itn</code><p class="muted-copy">Use the Meta verify token you saved here when configuring the webhook subscription.</p></article></div></section>
    </section>
    <aside class="notification-center" id="notificationCenter" aria-hidden="true" role="dialog" aria-modal="false" aria-labelledby="notificationTitle">
      <header><div><p class="workspace-kicker">Activity</p><h3 id="notificationTitle">What needs your attention</h3></div><button class="icon-button" id="closeNotificationsButton" type="button" aria-label="Close notifications">×</button></header>
      <div class="notification-list" id="notificationList"><p class="muted-copy">Loading activity…</p></div>
    </aside>
    <dialog class="app-modal" id="appModal" aria-labelledby="appModalTitle"><header><div><p class="workspace-kicker" id="appModalKicker">Workspace</p><h2 id="appModalTitle">Add record</h2></div><button class="icon-button" id="closeAppModalButton" type="button" aria-label="Close dialog">×</button></header><div id="appModalBody"></div></dialog>
    <form class="modal-source form-panel" id="contactForm"><input name="contactId" type="hidden"><label>Name<input name="name" maxlength="160" required placeholder="Customer name"></label><label>WhatsApp number<input name="phone" inputmode="tel" required placeholder="+27 82 123 4567"></label><label>Segment<select name="segment"><option value="Manual">Manual</option><option value="Lead">Lead</option><option value="Customer">Customer</option><option value="VIP">VIP</option></select></label><label class="checkbox-label"><input name="optedIn" type="checkbox" checked> This person has opted in to receive WhatsApp messages.</label><div class="modal-actions"><button class="button" data-close-modal type="button">Cancel</button><button class="button primary" type="submit">Add contact</button></div></form>
    <dialog class="app-modal confirm-modal" id="contactDeleteDialog" aria-labelledby="contactDeleteTitle"><header><div><p class="workspace-kicker">Contact management</p><h2 id="contactDeleteTitle">Delete contact?</h2></div><button class="icon-button" id="closeContactDeleteDialog" type="button" aria-label="Close dialog">×</button></header><div class="confirm-modal-body"><p id="contactDeleteMessage">This contact will be removed from active lists.</p><p class="muted-copy">The record is soft-deleted and retained for audit purposes. It will no longer receive campaigns or appear in Contacts.</p><div class="modal-actions"><button class="button" id="cancelContactDelete" type="button">Cancel</button><button class="button danger-button" id="confirmContactDelete" type="button">Delete contact</button></div></div></dialog>
    <form class="modal-source form-panel" id="templateForm"><label>Template name<input name="name" required maxlength="100" pattern="[a-z0-9_]+" placeholder="winter_offer"></label><label>Category<select name="category"><option value="Marketing">Marketing</option><option value="Utility">Utility</option><option value="Authentication">Authentication</option></select></label><label>Language<select name="language"><option value="en_ZA">English (South Africa)</option><option value="af">Afrikaans</option></select></label><label>Message body<textarea name="body" maxlength="1024" required placeholder="Hi {{1}}, your offer is ready."></textarea></label><label>Footer <input name="footer" maxlength="60" placeholder="Optional footer"></label><small class="muted-copy">Use sequential variables only: {{1}}, {{2}}, {{3}}.</small><div class="modal-actions"><button class="button" data-close-modal type="button">Cancel</button><button class="button primary" type="submit">Create draft</button></div></form>
    <aside class="drawer-backdrop" id="inboxAiDraftDrawer" aria-hidden="true">
      <section class="side-drawer inbox-ai-draft-drawer" role="dialog" aria-modal="true" aria-labelledby="inboxAiDraftTitle">
        <header><div><p class="workspace-kicker">Human review</p><h2 id="inboxAiDraftTitle">AI reply draft</h2><p class="muted-copy" id="inboxAiDraftMeta">Review every word before using it.</p></div><button class="icon-button" type="button" id="closeInboxAiDraftButton" aria-label="Close AI draft drawer">×</button></header>
        <div class="ai-draft-state" id="inboxAiDraftState"><p class="muted-copy">Generate a draft from the active conversation.</p></div>
        <label class="ai-draft-editor">Draft<textarea id="inboxAiDraftBody" maxlength="1600" rows="8"></textarea></label>
        <div class="ai-draft-actions"><button class="button primary" id="useInboxAiDraftButton" type="button">Use draft</button><button class="button" id="discardInboxAiDraftButton" type="button">Discard</button></div>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="tenantCrmConnectDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="tenantCrmConnectTitle">
        <header><div><p class="workspace-kicker">Customer data</p><h2 id="tenantCrmConnectTitle">Connect a CRM</h2><p class="muted-copy">ChatClan requests contact access only and stores refresh credentials encrypted.</p></div><button class="icon-button" type="button" data-close-tenant-crm aria-label="Close CRM connection drawer">×</button></header>
        <form class="form-panel" id="tenantCrmConnectForm">
          <label>Provider<select name="provider" id="tenantCrmProvider"><option value="hubspot">HubSpot</option><option value="salesforce">Salesforce</option><option value="zoho">Zoho CRM</option><option value="pipedrive">Pipedrive</option></select></label>
          <label>Sync schedule<select name="syncIntervalMinutes"><option value="60">Hourly</option><option value="360" selected>Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option></select></label>
          <fieldset class="crm-field-map"><legend>Contact field mapping</legend><label>Name<input name="mapName" required></label><label>Email<input name="mapEmail" required></label><label>Phone<input name="mapPhone" required></label><label>Segment <small>Optional</small><input name="mapSegment"></label><label>Opt-in status <small>Optional</small><input name="mapOptedIn"></label></fieldset>
          <div class="import-format-note" id="tenantCrmConnectNote"><strong>OAuth consent</strong><span>You will continue to the provider to approve access. Platform OAuth secrets never enter this form.</span></div>
          <button class="button primary" type="submit">Continue securely</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="tenantCrmManageDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="tenantCrmManageTitle">
        <header><div><p class="workspace-kicker">CRM operations</p><h2 id="tenantCrmManageTitle">Manage connection</h2><p class="muted-copy" id="tenantCrmManageMeta">Health, mapping, sync, and recovery controls.</p></div><button class="icon-button" type="button" data-close-tenant-crm aria-label="Close CRM management drawer">×</button></header>
        <form class="form-panel" id="tenantCrmManageForm">
          <input name="connectionId" type="hidden">
          <div class="source-health" id="tenantCrmHealth"></div>
          <label>Status<select name="status"><option value="connected">Active</option><option value="paused">Paused</option></select></label>
          <label>Sync schedule<select name="syncIntervalMinutes"><option value="60">Hourly</option><option value="360">Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option><option value="10080">Weekly</option></select></label>
          <fieldset class="crm-field-map"><legend>Contact field mapping</legend><label>Name<input name="mapName" required></label><label>Email<input name="mapEmail" required></label><label>Phone<input name="mapPhone" required></label><label>Segment <small>Optional</small><input name="mapSegment"></label><label>Opt-in status <small>Optional</small><input name="mapOptedIn"></label></fieldset>
          <button class="button primary" type="submit">Save settings</button>
          <div class="drawer-form-actions"><button class="button" id="testTenantCrmButton" type="button">Test connection</button><button class="button" id="syncTenantCrmButton" type="button">Sync now</button></div>
          <button class="button danger-button" id="disconnectTenantCrmButton" type="button">Disconnect CRM</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="knowledgeItemDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="knowledgeItemDrawerTitle">
        <header><div><p class="workspace-kicker">Approved knowledge</p><h2 id="knowledgeItemDrawerTitle">Add knowledge</h2><p class="muted-copy">Only approved items are available to AI retrieval.</p></div><button class="icon-button" type="button" id="closeKnowledgeItemDrawerButton" aria-label="Close knowledge drawer">×</button></header>
        <form class="form-panel knowledge-item-form" id="knowledgeItemForm">
          <input name="itemId" type="hidden">
          <label>Type<select name="itemType"><option value="faq">FAQ</option><option value="policy">Policy</option><option value="instruction">Agent instruction</option></select></label>
          <label>Title<input name="title" maxlength="220" required></label>
          <label>Content<textarea name="content" maxlength="10000" rows="10" required></textarea></label>
          <label>Keywords<input name="keywords" placeholder="returns, collection, delivery"></label>
          <label>Status<select name="status"><option value="draft">Draft</option><option value="approved">Approved</option><option value="archived">Archived</option></select></label>
          <button class="button primary" type="submit">Save knowledge</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="knowledgeImportDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="knowledgeImportTitle">
        <header><div><p class="workspace-kicker">Knowledge ingestion</p><h2 id="knowledgeImportTitle">Import knowledge</h2><p class="muted-copy">CSV, text, Markdown, PDF, and DOCX files are split into reviewable tenant records.</p></div><button class="icon-button" type="button" data-close-knowledge-ops aria-label="Close knowledge import drawer">×</button></header>
        <form class="form-panel" id="knowledgeImportForm">
          <label>File<input name="file" type="file" accept=".csv,.txt,.md,.markdown,.pdf,.docx,text/csv,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label>
          <label>Review status<select name="defaultStatus"><option value="draft">Import as drafts</option><option value="approved">Approve on import</option></select></label>
          <div class="import-format-note"><strong>CSV columns</strong><span><code>title, content, type, keywords, external_ref</code></span></div>
          <button class="button primary" type="submit">Import knowledge</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="knowledgeConnectorDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="knowledgeConnectorTitle">
        <header><div><p class="workspace-kicker">Live knowledge</p><h2 id="knowledgeConnectorTitle">Add connector</h2><p class="muted-copy">Synchronise approved business data while keeping provider credentials encrypted.</p></div><button class="icon-button" type="button" data-close-knowledge-ops aria-label="Close knowledge connector drawer">×</button></header>
        <form class="form-panel" id="knowledgeConnectorForm">
          <label>Provider<select name="provider" id="knowledgeConnectorProvider"><option value="shopify">Shopify</option><option value="woocommerce">WooCommerce</option><option value="google_drive">Google Drive</option><option value="api_push">Custom API push</option></select></label>
          <label>Connector name<input name="name" maxlength="220" placeholder="Product and policy knowledge" required></label>
          <div class="connector-fields" data-connector-fields="shopify"><label>Shop domain<input name="shopDomain" placeholder="your-store.myshopify.com"></label><label>Admin API access token<input name="accessToken" type="password" autocomplete="new-password"></label></div>
          <div class="connector-fields" data-connector-fields="woocommerce" hidden><label>Store URL<input name="storeUrl" type="url" placeholder="https://shop.example.co.za"></label><label>Consumer key<input name="consumerKey" autocomplete="off"></label><label>Consumer secret<input name="consumerSecret" type="password" autocomplete="new-password"></label></div>
          <div class="connector-fields" data-connector-fields="google_drive" hidden><label>Folder ID<input name="folderId" placeholder="Optional Drive folder ID"></label><div class="oauth-consent-note"><strong>Google consent required</strong><span>You will continue to Google to grant read-only Drive access. ChatClan stores the returned refresh token encrypted for scheduled synchronisation.</span></div></div>
          <label data-live-connector-field>Sync schedule<select name="syncIntervalMinutes"><option value="60">Hourly</option><option value="360" selected>Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option></select></label>
          <label>Review status<select name="defaultStatus"><option value="draft">New records require review</option><option value="approved">Approve synced records</option></select></label>
          <div class="import-format-note" id="knowledgeConnectorNote"><strong>Initial sync</strong><span>The connector is queued immediately. Repeated provider references update existing knowledge records.</span></div>
          <button class="button primary" type="submit">Create connector</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="knowledgeSourceDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="knowledgeSourceDrawerTitle">
        <header><div><p class="workspace-kicker">Source control</p><h2 id="knowledgeSourceDrawerTitle">Manage source</h2><p class="muted-copy" id="knowledgeSourceDrawerMeta">Sync health and lifecycle controls.</p></div><button class="icon-button" type="button" data-close-knowledge-ops aria-label="Close source drawer">×</button></header>
        <form class="form-panel" id="knowledgeSourceForm">
          <input name="sourceId" type="hidden">
          <div class="source-health" id="knowledgeSourceHealth"></div>
          <div id="knowledgeSourceLiveControls">
            <label>Status<select name="status"><option value="ready">Active</option><option value="paused">Paused</option></select></label>
            <label>Sync schedule<select name="syncIntervalMinutes"><option value="60">Hourly</option><option value="360">Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option><option value="10080">Weekly</option></select></label>
            <div class="connector-fields" id="knowledgeSourceCredentialFields"></div>
            <div class="drawer-form-actions"><button class="button primary" type="submit">Save settings</button><button class="button" id="syncKnowledgeSourceButton" type="button">Sync now</button></div>
          </div>
          <button class="button danger-button" id="deleteKnowledgeSourceButton" type="button">Delete source</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="connectorAlertSettingsDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="connectorAlertSettingsTitle">
        <header><div><p class="workspace-kicker">Connector notifications</p><h2 id="connectorAlertSettingsTitle">Alert settings</h2><p class="muted-copy">Route actionable failures without flooding the team.</p></div><button class="icon-button" type="button" data-close-knowledge-ops aria-label="Close alert settings drawer">×</button></header>
        <form class="form-panel" id="connectorAlertPolicyForm">
          <label class="toggle-field"><input name="emailEnabled" type="checkbox"><span><strong>Email notifications</strong><small>Send new and escalated alerts through the configured mail provider.</small></span></label>
          <label>Minimum email severity<select name="minimumEmailSeverity"><option value="info">Information and above</option><option value="warning">Warning and critical</option><option value="critical">Critical only</option></select></label>
          <fieldset class="checkbox-fieldset"><legend>Workspace recipients</legend><label><input name="notifyRoles" type="checkbox" value="owner"> Owners</label><label><input name="notifyRoles" type="checkbox" value="admin"> Administrators</label></fieldset>
          <label>Additional recipients<textarea name="additionalEmails" rows="3" placeholder="ops@example.co.za, owner@example.co.za"></textarea></label>
          <label>Escalate if unacknowledged<select name="escalationMinutes"><option value="15">After 15 minutes</option><option value="30">After 30 minutes</option><option value="60">After 1 hour</option><option value="240">After 4 hours</option><option value="1440">After 24 hours</option></select></label>
          <div class="import-format-note"><strong>Recovery-aware</strong><span>Alerts resolve automatically when the connector returns within its operating threshold. Acknowledgement records ownership; it does not hide the underlying condition.</span></div>
          <button class="button primary" type="submit">Save alert settings</button>
        </form>
      </section>
    </aside>
    <aside class="drawer-backdrop" id="knowledgeEvalDrawer" aria-hidden="true">
      <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="knowledgeEvalTitle">
        <header><div><p class="workspace-kicker">Retrieval quality</p><h2 id="knowledgeEvalTitle">New evaluation</h2><p class="muted-copy">Define expected and forbidden sources before relying on broader automation.</p></div><button class="icon-button" type="button" data-close-knowledge-ops aria-label="Close knowledge evaluation drawer">×</button></header>
        <form class="form-panel knowledge-eval-form" id="knowledgeEvalForm">
          <label>Name<input name="name" maxlength="180" placeholder="Returns policy answer" required></label>
          <label>Customer question<textarea name="queryText" maxlength="5000" rows="4" required></textarea></label>
          <label>Customer phone<input name="customerPhone" maxlength="30" placeholder="Optional, enables customer-order tests"></label>
          <label>Expected source references<input name="expectedSourceRefs" placeholder="knowledge:12:v2, product:8"></label>
          <label>Required answer terms<input name="requiredTerms" placeholder="14 days, proof of purchase"></label>
          <label>Forbidden source references<input name="forbiddenSourceRefs" placeholder="order:99"></label>
          <label>Candidate answer<textarea name="candidateAnswer" maxlength="10000" rows="4" placeholder="Optional answer for unsupported-claim checks"></textarea></label>
          <button class="button primary" type="submit">Save evaluation</button>
        </form>
      </section>
    </aside>
  </main>`;
}

function renderProductCard(product) {
  return `<article class="product-card" data-product-id="${escapeHtml(product.id)}">
    <div class="product-thumb">${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="">` : '<span>Product</span>'}</div>
    <div>
      <small>#${escapeHtml(product.id)} · ${escapeHtml(product.sku || product.metaProductRetailerId || 'SKU')}</small>
      <h4>${escapeHtml(product.name)}</h4>
      <p>${escapeHtml(product.description || 'Ready to share in WhatsApp.')}</p>
      <p class="muted-copy">Stock ${Number(product.inventoryCount || 0)} · Retailer ${escapeHtml(product.metaProductRetailerId || product.sku || 'not set')}</p>
      <div class="commerce-row-actions"><button class="link-button" data-product-edit="${escapeHtml(product.id)}" type="button">Edit</button><button class="link-button" data-product-archive="${escapeHtml(product.id)}" type="button">Archive</button></div>
    </div>
    <strong>R ${escapeHtml(product.price || (Number(product.priceCents || 0) / 100).toFixed(2))}</strong>
    <span class="status">${escapeHtml(product.status || 'active')}</span>
  </article>`;
}

function orderTable(orders) {
  if (!orders.length) return '<p class="muted-copy">WhatsApp catalogue orders will appear here.</p>';
  return `<table><thead><tr><th>Customer</th><th>Status</th><th>Items</th><th>Total</th><th>Source</th><th>Actions</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.customerName)}<br><small>${escapeHtml(order.customerPhone)}</small></td><td><span class="status">${escapeHtml(order.status)}</span></td><td>${Number(order.itemCount || 0)}</td><td>R ${escapeHtml(order.total || (Number(order.totalCents || 0) / 100).toFixed(2))}${order.discountCode ? `<br><small>${escapeHtml(order.discountCode)} saved R ${escapeHtml(order.discount || '0.00')}</small>` : ''}</td><td>${escapeHtml(order.source)}</td><td><div class="commerce-row-actions"><button class="link-button" data-commerce-order="${escapeHtml(order.id)}" type="button">View</button><button class="link-button" data-commerce-pay="${escapeHtml(order.id)}" type="button">Pay link</button><button class="link-button" data-commerce-status="${escapeHtml(order.id)}" type="button">Update</button><button class="link-button" data-commerce-fulfil="${escapeHtml(order.id)}" type="button">Fulfil</button><button class="link-button" data-commerce-coupon="${escapeHtml(order.id)}" type="button">Coupon</button><button class="link-button" data-commerce-recover="${escapeHtml(order.id)}" type="button">Recover</button><button class="link-button" data-commerce-reconcile="${escapeHtml(order.id)}" type="button">Reconcile</button><button class="link-button" data-commerce-return="${escapeHtml(order.id)}" type="button">Return</button><button class="link-button" data-commerce-post-purchase="${escapeHtml(order.id)}" type="button">Post-sale</button><button class="link-button" data-commerce-schedule-post-purchase="${escapeHtml(order.id)}" type="button">Schedule</button></div></td></tr>`).join('')}</tbody></table>`;
}

function renderInboxListItem(item) {
  const name = item.customerName || item.name || 'WhatsApp customer';
  const preview = item.lastMessagePreview || item.preview || 'No messages yet';
  const unread = Number(item.unreadCount || item.unread || 0);
  return `<button class="inbox-item" data-conversation-id="${escapeHtml(item.id || '')}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(preview)}</span><small>${escapeHtml(item.slaStatus || item.status || 'open')}</small>${unread ? `<em>${unread}</em>` : ''}</button>`;
}

function renderLoginPage({ authenticated = false, socialProviders = [], recaptcha = {} } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in - ${brand.name}</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="auth-body">
  <main class="auth-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card" id="loginForm" data-recaptcha-action="tenant_login">
      <div class="section-label">Secure access</div>
      <h1>Sign in to ${brand.name}</h1>
      <p>Use your workspace account to manage campaigns, contacts, billing, and API settings.</p>
      ${renderSocialAuthButtons({ providers: socialProviders, purpose: 'signin' })}
      <label>Email<input name="email" type="email" autocomplete="email" placeholder="owner@business.co.za" required></label>
      ${renderPasswordField({ name: 'password', autocomplete: 'current-password', placeholder: 'Enter password' })}
      <button class="btn-hero auth-submit" type="submit">Sign in</button>
      <small>New here? <a class="auth-link" href="/signup">Create a workspace</a>.</small>
      <small><a class="auth-link" href="/password-reset">Forgot your password?</a></small>
      ${
        authenticated
          ? '<div class="auth-session-actions"><a class="button primary" href="/dashboard">Continue to dashboard</a><button class="button ghost" type="button" id="logoutBtn">Sign out</button></div>'
          : ''
      }
    </form>
  </main>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderPasswordResetPage({ authenticated = false, recaptcha = {} } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset password - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="auth-body">
  <main class="auth-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card reset-card" id="passwordResetRequestForm" data-recaptcha-action="password_reset">
      <div class="section-label">Account recovery</div>
      <h1>Reset your password</h1>
      <p>Enter your workspace email and we will send a secure reset link.</p>
      <label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.co.za" required></label>
      <button class="button primary" type="submit">Send reset link</button>
      <small id="passwordResetStatus">Check your email for the reset link.</small>
      <small><a class="auth-link" href="/login">Back to sign in</a></small>
      ${
        authenticated
          ? '<div class="auth-session-actions"><a class="button primary" href="/dashboard">Continue to dashboard</a><button class="button ghost" type="button" id="logoutBtn">Sign out</button></div>'
          : ''
      }
    </form>
  </main>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderSignupPage({ authenticated = false, planCode = 'starter', socialProviders = [], recaptcha = {} } = {}) {
  const plans = listPlans().map(publicPlan);
  const selectedPlanCode = plans.some((plan) => plan.code === String(planCode || '').toLowerCase()) ? String(planCode).toLowerCase() : 'starter';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Start free trial - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="auth-body">
  <main class="auth-shell signup-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card signup-card" id="signupForm" data-recaptcha-action="tenant_signup">
      <div class="section-label">Start free trial</div>
      <h1>Create your ${brand.name} workspace</h1>
      <p>Choose a plan, create the owner account, and continue into setup. Trial accounts use the same subscription limits as paid accounts.</p>
      ${renderSocialAuthButtons({ providers: socialProviders, purpose: 'signup', planCode: selectedPlanCode })}
      <label>Business name<input name="businessName" autocomplete="organization" placeholder="Nomsa Fashion Store" required></label>
      <label>Your name<input name="ownerName" autocomplete="name" placeholder="Nomsa Mkhize" required></label>
      <label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.co.za" required></label>
      ${renderPasswordField({ name: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters', minlength: 10 })}
      <label>Plan<select name="planCode">${plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === selectedPlanCode ? 'selected' : ''}>${escapeHtml(plan.name)} - R ${escapeHtml(plan.amount)}/mo</option>`).join('')}</select></label>
      <div class="signup-plan-grid" aria-label="Choose a plan">
        ${plans.map((plan) => `<button class="signup-plan-option ${plan.code === selectedPlanCode ? 'selected' : ''}" type="button" data-plan-code="${escapeHtml(plan.code)}" aria-pressed="${plan.code === selectedPlanCode ? 'true' : 'false'}"><strong>${escapeHtml(plan.name)}</strong><span>${escapeHtml(plan.limits.contacts === null ? 'Unlimited contacts' : `${plan.limits.contacts.toLocaleString('en-ZA')} contacts`)}</span><small>${escapeHtml(plan.campaigns)} campaigns · ${escapeHtml(plan.limits.teamSeats === null ? 'Unlimited seats' : `${plan.limits.teamSeats} seats`)}</small></button>`).join('')}
      </div>
      <button class="btn-hero auth-submit" type="submit">Create workspace</button>
      <small id="signupStatus">No credit card required for the 14-day trial. <a class="auth-link" href="/login">Already have an account?</a></small>
      ${
        authenticated
          ? '<div class="auth-session-actions"><a class="button primary" href="/dashboard">Continue to dashboard</a><button class="button ghost" type="button" id="logoutBtn">Sign out</button></div>'
          : ''
      }
    </form>
  </main>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderSocialSignupCompletionPage({ authenticated = false, verification = null, token = '', recaptcha = {} } = {}) {
  const plans = listPlans().map(publicPlan);
  if (!verification) {
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Complete signup - ${brand.name}</title><link rel="stylesheet" href="/assets/css/app.css"></head>
<body class="auth-body"><main class="auth-shell"><a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a><section class="auth-card"><div class="section-label">Social signup</div><h1>Verification expired</h1><p>Your social verification link is invalid or expired. Start again from the signup page.</p><a class="button primary" href="/signup">Start signup</a></section></main></body></html>`;
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Complete signup - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="auth-body">
  <main class="auth-shell signup-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card signup-card" id="socialSignupCompletionForm" data-recaptcha-action="social_signup_complete">
      <div class="section-label">${escapeHtml(verification.providerName)} verified</div>
      <h1>Complete your workspace</h1>
      <p>We verified ${escapeHtml(verification.email)}. Add the business details needed to create your trial workspace.</p>
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <label>Business name<input name="businessName" autocomplete="organization" placeholder="Nomsa Fashion Store" required></label>
      <label>Your name<input name="ownerName" autocomplete="name" value="${escapeHtml(verification.name)}" required></label>
      <label>Email<input name="email" type="email" value="${escapeHtml(verification.email)}" disabled></label>
      <label>Plan<select name="planCode">${plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === verification.planCode ? 'selected' : ''}>${escapeHtml(plan.name)} - R ${escapeHtml(plan.amount)}/mo</option>`).join('')}</select></label>
      <button class="btn-hero auth-submit" type="submit">Create workspace</button>
      <small id="socialSignupStatus">Your ${escapeHtml(verification.providerName)} account will be linked to this workspace.</small>
      ${
        authenticated
          ? '<div class="auth-session-actions"><a class="button primary" href="/dashboard">Continue to dashboard</a><button class="button ghost" type="button" id="logoutBtn">Sign out</button></div>'
          : ''
      }
    </form>
  </main>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderPlatformLoginPage({ authenticated = false, recaptcha = {} } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brand.name} Platform Sign In</title>
  <link rel="stylesheet" href="/assets/css/app.css">
  ${renderRecaptchaAssets(recaptcha)}
</head>
<body class="auth-body">
  <main class="auth-shell">
    <form class="auth-card" id="platformLoginForm" data-endpoint="/api/platform/auth/login" data-recaptcha-action="platform_login">
      <a class="brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
      <h1>Platform owner</h1>
      <p>Operate tenants, billing health, integrations, queue status, and platform audit evidence.</p>
      <label>Email<input name="email" type="email" autocomplete="email" value="owner@chatclan.co.za" required></label>
      ${renderPasswordField({ name: 'password', autocomplete: 'current-password', placeholder: 'Enter platform password' })}
      <button class="button primary" type="submit">Sign in to platform</button>
      <small id="platformLoginStatus">${authenticated ? 'Already signed in.' : 'Use a dedicated platform owner account, not a tenant account.'}</small>
      ${authenticated ? '<div class="auth-session-actions"><a class="button primary" href="/platform">Continue to platform</a><button class="button ghost" type="button" id="platformLogoutBtn">Sign out</button></div>' : ''}
    </form>
  </main>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderPlatformDashboardPage({ overview, user }) {
  const tenants = overview.tenants || [];
  const vendors = overview.health?.vendors || [];
  const audits = overview.recentAuditEvents || [];
  const guardrails = overview.guardrails || [];
  const incidents = overview.incidents || [];
  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const ai = overview.ai || { providers: [], summary: {}, recentUsage: [] };
  const reliability = overview.reliability || { summary: {}, workers: [], providers: [], stuckJobs: [], deadLetters: [], recoveryEvents: [], resolutionEvents: [] };
  const reliabilityAlerts = reliability.alertCenter || { summary:{},policy:{},alerts:[],platformUsers:[] };
  const leads = overview.leads || [];
  const leadSummary = overview.leadSummary || { total:0, new:0, highPriority:0, demoRequests:0, slaBreached:0, conversionRate:0, averageResponseMinutes:null };
  const platformUsers = overview.platformUsers || [];
  const leadCrm = overview.leadCrm || { configured:false, destination:'' };
  const tenantsNeedingAttention = tenants.filter((tenant) => tenant.health.overall !== 'healthy' || tenant.platform.status !== 'active').length;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brand.name} Platform</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <main class="app platform-app" id="platformApp">
    <aside class="sidebar">
      <a class="brand" href="/platform"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
      <div class="business-card">
        <strong>Platform mode</strong>
        <small>Owner controls are isolated from tenant workspaces.</small>
      </div>
      <div class="nav-group">
        <small>Operate</small>
        <button class="nav-item active" data-page="platform-overview" data-title="Overview" type="button">⌂ <span>Overview</span></button>
        <button class="nav-item" data-page="platform-tenants" data-title="Tenants" type="button">▣ <span>Tenants</span>${tenantsNeedingAttention ? `<em>${tenantsNeedingAttention}</em>` : ''}</button>
        <button class="nav-item" data-page="platform-leads" data-title="Leads" type="button">◎ <span>Leads</span>${leadSummary.new ? `<em>${escapeHtml(leadSummary.new)}</em>` : ''}</button>
        <button class="nav-item" data-page="platform-operations" data-title="Operations" type="button">◌ <span>Operations</span></button>
        <button class="nav-item" id="platformReliabilityNav" data-page="platform-reliability" data-title="Reliability" type="button">△ <span>Reliability</span>${Number(reliability.summary.deadLetters||0)+Number(reliability.summary.stuckJobs||0)+Number(reliabilityAlerts.summary.open||0) ? `<em>${Number(reliability.summary.deadLetters||0)+Number(reliability.summary.stuckJobs||0)+Number(reliabilityAlerts.summary.open||0)}</em>` : ''}</button>
        <button class="nav-item" data-page="platform-incidents" data-title="Incidents" type="button">! <span>Incidents</span>${activeIncidents.length ? `<em>${activeIncidents.length}</em>` : ''}</button>
        <button class="nav-item" data-page="platform-ai" data-title="AI Control" type="button">◇ <span>AI Control</span></button>
        <button class="nav-item" data-page="platform-audit" data-title="Audit" type="button">□ <span>Audit</span></button>
      </div>
    </aside>
    <button class="sidebar-scrim" type="button" data-mobile-nav-close aria-label="Close navigation"></button>
    <section class="workspace">
      <header class="topbar">
        <div class="topbar-heading">
          <button class="mobile-nav-toggle" type="button" data-mobile-nav-toggle aria-label="Open navigation" title="Open navigation">☰</button>
          <div><p class="eyebrow">Platform control plane</p><h1 id="pageTitle">Overview</h1></div>
        </div>
        <div class="topbar-actions">
          <span class="status">${escapeHtml(user?.name || 'Platform user')}</span>
          <button class="button ghost" type="button" id="platformLogoutBtn">Sign out</button>
        </div>
      </header>
      <section class="page active" id="page-platform-overview">
        <div class="metric-grid">
          <article class="metric"><small>Tenants</small><strong>${escapeHtml(overview.summary.tenants)}</strong><span>${escapeHtml(overview.summary.activeTenants)} active/watch</span></article>
          <article class="metric"><small>MRR</small><strong>${escapeHtml(overview.summary.mrrLabel)}</strong><span>${escapeHtml(overview.summary.pastDueSubscriptions)} billing risk</span></article>
          <article class="metric"><small>Meta connected</small><strong>${escapeHtml(overview.summary.metaConnected)}</strong><span>WABA + phone assets</span></article>
          <article class="metric"><small>Queue</small><strong>${escapeHtml(overview.health.queue.status)}</strong><span>${escapeHtml(overview.health.queue.failed)} failed jobs</span></article>
        </div>
        <div class="suite-hero platform-command-hero">
          <div>
            <p class="workspace-kicker">Command center</p>
            <h1>Keep South African businesses live, compliant, and ready to sell on WhatsApp.</h1>
            <p class="muted-copy">Start with tenant health, then open a drawer only when you need to intervene, document a support touch, or change operational status.</p>
          </div>
          <div class="hero-command-panel">
            <strong>${tenantsNeedingAttention} tenants need attention</strong>
            <span>${escapeHtml(overview.summary.pastDueSubscriptions)} billing risks · ${escapeHtml(overview.health.queue.failed)} failed jobs</span>
            <button class="button primary" data-page-link="platform-tenants" type="button">Review tenants</button>
          </div>
        </div>
        <div class="two-col platform-grid">
          <article class="panel">
            <header>
              <div>
                <h3>Tenant Health</h3>
                <p class="muted-copy">Clean scan view. Open a tenant drawer for status changes and notes.</p>
              </div>
              <button class="link-button" data-page-link="platform-tenants" type="button">Open tenant list</button>
            </header>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Tenant</th><th>Owner</th><th>Billing</th><th>Meta</th><th>Platform</th><th></th></tr></thead>
                <tbody>${tenants.map(renderPlatformTenantRow).join('')}</tbody>
              </table>
            </div>
          </article>
          <article class="panel">
            <h3>Vendor & Dependency Health</h3>
            <div class="setup-steps compact">${vendors.map(renderVendorHealth).join('')}</div>
            <h3>Recent Platform Audit</h3>
            <div class="request-list">${audits.length ? audits.map(renderAuditEvent).join('') : '<p class="muted-copy">No platform audit events yet.</p>'}</div>
          </article>
        </div>
      </section>
      <section class="page" id="page-platform-tenants">
        <div class="page-heading">
          <div>
            <h1>Tenants</h1>
            <p class="muted-copy">Manage customer workspaces without crowding the table with operational forms.</p>
          </div>
          <span class="status">${tenants.length} workspaces</span>
        </div>
        <article class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tenant</th><th>Owner</th><th>Billing</th><th>Meta</th><th>Platform</th><th></th></tr></thead>
              <tbody>${tenants.map(renderPlatformTenantRow).join('')}</tbody>
            </table>
          </div>
        </article>
      </section>
      <section class="page" id="page-platform-leads">
        <div class="page-heading">
          <div><h1>Leads</h1><p class="muted-copy">Manage consented sales and demo enquiries without mixing prospects into tenant workspaces.</p></div>
          <div class="panel-header-actions"><span class="status" id="platformLeadNewBadge">${escapeHtml(leadSummary.new)} new</span><button class="button ghost" id="openCrmConfiguration" type="button">Configure CRM</button><a class="button ghost" href="/api/platform/leads/export.csv">Export CSV</a></div>
        </div>
        <div class="lead-summary-strip">
          <article><small>Total</small><strong data-lead-summary="total">${escapeHtml(leadSummary.total)}</strong></article>
          <article><small>New</small><strong data-lead-summary="new">${escapeHtml(leadSummary.new)}</strong></article>
          <article><small>High priority</small><strong data-lead-summary="highPriority">${escapeHtml(leadSummary.highPriority)}</strong></article>
          <article><small>SLA breached</small><strong data-lead-summary="slaBreached">${escapeHtml(leadSummary.slaBreached)}</strong></article>
          <article><small>Conversion</small><strong data-lead-summary="conversionRate">${escapeHtml(leadSummary.conversionRate)}%</strong></article>
          <article><small>Avg. response</small><strong data-lead-summary="averageResponseMinutes">${leadSummary.averageResponseMinutes === null ? '-' : `${escapeHtml(leadSummary.averageResponseMinutes)}m`}</strong></article>
        </div>
        <article class="panel">
          <header><div><h3>Conversion queue</h3><p class="muted-copy">Response targets are configurable. Contact permission and marketing consent remain separate.</p></div><span class="status ${leadCrm.configured ? '' : 'warn'}">CRM ${leadCrm.configured ? `connected · ${escapeHtml(leadCrm.destination)}` : 'not configured'}</span></header>
          <div class="table-wrap"><table><thead><tr><th>Prospect</th><th>Request</th><th>Route</th><th>SLA</th><th>Status</th><th></th></tr></thead><tbody id="platformLeadRows">${renderPlatformLeadRows(leads)}</tbody></table></div>
        </article>
      </section>
      <section class="page" id="page-platform-operations">
        <div class="page-heading">
          <div>
            <h1>Operations</h1>
            <p class="muted-copy">Dependency, queue, and integration health for support and release decisions.</p>
          </div>
          <span class="status">${escapeHtml(overview.health.queue.status)}</span>
        </div>
        <div class="two-col">
          <article class="panel"><header><div><h3>Platform Guardrails</h3><p class="muted-copy">Emergency controls with an accountable incident trail.</p></div><button class="link-button" data-open-incident-create type="button">Declare incident</button></header><div class="guardrail-list">${guardrails.map(renderPlatformGuardrail).join('')}</div></article>
          <article class="panel"><h3>Queue Health</h3><div class="ops-summary-list"><article><strong>${escapeHtml(overview.health.queue.status)}</strong><span>Status</span></article><article><strong>${escapeHtml(overview.health.queue.pending)}</strong><span>Pending</span></article><article><strong>${escapeHtml(overview.health.queue.failed)}</strong><span>Failed</span></article></div></article>
        </div>
        <article class="panel"><h3>Vendor & Dependency Health</h3><div class="setup-steps compact">${vendors.map(renderVendorHealth).join('')}</div></article>
      </section>
      <section class="page" id="page-platform-incidents">
        <div class="page-heading">
          <div>
            <h1>Incidents</h1>
            <p class="muted-copy">Coordinate customer impact, operational controls, ownership, and resolution evidence.</p>
          </div>
          <button class="button primary" data-open-incident-create type="button">Declare incident</button>
        </div>
        <div class="incident-summary-strip">
          <article><small>Active</small><strong>${activeIncidents.length}</strong></article>
          <article><small>Critical</small><strong>${activeIncidents.filter((incident) => incident.severity === 'sev1').length}</strong></article>
          <article><small>Monitoring</small><strong>${activeIncidents.filter((incident) => incident.status === 'monitoring').length}</strong></article>
        </div>
        <article class="panel incident-register">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Owner</th><th>Started</th><th></th></tr></thead>
              <tbody>${incidents.length ? incidents.map(renderPlatformIncidentRow).join('') : '<tr><td colspan="6"><p class="muted-copy">No incidents recorded. The platform is operating without an active incident.</p></td></tr>'}</tbody>
            </table>
          </div>
        </article>
      </section>
      <section class="page" id="page-platform-reliability">
        <div class="page-heading">
          <div><h1>Reliability</h1><p class="muted-copy">Cross-tenant connector health, worker liveness, queue recovery, and provider incident signals.</p></div>
          <div class="page-heading-actions"><button class="button ghost" id="platformAlertPolicyButton" type="button">Alert settings</button><button class="button ghost" id="platformReliabilityRefresh" type="button">Refresh</button></div>
        </div>
        <div class="incident-summary-strip reliability-summary" id="reliabilitySummary">
          ${renderReliabilitySummary(reliability)}
        </div>
        <nav class="intelligence-subnav reliability-subnav" aria-label="Reliability views">
          <button class="active" type="button" data-reliability-view="overview">Overview</button>
          <button type="button" data-reliability-view="workers">Workers</button>
          <button type="button" data-reliability-view="providers">Providers</button>
          <button type="button" data-reliability-view="dead-letters">Dead letters</button>
          <button id="reliabilityAlertsTab" type="button" data-reliability-view="alerts">Alerts${reliabilityAlerts.summary.open ? ` (${escapeHtml(reliabilityAlerts.summary.open)})` : ''}</button>
        </nav>
        <section class="reliability-view active" data-reliability-panel="overview">
          <div class="two-col platform-grid">
            <article class="panel"><header><div><h3>Provider signals</h3><p class="muted-copy">Correlated across workspaces over the last 24 hours.</p></div></header><div class="reliability-provider-list" id="reliabilityProviderList">${reliability.providers.map(renderReliabilityProviderCard).join('')}</div></article>
            <article class="panel"><h3>Queue exceptions</h3><div class="ops-summary-list"><article><strong>${escapeHtml(reliability.summary.stuckJobs || 0)}</strong><span>Stuck</span></article><article><strong>${escapeHtml(reliability.summary.deadLetters || 0)}</strong><span>Dead letters</span></article><article><strong>${escapeHtml(reliability.summary.openConnectorAlerts || 0)}</strong><span>Alerts</span></article></div><p class="muted-copy reliability-guidance">Retries create a new linked job. The original failure remains unchanged for investigation and audit.</p></article>
          </div>
        </section>
        <section class="reliability-view" data-reliability-panel="workers">
          <article class="panel"><div class="table-wrap"><table><thead><tr><th>Worker</th><th>State</th><th>Last seen</th><th>Processed</th><th>Current job</th></tr></thead><tbody id="reliabilityWorkerRows">${renderReliabilityWorkerRows(reliability.workers)}</tbody></table></div></article>
        </section>
        <section class="reliability-view" data-reliability-panel="providers">
          <article class="panel"><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Sources</th><th>24h success</th><th>Affected tenants</th><th>Alerts</th><th></th></tr></thead><tbody id="reliabilityProviderRows">${renderReliabilityProviderRows(reliability.providers)}</tbody></table></div></article>
        </section>
        <section class="reliability-view" data-reliability-panel="dead-letters">
          <div class="two-col platform-grid">
            <article class="panel"><header><div><h3>Dead-letter queue</h3><p class="muted-copy">Jobs that exhausted their automatic attempts.</p></div></header><div class="table-wrap"><table><thead><tr><th>Job</th><th>Attempts</th><th>Failure</th><th></th></tr></thead><tbody id="reliabilityDeadLetterRows">${renderDeadLetterRows(reliability.deadLetters)}</tbody></table></div></article>
            <article class="panel"><h3>Queue action history</h3><div class="request-list" id="reliabilityRecoveryEvents">${renderRecoveryEvents(reliability.recoveryEvents, reliability.resolutionEvents)}</div></article>
          </div>
        </section>
        <section class="reliability-view" data-reliability-panel="alerts">
          <div class="incident-summary-strip alert-summary-strip" id="platformAlertSummary">${renderPlatformAlertSummary(reliabilityAlerts)}</div>
          <article class="panel"><header><div><h3>Platform alert center</h3><p class="muted-copy">In-app ownership, escalation, delivery evidence, and incident coordination.</p></div><button class="link-button" id="evaluatePlatformAlerts" type="button">Evaluate now</button></header><div class="platform-alert-list" id="platformAlertList">${renderPlatformAlertList(reliabilityAlerts.alerts)}</div></article>
        </section>
      </section>
      <section class="page" id="page-platform-ai">
        <div class="page-heading"><div><h1>AI Control</h1><p class="muted-copy">Provider infrastructure, tenant autonomy, fallback readiness, budgets, and usage evidence.</p></div><span class="status">${escapeHtml(ai.summary.configuredProviders || 0)} configured</span></div>
        <div class="incident-summary-strip ai-summary-strip">
          <article><small>Configured providers</small><strong>${escapeHtml(ai.summary.configuredProviders || 0)}</strong></article>
          <article><small>Successful requests</small><strong>${escapeHtml(ai.summary.successfulRequests || 0)}</strong></article>
          <article><small>Failed requests</small><strong>${escapeHtml(ai.summary.failedRequests || 0)}</strong></article>
          <article><small>Tokens processed</small><strong>${escapeHtml((ai.summary.inputTokens || 0) + (ai.summary.outputTokens || 0))}</strong></article>
        </div>
        <article class="panel"><header><div><h3>Provider Infrastructure</h3><p class="muted-copy">Keys stay encrypted and are never returned to the browser after saving.</p></div></header><div class="ai-provider-list">${ai.providers.map(renderAiProviderCard).join('')}</div></article>
        <div class="two-col platform-grid">
          <article class="panel"><header><div><h3>Tenant AI Policies</h3><p class="muted-copy">Open a workspace policy only when autonomy or limits need attention.</p></div><button class="link-button" data-page-link="platform-tenants" type="button">Choose tenant</button></header><p class="muted-copy">Tenant policies define provider order, budgets, response limits, and whether AI assists, drafts, or replies automatically.</p></article>
          <article class="panel"><h3>Recent AI Usage</h3><div class="request-list">${ai.recentUsage.length ? ai.recentUsage.map(renderAiUsage).join('') : '<p class="muted-copy">No AI requests have been recorded yet.</p>'}</div></article>
        </div>
      </section>
      <section class="page" id="page-platform-audit">
        <div class="page-heading">
          <div>
            <h1>Audit</h1>
            <p class="muted-copy">Recent platform-owner actions for accountability and support handover.</p>
          </div>
          <span class="status">${audits.length} recent</span>
        </div>
        <article class="panel"><div class="request-list">${audits.length ? audits.map(renderAuditEvent).join('') : '<p class="muted-copy">No platform audit events yet.</p>'}</div></article>
      </section>
    </section>
  </main>
  <aside class="drawer-backdrop" id="platformTenantDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="platformTenantDrawerTitle">
      <header>
        <div>
          <p class="workspace-kicker">Tenant command</p>
          <h2 id="platformTenantDrawerTitle">Tenant details</h2>
          <p class="muted-copy" id="platformTenantDrawerMeta">Select a tenant to manage status and support notes.</p>
        </div>
        <button class="icon-button" type="button" data-close-platform-drawer aria-label="Close tenant drawer">×</button>
      </header>
      <div class="drawer-summary-grid">
        <article><small>Billing</small><strong id="platformTenantBilling">-</strong></article>
        <article><small>Meta</small><strong id="platformTenantMeta">-</strong></article>
        <article><small>Health</small><strong id="platformTenantHealth">-</strong></article>
      </div>
      <form class="panel form-panel platform-tenant-action" id="platformTenantStatusForm">
        <input name="tenantId" type="hidden">
        <h3>Operational status</h3>
        <p class="muted-copy">Use watchlist before suspension when the tenant needs monitoring but should keep operating.</p>
        <label>Status<select name="status" aria-label="Tenant status">
          ${['active', 'watchlist', 'suspended'].map((status) => `<option value="${status}">${status}</option>`).join('')}
        </select></label>
        <label>Reason<input name="reason" placeholder="Short support-safe reason" required></label>
        <button class="button primary" type="submit">Save status</button>
      </form>
      <form class="panel form-panel platform-tenant-note" id="platformTenantNoteForm">
        <input name="tenantId" type="hidden">
        <h3>Internal support note</h3>
        <label>Note<textarea name="note" placeholder="Add context for the next platform operator" required></textarea></label>
        <button class="button" type="submit">Add note</button>
      </form>
      <button class="button ghost" id="platformTenantAiPolicyButton" type="button">Configure AI policy</button>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="platformIncidentCreateDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="incidentCreateTitle">
      <header><div><p class="workspace-kicker">Operations</p><h2 id="incidentCreateTitle">Declare incident</h2><p class="muted-copy">Open a clear record before coordinating emergency controls.</p></div><button class="icon-button" type="button" data-close-incident-drawer aria-label="Close incident drawer">×</button></header>
      <form class="panel form-panel incident-form" id="platformIncidentCreateForm">
        <label>Title<input name="title" maxlength="180" placeholder="Short, customer-safe incident title" required></label>
        <div class="form-grid-two">
          <label>Severity<select name="severity"><option value="sev1">SEV1 · Critical</option><option value="sev2">SEV2 · Major</option><option value="sev3" selected>SEV3 · Degraded</option><option value="sev4">SEV4 · Minor</option></select></label>
          <label>Linked guardrail<select name="linkedGuardrailKey"><option value="">None</option>${guardrails.map((guardrail) => `<option value="${escapeHtml(guardrail.key)}">${escapeHtml(guardrail.label)}</option>`).join('')}</select></label>
        </div>
        <label>Connector provider<select name="providerKey"><option value="">Platform-wide or other</option><option value="shopify">Shopify</option><option value="woocommerce">WooCommerce</option><option value="google_drive">Google Drive</option></select></label>
        <label>What happened<textarea name="summary" placeholder="Known facts, affected services, and current response" required></textarea></label>
        <label>Customer impact<textarea name="customerImpact" placeholder="Who is affected and what they cannot do" required></textarea></label>
        <button class="button primary" type="submit">Open incident</button>
      </form>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="platformLeadDrawer" aria-hidden="true">
    <section class="side-drawer lead-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="platformLeadDrawerTitle">
      <header><div><p class="workspace-kicker" id="platformLeadDrawerReference">Lead</p><h2 id="platformLeadDrawerTitle">Lead details</h2><p class="muted-copy" id="platformLeadDrawerMeta"></p></div><button class="icon-button" type="button" data-close-lead-drawer aria-label="Close lead drawer">×</button></header>
      <div class="drawer-summary-grid"><article><small>SLA</small><strong id="platformLeadDrawerSla">-</strong></article><article><small>Response due</small><strong id="platformLeadDrawerDue">-</strong></article><article><small>CRM delivery</small><strong id="platformLeadDrawerCrm">-</strong></article></div>
      <article class="panel lead-contact-card" id="platformLeadContactCard"></article>
      <form class="panel form-panel incident-form" id="platformLeadUpdateForm">
        <input name="leadId" type="hidden">
        <div class="form-grid-two"><label>Status<select name="status"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="disqualified">Disqualified</option></select></label><label>Owner<select name="ownerPlatformUserId"><option value="">Unassigned</option>${platformUsers.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)} · ${escapeHtml(member.role)}</option>`).join('')}</select></label></div>
        <label>Next follow-up<input name="nextFollowUpAt" type="datetime-local"></label>
        <label>Disqualification reason<textarea name="disqualificationReason" maxlength="500" placeholder="Required when disqualifying"></textarea></label>
        <div class="drawer-form-actions"><button class="button primary" type="submit">Save lead</button><button class="button ghost" id="platformLeadCrmRetry" type="button" ${leadCrm.configured ? '' : 'disabled'}>Send to CRM</button></div>
      </form>
      <form class="panel form-panel incident-form" id="platformLeadNoteForm"><input name="leadId" type="hidden"><h3>Add activity</h3><label>Note<textarea name="note" maxlength="2000" placeholder="Call outcome, qualification context, or handover note" required></textarea></label><button class="button" type="submit">Add note</button></form>
      <section class="incident-timeline" id="platformLeadTimeline"><p class="muted-copy">Lead activity will appear here.</p></section>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="crmConfigurationDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="crmConfigurationTitle">
      <header><div><p class="workspace-kicker">Sales infrastructure</p><h2 id="crmConfigurationTitle">CRM configuration</h2><p class="muted-copy">Connect one governed lead destination. Saved secrets are encrypted and only their masked form is returned.</p></div><button class="icon-button" type="button" data-close-crm-drawer aria-label="Close CRM configuration">×</button></header>
      <form class="panel form-panel incident-form" id="crmConfigurationForm">
        <label class="toggle-row"><input name="enabled" type="checkbox"><span>CRM delivery enabled</span></label>
        <label>Provider<select name="providerKey"><option value="hubspot">HubSpot</option><option value="webhook">Signed webhook</option></select></label>
        <section data-crm-provider="hubspot"><label>Service key<input name="accessToken" type="password" autocomplete="new-password" placeholder="Leave blank to keep the encrypted key"></label><p class="muted-copy" id="crmTokenStatus">No key saved</p><label>HubSpot destination<select name="hubspotDeliveryMode"><option value="contacts_only">Contacts only (recommended)</option><option value="contacts_and_leads">Contacts + Leads</option></select></label><p class="muted-copy">Use Contacts + Leads only when the Leads object is enabled for this HubSpot account.</p></section>
        <section data-crm-provider="webhook" hidden><label>Webhook URL<input name="webhookUrl" type="url" placeholder="https://crm.example.com/chatclan-leads"></label><label>Signing secret<input name="webhookSecret" type="password" autocomplete="new-password" placeholder="Leave blank to keep the encrypted secret"></label></section>
        <label>Timeout (milliseconds)<input name="timeoutMs" type="number" min="1000" max="30000" step="1000" value="10000" required></label>
        <div class="drawer-form-actions"><button class="button primary" type="submit">Save CRM</button><button class="button" id="testCrmConnection" type="button">Test connection</button></div>
        <small class="muted-copy" id="crmHealthStatus">Save and enable HubSpot before testing.</small>
      </form>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="platformIncidentDetailDrawer" aria-hidden="true">
    <section class="side-drawer incident-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="incidentDetailTitle">
      <header><div><p class="workspace-kicker" id="incidentDetailSeverity">Incident</p><h2 id="incidentDetailTitle">Incident details</h2><p class="muted-copy" id="incidentDetailImpact"></p></div><button class="icon-button" type="button" data-close-incident-drawer aria-label="Close incident drawer">×</button></header>
      <form class="panel form-panel incident-form" id="platformIncidentUpdateForm">
        <input name="incidentId" type="hidden">
        <div class="form-grid-two"><label>Status<select name="status"><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select></label><label>Severity<select name="severity"><option value="sev1">SEV1</option><option value="sev2">SEV2</option><option value="sev3">SEV3</option><option value="sev4">SEV4</option></select></label></div>
        <label>Linked guardrail<select name="linkedGuardrailKey"><option value="">None</option>${guardrails.map((guardrail) => `<option value="${escapeHtml(guardrail.key)}">${escapeHtml(guardrail.label)}</option>`).join('')}</select></label>
        <label>Connector provider<select name="providerKey"><option value="">Platform-wide or other</option><option value="shopify">Shopify</option><option value="woocommerce">WooCommerce</option><option value="google_drive">Google Drive</option></select></label>
        <label>Resolution evidence<textarea name="resolutionNote" placeholder="Required before marking resolved"></textarea></label>
        <button class="button primary" type="submit">Save incident</button>
      </form>
      <form class="panel form-panel incident-form" id="platformIncidentEventForm"><input name="incidentId" type="hidden"><h3>Add timeline update</h3><label>Update<textarea name="note" placeholder="Action taken, evidence observed, or handover context" required></textarea></label><button class="button" type="submit">Add update</button></form>
      <section class="incident-timeline" id="incidentTimeline"><p class="muted-copy">Timeline updates will appear here.</p></section>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="deadLetterRetryDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="deadLetterRetryTitle">
      <header><div><p class="workspace-kicker">Queue resolution</p><h2 id="deadLetterRetryTitle">Resolve dead-letter job</h2><p class="muted-copy" id="deadLetterRetryMeta">Retry recoverable work or discard an invalid job while preserving its evidence.</p></div><button class="icon-button" type="button" data-close-retry-drawer aria-label="Close retry drawer">×</button></header>
      <form class="panel form-panel incident-form" id="deadLetterRetryForm">
        <input name="jobId" type="hidden">
        <label>Stored payload<pre class="job-payload" id="deadLetterPayload">{}</pre></label>
        <label>Operator reason<textarea name="reason" maxlength="500" placeholder="What was corrected, or why this job is invalid and should not run" required></textarea></label>
        <div class="drawer-form-actions"><button class="button primary" name="action" value="retry" type="submit">Queue linked retry</button><button class="button danger-button" name="action" value="discard" type="submit">Discard invalid job</button></div>
      </form>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="platformAlertPolicyDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="platformAlertPolicyTitle">
      <header><div><p class="workspace-kicker">Reliability routing</p><h2 id="platformAlertPolicyTitle">Alert settings</h2><p class="muted-copy">Choose who receives platform alerts and when unresolved signals escalate.</p></div><button class="icon-button" type="button" data-close-platform-alert-drawer aria-label="Close alert settings">×</button></header>
      <form class="panel form-panel incident-form" id="platformAlertPolicyForm">
        <label class="toggle-row ai-enable-toggle"><input name="emailEnabled" type="checkbox" ${reliabilityAlerts.policy.emailEnabled ? 'checked' : ''}><span>Email notifications enabled</span></label>
        <label class="toggle-row ai-enable-toggle"><input name="inAppEnabled" type="checkbox" ${reliabilityAlerts.policy.inAppEnabled !== false ? 'checked' : ''}><span>In-app notifications enabled</span></label>
        <label>Minimum email severity<select name="minimumEmailSeverity">${['info','warning','critical'].map((severity)=>`<option value="${severity}" ${severity===(reliabilityAlerts.policy.minimumEmailSeverity||'warning')?'selected':''}>${severity}</option>`).join('')}</select></label>
        <label>Notify platform roles<input name="notifyRoles" value="${escapeHtml((reliabilityAlerts.policy.notifyRoles||['owner']).join(', '))}" placeholder="owner, operator"></label>
        <label>On-call owner<select name="onCallPlatformUserId"><option value="">Role routing only</option>${(reliabilityAlerts.platformUsers||[]).map((user)=>`<option value="${escapeHtml(user.id)}" ${Number(user.id)===Number(reliabilityAlerts.policy.onCallPlatformUserId)?'selected':''}>${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`).join('')}</select></label>
        <label>Additional email recipients<input name="additionalEmails" value="${escapeHtml((reliabilityAlerts.policy.additionalEmails||[]).join(', '))}" placeholder="ops@example.com"></label>
        <div class="form-grid-two"><label>Escalate after (minutes)<input name="escalationMinutes" type="number" min="15" max="1440" value="${escapeHtml(reliabilityAlerts.policy.escalationMinutes||30)}"></label><label>Repeat every (minutes)<input name="repeatMinutes" type="number" min="15" max="10080" value="${escapeHtml(reliabilityAlerts.policy.repeatMinutes||60)}"></label></div>
        <button class="button primary" type="submit">Save alert settings</button>
      </form>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="platformAlertDetailDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="platformAlertDetailTitle">
      <header><div><p class="workspace-kicker" id="platformAlertDetailSeverity">Reliability alert</p><h2 id="platformAlertDetailTitle">Alert details</h2><p class="muted-copy" id="platformAlertDetailText"></p></div><button class="icon-button" type="button" data-close-platform-alert-drawer aria-label="Close alert details">×</button></header>
      <div class="drawer-summary-grid"><article><small>Status</small><strong id="platformAlertDetailStatus">-</strong></article><article><small>Owner</small><strong id="platformAlertDetailOwner">-</strong></article><article><small>Notifications</small><strong id="platformAlertDetailNotifications">0</strong></article></div>
      <form class="panel form-panel incident-form" id="platformAlertActionForm"><input name="alertId" type="hidden"><label>Operational owner<select name="ownerPlatformUserId">${(reliabilityAlerts.platformUsers||[]).map((user)=>`<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`).join('')}</select></label><button class="button primary" name="action" value="acknowledge" type="submit">Acknowledge and take ownership</button><button class="button ghost" name="action" value="assign" type="submit">Update assignment</button></form>
      <form class="panel form-panel incident-form" id="platformAlertIncidentForm"><input name="alertId" type="hidden"><h3>Incident coordination</h3><label>Link active incident<select name="incidentId"><option value="">Select incident</option>${activeIncidents.map((incident)=>`<option value="${escapeHtml(incident.id)}">#${escapeHtml(incident.id)} · ${escapeHtml(incident.title)}</option>`).join('')}</select></label><button class="button" type="submit">Link incident</button></form>
      <section class="incident-timeline" id="platformAlertTimeline"><p class="muted-copy">Alert events will appear here.</p></section>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="aiProviderDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="aiProviderDrawerTitle">
      <header><div><p class="workspace-kicker">AI infrastructure</p><h2 id="aiProviderDrawerTitle">Provider configuration</h2><p class="muted-copy" id="aiProviderDrawerMeta"></p></div><button class="icon-button" type="button" data-close-ai-drawer aria-label="Close AI provider drawer">×</button></header>
      <form class="panel form-panel incident-form" id="aiProviderForm">
        <input name="providerKey" type="hidden">
        <label class="toggle-row ai-enable-toggle"><input name="enabled" type="checkbox"><span>Provider enabled</span></label>
        <label>API key<input name="apiKey" type="password" autocomplete="new-password" placeholder="Leave blank to keep the current encrypted key"></label>
        <label>Base URL<input name="baseUrl" type="url" placeholder="Provider API base URL" required></label>
        <label>Default model<input name="defaultModel" placeholder="Model identifier" required></label>
        <label>Timeout (milliseconds)<input name="timeoutMs" type="number" min="1000" max="120000" step="1000" required></label>
        <div class="drawer-form-actions"><button class="button primary" type="submit">Save provider</button><button class="button" id="aiProviderHealthButton" type="button">Test live connection</button></div>
        <small class="muted-copy" id="aiProviderHealthStatus">Save and enable the provider before testing.</small>
      </form>
    </section>
  </aside>
  <aside class="drawer-backdrop" id="tenantAiPolicyDrawer" aria-hidden="true">
    <section class="side-drawer" role="dialog" aria-modal="true" aria-labelledby="tenantAiPolicyTitle">
      <header><div><p class="workspace-kicker">Tenant governance</p><h2 id="tenantAiPolicyTitle">AI policy</h2><p class="muted-copy">Control autonomy and spend without exposing provider credentials.</p></div><button class="icon-button" type="button" data-close-ai-drawer aria-label="Close tenant AI policy drawer">×</button></header>
      <form class="panel form-panel incident-form" id="tenantAiPolicyForm">
        <input name="businessId" type="hidden">
        <label class="toggle-row ai-enable-toggle"><input name="enabled" type="checkbox"><span>AI enabled for tenant</span></label>
        <label>Autonomy<select name="autonomyMode"><option value="assist">Assist only</option><option value="draft">Draft for human approval</option><option value="auto_reply">Automatic replies</option></select></label>
        <label>Provider fallback order<input name="providerChain" placeholder="openai, google, anthropic"></label>
        <div class="form-grid-two"><label>Monthly budget (cents)<input name="monthlyBudgetCents" type="number" min="0" value="0"></label><label>Monthly token limit<input name="monthlyTokenLimit" type="number" min="0" value="0"></label></div>
        <label>Maximum response tokens<input name="maxResponseTokens" type="number" min="64" max="32000" value="800"></label>
        <label class="toggle-row ai-enable-toggle"><input name="humanHandoffEnabled" type="checkbox" checked><span>Human handoff available</span></label>
        <button class="button primary" type="submit">Save tenant policy</button>
      </form>
    </section>
  </aside>
  <div class="toast" id="toast"></div>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

function renderReliabilitySummary(reliability) {
  const summary = reliability.summary || {};
  return `<article><small>Workers healthy</small><strong>${escapeHtml(summary.healthyWorkers || 0)}/${escapeHtml(summary.workers || 0)}</strong></article>
    <article><small>Queue exceptions</small><strong>${escapeHtml(Number(summary.stuckJobs || 0) + Number(summary.deadLetters || 0))}</strong></article>
    <article><small>Connector alerts</small><strong>${escapeHtml(summary.openConnectorAlerts || 0)}</strong></article>
    <article><small>Incident signals</small><strong>${escapeHtml(summary.correlatedProviders || 0)}</strong></article>`;
}

function renderPlatformAlertSummary(center) {
  const summary=center.summary||{};
  return `<article><small>Open</small><strong>${escapeHtml(summary.open||0)}</strong></article><article><small>Acknowledged</small><strong>${escapeHtml(summary.acknowledged||0)}</strong></article><article><small>Critical</small><strong>${escapeHtml(summary.critical||0)}</strong></article><article><small>Escalated</small><strong>${escapeHtml(summary.escalated||0)}</strong></article>`;
}

function renderPlatformAlertList(alerts) {
  return alerts.length ? alerts.map((alert)=>`<article class="platform-alert-row ${escapeHtml(alert.severity)}"><div><span class="status ${alert.severity==='critical'?'warn':''}">${escapeHtml(alert.severity)}</span><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.detail)}</p><small>${escapeHtml(alert.ownerEmail||alert.ownerName||'Unassigned')} · ${escapeHtml(alert.lastDetectedAt||'')}</small></div><div><span class="status">${escapeHtml(alert.status)}</span><button class="button ghost platform-alert-manage" type="button" data-alert="${escapeHtml(JSON.stringify(alert))}">Manage</button></div></article>`).join('') : '<p class="muted-copy">No reliability alerts. Worker, queue, and provider signals are within their configured thresholds.</p>';
}

function renderReliabilityProviderCard(provider) {
  return `<article class="reliability-provider-card">
    <div><span class="status ${provider.health === 'healthy' ? '' : 'warn'}">${escapeHtml(provider.health)}</span><h4>${escapeHtml(provider.label)}</h4><small>${escapeHtml(provider.sources)} sources · ${escapeHtml(provider.affectedTenants)} affected tenants</small></div>
    <strong>${provider.successRate === null ? 'No runs' : `${escapeHtml(provider.successRate)}% success`}</strong>
    ${provider.activeIncident ? `<small>Incident #${escapeHtml(provider.activeIncident.id)} active</small>` : provider.incidentCandidate ? `<button class="link-button provider-incident-declare" type="button" data-provider="${escapeHtml(provider.key)}" data-provider-label="${escapeHtml(provider.label)}" data-affected-tenants="${escapeHtml(provider.affectedTenants)}" data-failed-runs="${escapeHtml(provider.failedRuns)}">Declare incident</button>` : '<small>No correlated incident signal</small>'}
  </article>`;
}

function renderReliabilityWorkerRows(workers) {
  return workers.length ? workers.map((worker) => `<tr><td><strong>${escapeHtml(worker.workerId)}</strong><small>${escapeHtml(worker.role)} · ${escapeHtml(worker.version)}</small></td><td><span class="status ${worker.health === 'healthy' ? '' : 'warn'}">${escapeHtml(worker.health)}</span><small>${escapeHtml(worker.status)}</small></td><td>${escapeHtml(worker.secondsSinceSeen)}s ago</td><td>${escapeHtml(worker.jobsProcessed)}</td><td>${worker.currentJobId ? `#${escapeHtml(worker.currentJobId)}` : 'Idle'}</td></tr>`).join('') : '<tr><td colspan="5"><p class="muted-copy">No worker heartbeat has been recorded. Start the background worker to establish liveness.</p></td></tr>';
}

function renderReliabilityProviderRows(providers) {
  return providers.map((provider) => `<tr><td><strong>${escapeHtml(provider.label)}</strong><small><span class="status ${provider.health === 'healthy' ? '' : 'warn'}">${escapeHtml(provider.health)}</span></small></td><td>${escapeHtml(provider.activeSources)}/${escapeHtml(provider.sources)}</td><td>${provider.successRate === null ? 'No runs' : `${escapeHtml(provider.successRate)}%`}<small>${escapeHtml(provider.failedRuns)} failed</small></td><td>${escapeHtml(provider.affectedTenants)}</td><td>${escapeHtml(provider.openAlerts)}<small>${escapeHtml(provider.criticalAlerts)} critical</small></td><td>${provider.activeIncident ? `<button class="button ghost platform-incident-manage" data-incident-id="${escapeHtml(provider.activeIncident.id)}" type="button">Incident #${escapeHtml(provider.activeIncident.id)}</button>` : provider.incidentCandidate ? `<button class="button ghost provider-incident-declare" type="button" data-provider="${escapeHtml(provider.key)}" data-provider-label="${escapeHtml(provider.label)}" data-affected-tenants="${escapeHtml(provider.affectedTenants)}" data-failed-runs="${escapeHtml(provider.failedRuns)}">Declare</button>` : ''}</td></tr>`).join('');
}

function renderDeadLetterRows(jobs) {
  return jobs.length ? jobs.map((job) => `<tr><td><strong>#${escapeHtml(job.id)} · ${escapeHtml(job.type)}</strong><small>${escapeHtml(job.failedAt || job.updatedAt || '')}</small></td><td>${escapeHtml(job.attempts)}/${escapeHtml(job.maxAttempts)}</td><td><small class="reliability-error">${escapeHtml(job.lastError || 'No failure detail')}</small></td><td><button class="button ghost dead-letter-retry" type="button" data-job-id="${escapeHtml(job.id)}" data-job-type="${escapeHtml(job.type)}" data-job-payload="${escapeHtml(JSON.stringify(job.payload||{}))}">Resolve</button></td></tr>`).join('') : '<tr><td colspan="4"><p class="muted-copy">No dead-letter jobs. Automatic processing has no exhausted failures.</p></td></tr>';
}

function renderRecoveryEvents(events, resolutions = []) {
  const actions = [...events.map((event)=>({...event,kind:'retry'})), ...resolutions.map((event)=>({...event,kind:'discard'}))].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  return actions.length ? actions.map((event) => `<article class="request-item"><strong>${event.kind==='retry'?`#${escapeHtml(event.originalJobId)} → #${escapeHtml(event.recoveryJobId)}`:`#${escapeHtml(event.jobId)} discarded`}</strong><span>${escapeHtml(event.reason)}</span><small>${escapeHtml(event.platformUserEmail || 'system')} · ${escapeHtml(event.createdAt || '')}</small></article>`).join('') : '<p class="muted-copy">No manual queue actions recorded.</p>';
}

function renderPlatformTenantRow(tenant) {
  const tenantPayload = {
    id: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    owner: tenant.owner.email || tenant.owner.name,
    billingStatus: tenant.billing.status,
    billingAmount: tenant.billing.recurringAmountLabel,
    metaStatus: tenant.meta.connected ? 'Connected' : 'Needs setup',
    platformStatus: tenant.platform.status,
    platformReason: tenant.platform.reason || '',
    health: tenant.health.overall
  };
  return `<tr>
    <td><strong>${escapeHtml(tenant.name)}</strong><small>${escapeHtml(tenant.plan)}</small></td>
    <td>${escapeHtml(tenant.owner.email || tenant.owner.name)}</td>
    <td>${escapeHtml(tenant.billing.status)}<small>${escapeHtml(tenant.billing.recurringAmountLabel)}</small></td>
    <td>${tenant.meta.connected ? '<span class="status">Connected</span>' : '<span class="status warn">Needs setup</span>'}</td>
    <td><span class="status">${escapeHtml(tenant.platform.status)}</span><small>${escapeHtml(tenant.platform.reason || tenant.health.overall)}</small></td>
    <td><button class="button ghost platform-tenant-manage" type="button" data-tenant="${escapeHtml(JSON.stringify(tenantPayload))}">Manage</button></td>
  </tr>`;
}

function renderPlatformLeadRows(leads) {
  if (!leads.length) return '<tr><td colspan="6"><p class="muted-copy">No public enquiries yet.</p></td></tr>';
  return leads.map((lead) => `<tr data-platform-lead-row="${escapeHtml(lead.id)}">
    <td><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.company)} · ${escapeHtml(lead.email)}</small></td>
    <td><span class="status ${lead.priority === 'high' ? 'warn' : ''}">${escapeHtml(lead.leadType)}</span><small>${escapeHtml(lead.useCase || 'General')} · ${escapeHtml(lead.teamSize || 'Team not supplied')}</small></td>
    <td>${escapeHtml(lead.routeKey)}<small>${escapeHtml(lead.reference)}</small></td>
    <td><span class="status ${['breached','at_risk'].includes(lead.slaStatus) ? 'warn' : ''}">${escapeHtml(lead.slaStatus.replaceAll('_', ' '))}</span><small>${lead.followUpStatus === 'overdue' ? 'Follow-up overdue' : escapeHtml(lead.followUpStatus)}</small></td>
    <td><span class="status" data-lead-status>${escapeHtml(lead.status)}</span><small>${escapeHtml(lead.ownerName || 'Unassigned')}</small></td>
    <td><button class="button ghost platform-lead-manage" type="button" data-lead-id="${escapeHtml(lead.id)}">Manage</button></td>
  </tr>`).join('');
}

function renderVendorHealth(vendor) {
  return `<article class="setup-step ${vendor.status === 'healthy' ? 'complete' : ''}"><span>${vendor.status === 'healthy' ? '✓' : '!'}</span><div><strong>${escapeHtml(vendor.name)}</strong><small>${escapeHtml(vendor.detail)}</small></div></article>`;
}

function renderPlatformGuardrail(guardrail) {
  return `<form class="guardrail-card ${guardrail.enabled ? 'active' : ''}" data-guardrail-key="${escapeHtml(guardrail.key)}">
    <header>
      <div>
        <strong>${escapeHtml(guardrail.label)}</strong>
        <small>${escapeHtml(guardrail.description)}</small>
      </div>
      <label class="toggle-row"><input name="enabled" type="checkbox" ${guardrail.enabled ? 'checked' : ''}><span>${guardrail.enabled ? 'Paused' : 'Available'}</span></label>
    </header>
    <label>Reason<input name="reason" value="${escapeHtml(guardrail.reason)}" placeholder="Reason required when pausing"></label>
    <button class="button ${guardrail.enabled ? 'danger-button' : ''}" type="submit">Save guardrail</button>
  </form>`;
}

function renderPlatformIncidentRow(incident) {
  return `<tr>
    <td><strong>${escapeHtml(incident.title)}</strong><small>${escapeHtml(incident.customerImpact)}</small></td>
    <td><span class="status incident-severity ${escapeHtml(incident.severity)}">${escapeHtml(incident.severity.toUpperCase())}</span></td>
    <td><span class="status">${escapeHtml(incident.status)}</span></td>
    <td>${escapeHtml(incident.ownerEmail || incident.ownerName || 'Unassigned')}</td>
    <td>${escapeHtml(incident.startedAt || '')}</td>
    <td><button class="button ghost platform-incident-manage" data-incident-id="${escapeHtml(incident.id)}" type="button">Manage</button></td>
  </tr>`;
}

function renderAiProviderCard(provider) {
  const payload = { key:provider.key,label:provider.label,protocol:provider.protocol,enabled:provider.enabled,apiKeyMasked:provider.apiKeyMasked,baseUrl:provider.baseUrl,defaultModel:provider.defaultModel,timeoutMs:provider.timeoutMs,lastHealthStatus:provider.lastHealthStatus,lastHealthMessage:provider.lastHealthMessage,lastCheckedAt:provider.lastCheckedAt };
  const stateLabel = provider.status === 'degraded' ? 'Degraded' : provider.enabled ? 'Configured' : 'Disabled';
  const health = provider.lastHealthStatus === 'not_checked' ? 'Not tested' : provider.lastHealthStatus.replaceAll('_', ' ');
  return `<article class="ai-provider-card"><div><span class="status ${provider.enabled && provider.status !== 'degraded' ? '' : 'warn'}">${escapeHtml(stateLabel)}</span><h4>${escapeHtml(provider.label)}</h4><p>${escapeHtml(provider.protocol.replaceAll('_',' '))}</p><small>${escapeHtml(provider.defaultModel || 'Model required')} · ${escapeHtml(provider.apiKeyMasked || 'No key saved')}</small><small class="ai-provider-health">${escapeHtml(health)}</small></div><button class="button ghost ai-provider-manage" type="button" data-provider="${escapeHtml(JSON.stringify(payload))}">Manage</button></article>`;
}

function renderAiUsage(item) {
  return `<article class="request-item"><strong>${escapeHtml(item.providerKey)} · ${escapeHtml(item.model)}</strong><span>${escapeHtml(item.status)} · ${escapeHtml(item.inputTokens + item.outputTokens)} tokens</span><small>${escapeHtml(item.createdAt || '')}</small></article>`;
}

function renderAuditEvent(event) {
  return `<article class="request-item"><strong>${escapeHtml(event.action)}</strong><span>${escapeHtml(event.platformUserEmail || 'system')}</span><small>${escapeHtml(event.createdAt || '')}</small></article>`;
}

function campaignTable(campaigns) {
  return `<table><thead><tr><th>Name</th><th>Status</th><th>Audience</th><th>Read</th><th>Revenue</th></tr></thead><tbody>${campaigns.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td><span class="status">${escapeHtml(c.status)}</span></td><td>${escapeHtml(c.audience)}</td><td>${escapeHtml(c.readRate)}</td><td>${escapeHtml(c.revenue)}</td></tr>`).join('')}</tbody></table>`;
}

function contactTable(contacts) {
  return `<table><thead><tr><th>Name</th><th>Phone</th><th>Segment</th><th>Opt-in</th><th>Last seen</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${contacts.map((c) => `<tr data-contact-id="${escapeHtml(c.id)}"><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.segment)}</td><td>${c.optedIn ? 'Yes' : 'No'}</td><td>${escapeHtml(c.lastSeen)}</td><td><div class="table-actions"><button class="link-button" data-contact-edit="${escapeHtml(c.id)}" data-contact-name="${escapeHtml(c.name)}" data-contact-phone="${escapeHtml(c.phone)}" data-contact-segment="${escapeHtml(c.segment)}" data-contact-opted-in="${c.optedIn ? 'true' : 'false'}" type="button">Edit</button><button class="link-button danger-link" data-contact-delete="${escapeHtml(c.id)}" data-contact-name="${escapeHtml(c.name)}" type="button">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
}

function renderPriceCard(planCode, name, price, description, included, excluded, featured, authenticated = false) {
  const ctaText = featured ? 'Start 14-day free trial' : name === 'Pro' ? 'Contact sales' : 'Get started free';
  const ctaAttribute = authenticated ? 'data-open-app' : `href="/signup?plan=${encodeURIComponent(planCode)}"`;
  return `<article class="price-card ${featured ? 'featured' : ''}">
    ${featured ? '<div class="price-badge">Most Popular</div>' : ''}
    <h3>${name}</h3>
    <p>${description}</p>
    <strong>${money(price)}<span>/mo</span></strong>
    <small>+ Meta conversation costs</small>
    <ul class="price-features">
      ${included.map((item) => `<li>${item}</li>`).join('')}
      ${excluded.map((item) => `<li class="no">${item}</li>`).join('')}
    </ul>
    <a class="price-cta ${featured ? 'primary' : 'outline'}" ${ctaAttribute}>${ctaText}</a>
  </article>`;
}

function renderPasswordField({ name, autocomplete, placeholder, minlength = null }) {
  return `<label>Password<div class="password-field"><input name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" ${minlength ? `minlength="${Number(minlength)}"` : ''} placeholder="${escapeHtml(placeholder)}" required><button class="password-toggle" type="button" aria-label="Show password" title="Show password"><span aria-hidden="true">Show</span></button></div></label>`;
}

function renderRecaptchaAssets({ enabled = false, siteKey = '' } = {}) {
  if (!enabled || !siteKey) return '';
  return `<meta name="recaptcha-site-key" content="${escapeHtml(siteKey)}"><script src="https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}" async defer></script>`;
}

function renderSocialAuthButtons({ providers = [], purpose, planCode = 'starter' }) {
  const configuredProviders = providers.filter((provider) => provider.configured);
  if (!configuredProviders.length) return '';
  return `<div class="social-auth"><span>Continue with</span><div>${configuredProviders.map((provider) => {
    return `<button class="social-button social-${escapeHtml(provider.id)}" type="button" data-social-start data-provider="${escapeHtml(provider.id)}" data-purpose="${escapeHtml(purpose)}" data-plan="${escapeHtml(planCode)}" aria-label="Continue with ${escapeHtml(provider.name)}" title="Continue with ${escapeHtml(provider.name)}">${socialIcon(provider.id)}<span class="sr-only">${escapeHtml(provider.name)}</span></button>`;
  }).join('')}</div></div>`;
}

function socialIcon(providerId) {
  const icons = {
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.1 3.3v2.7h3.4c2-1.8 3.4-4.5 3.4-8z"/><path fill="#34a853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.7c-1 .6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.8C3.9 20.4 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.6 13.9c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.5-3z"/><path fill="#ea4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.6 2.1 7.1l3.5 2.8C6.5 7.3 9 5.4 12 5.4z"/></svg>',
    yahoo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7b1fa2" d="M15.5 3h5.1l-6.5 15.1L15 22h-4.3l-.8-3.8L3.4 3h5.3l3.4 9.1L15.5 3zm3.4 14.1c-1.3 0-2.3 1-2.3 2.3s1 2.2 2.3 2.2 2.3-1 2.3-2.2-1-2.3-2.3-2.3z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877f2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0a66c2" d="M20.4 20.4h-3.6v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8H9.1V8.8h3.4v1.6h.1c.5-.9 1.7-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.4zM5.1 7.2a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM6.9 20.4H3.3V8.8h3.6v11.6z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 13c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2.1-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.2 3.2-2.5 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-3.8zM13.8 5.3c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.3.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z"/></svg>'
  };
  return icons[providerId] || `<span aria-hidden="true">${escapeHtml(String(providerId || '?').slice(0, 1).toUpperCase())}</span>`;
}

module.exports = {
  renderLoginPage,
  renderMarketingPage,
  renderPublicLeadPage,
  renderPage,
  renderPasswordResetPage,
  renderPublicInformationPage,
  renderPlatformDashboardPage,
  renderPlatformLoginPage,
  renderSignupPage,
  renderSocialSignupCompletionPage
};
