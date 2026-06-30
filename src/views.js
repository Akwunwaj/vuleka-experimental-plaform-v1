const { brand } = require('./config/app');
const { listPlans, publicPlan } = require('./services/planCatalog');

function money(value) {
  return `R ${Number(value).toLocaleString('en-ZA')}`;
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

function renderPage(data, { authenticated = false } = {}) {
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
  <title>${brand.name} - WhatsApp SaaS Platform</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <section class="${landingClass}" id="landing">
    <header class="hero">
      <nav class="floating-nav">
        <a class="brand mini-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
        <div>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="/docs">Docs</a>
          <a class="nav-signin" href="/login">Sign in</a>
          <a class="nav-trial" href="/signup">Start free trial →</a>
        </div>
      </nav>
      <div class="hero-eyebrow">● Powered by Meta WhatsApp Cloud API v21.0</div>
      <h1 class="hero-h1">
        Grow your business<br>
        with <span class="green">WhatsApp</span><br>
        <span class="stroke">marketing</span>
      </h1>
      <p class="hero-sub">Send campaigns, automate replies, and convert customers — all from one simple platform built for South African small businesses.</p>
      <div class="hero-actions">
        <a class="btn-hero" ${appCta}>Start free — no credit card</a>
        <a class="btn-hero-outline" ${authenticated ? 'data-open-app' : 'href="/login"'}>${authenticated ? 'Open dashboard →' : 'Sign in to view dashboard →'}</a>
      </div>
      <div class="hero-trust">
        <div class="trust-avatars">
          <span>CT</span><span>JN</span><span>DB</span><span>PT</span><span>SA</span>
        </div>
        <p>Trusted by 1,200+ small businesses in SA</p>
        <div class="stars">★★★★★ <span>4.9/5 rating</span></div>
      </div>

      <div class="hero-mockup">
        <div class="mockup-bar"><i></i><i></i><i></i><span>${brand.domain.replace('https://', '')}</span></div>
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

    <section class="stats-strip">
      <article><strong>98%</strong><span>WhatsApp message open rate</span></article>
      <article><strong>5×</strong><span>Better than email CTR</span></article>
      <article><strong>2B+</strong><span>Active WhatsApp users worldwide</span></article>
      <article><strong>R0</strong><span>Setup fee — ever</span></article>
    </section>

    <section class="features" id="features">
      <div class="section-label">Everything you need</div>
      <h2 class="section-h2">One platform.<br>Endless conversations.</h2>
      <div class="features-grid">
        <article><div class="feat-icon">📣</div><h3>Broadcast Campaigns</h3><p>Send flash sales, product launches, and promotions to your entire contact list in seconds. Track open, delivery, and click rates live.</p></article>
        <article><div class="feat-icon">🤖</div><h3>Chatbot Flows</h3><p>Build no-code automated reply flows for FAQs, order tracking, appointments, and support. Available 24/7 with zero effort from you.</p></article>
        <article><div class="feat-icon">💬</div><h3>Unified Inbox</h3><p>All customer replies in one inbox. Assign conversations to team members, add notes, and never miss a hot lead again.</p></article>
        <article><div class="feat-icon">👥</div><h3>Contact Management</h3><p>Import contacts from CSV or your POS system. Segment by purchase history, location, or custom tags for laser-targeted messaging.</p></article>
        <article><div class="feat-icon">📋</div><h3>Template Library</h3><p>50+ pre-approved WhatsApp templates ready to use — order confirmations, sale alerts, appointment reminders, and more.</p></article>
        <article><div class="feat-icon">📈</div><h3>Real Analytics</h3><p>See exactly how many messages were delivered, opened, clicked, and converted to sales. Know your ROI to the rand.</p></article>
      </div>
    </section>

    <section class="pricing" id="pricing">
      <div class="section-center">
        <div class="section-label">Simple pricing</div>
        <h2 class="section-h2">No surprises. No hidden fees.</h2>
        <p>You pay us a flat monthly fee. You pay Meta separately per conversation.</p>
      </div>
      <div class="pricing-grid">
        ${renderPriceCard('starter', 'Starter', 299, 'Perfect for side hustles & solo traders', ['1 WhatsApp number', '2,000 contacts', '5 campaigns/month', 'Basic chatbot flows', 'Email support'], ['Team inbox', 'API access', 'Custom templates'], false, authenticated)}
        ${renderPriceCard('growth', 'Growth', 799, 'For growing shops & service businesses', ['3 WhatsApp numbers', '10,000 contacts', 'Unlimited campaigns', 'Advanced chatbot builder', 'Team inbox (5 seats)', 'Priority support', '50+ pre-built templates'], ['API access'], true, authenticated)}
        ${renderPriceCard('pro', 'Pro', 1999, 'For agencies & multi-location businesses', ['Unlimited numbers', 'Unlimited contacts', 'Unlimited campaigns', 'Full API access', 'Unlimited team seats', 'Dedicated account manager', 'Custom templates approved', 'White-label option'], [], false, authenticated)}
      </div>
    </section>

    <section class="cta-banner">
      <h2>Ready to start selling<br>on WhatsApp?</h2>
      <p>Join 1,200+ South African businesses already growing with ${brand.name}</p>
      <a class="btn-hero" ${appCta}>Start your free trial — 14 days, no card needed</a>
    </section>

    <footer class="footer">
      <p>© 2026 ${brand.legalName} · Cape Town, South Africa · Built on Meta WhatsApp Cloud API</p>
      <div>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">POPIA</a>
        <a href="#">WhatsApp Policy</a>
        <a href="#">Contact</a>
      </div>
    </footer>
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
        <small>${Number(business.contactsUsed || 0)}/${Number(business.contactsLimit || 0)} contacts used · renews ${escapeHtml(business.billingRenewal)}</small>
        <span><i style="width:${contactUsage}%"></i></span>
      </div>
      <div class="nav-group">
        <small>Manage</small>
        <button class="nav-item active" data-page="dashboard" data-title="Home">⌂ <span>Home</span></button>
        <button class="nav-item" data-page="inbox" data-title="Inbox">☏ <span>Inbox</span>${unreadInbox ? `<em>${unreadInbox}</em>` : ''}</button>
        <button class="nav-item" data-page="campaigns" data-title="Campaigns">▣ <span>Campaigns</span></button>
        <button class="nav-item" data-page="contacts" data-title="Contacts">◎ <span>Contacts</span></button>
        <button class="nav-item" data-page="commerce" data-title="Commerce">◧ <span>Commerce</span></button>
      </div>
      <div class="nav-group">
        <small>Build</small>
        <button class="nav-item" data-page="templates" data-title="Templates">□ <span>Templates</span></button>
        <button class="nav-item" data-page="flows" data-title="Automations">◇ <span>Automations</span></button>
        <button class="nav-item" data-page="analytics" data-title="Insights">◌ <span>Insights</span></button>
      </div>
      <div class="nav-group">
        <small>Business</small>
        <button class="nav-item" data-page="billing" data-title="Billing">R <span>Billing</span></button>
        <button class="nav-item" data-page="settings" data-title="Settings & API">⚙ <span>Settings & API</span></button>
      </div>
      <a class="nav-item muted" href="/">← <span>Public site</span></a>
    </aside>
    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="workspace-kicker">Business Suite</p>
          <h2 id="pageTitle">Home</h2>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" data-page-link="campaigns" type="button">Create campaign</button>
          <button class="icon-button" title="Notifications">!</button>
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
      <section class="page" id="page-contacts"><div class="page-heading"><div><h1>Contacts</h1><p class="muted-copy">Keep opted-in WhatsApp audiences segmented and ready for campaigns.</p></div><button class="button primary" id="addContactBtn">Add contact</button></div><article class="panel">${contactTable(contacts)}</article></section>
      <section class="page" id="page-commerce">
        <div class="page-heading"><div><h1>Commerce</h1><p class="muted-copy">Create product catalogues, share product cards on WhatsApp, and track orders from chat.</p></div><span class="status">${products.length} products</span></div>
        <div class="metric-grid commerce-metrics" id="commerceMetrics">
          <article class="metric"><small>Products</small><strong>${products.length}</strong><span>Catalogue ready</span></article>
          <article class="metric"><small>Orders</small><strong>${orders.length}</strong><span>From WhatsApp and manual sales</span></article>
          <article class="metric"><small>Revenue</small><strong>R 0.00</strong><span>Paid orders</span></article>
          <article class="metric"><small>Stock alerts</small><strong>0</strong><span>Low inventory</span></article>
        </div>
        <div class="commerce-grid">
          <form class="panel form-panel" id="productForm">
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
            <form class="panel form-panel" id="shareCatalogForm">
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
            <form class="panel form-panel" id="productImportForm">
              <h3>Bulk product import</h3>
              <label>CSV products<textarea name="csvText" rows="8">name,sku,price,stock,image_url,catalog_id,retailer_id,url,description
Classic Tee,classic-tee,199,25,https://example.co.za/classic-tee.jpg,demo_catalog_za,classic-tee,https://example.co.za/products/classic-tee,Everyday cotton tee</textarea></label>
              <div class="commerce-row-actions">
                <button class="button" id="previewProductImportBtn" type="button">Preview import</button>
                <button class="button primary" type="submit">Import products</button>
              </div>
              <small class="muted-copy" id="productImportStatus">Columns: name, sku, price, stock, image_url, catalog_id, retailer_id, url, description.</small>
            </form>
            <form class="panel form-panel" id="collectionForm">
              <h3>Product collection</h3>
              <label>Name<input name="name" value="New arrivals" required></label>
              <label>Product IDs<input name="productIds" placeholder="1000,1001" required></label>
              <label>Description<textarea name="description">A focused set of products to share on WhatsApp.</textarea></label>
              <button class="button primary" type="submit">Save collection</button>
              <small class="muted-copy">Use product IDs from the cards above. Collections share through the WhatsApp catalogue payload.</small>
            </form>
            <form class="panel form-panel" id="couponForm">
              <h3>Coupon</h3>
              <label>Code<input name="code" value="WINTER10" required></label>
              <label>Name<input name="name" value="Winter WhatsApp offer"></label>
              <label>Type<select name="discountType"><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label>
              <label>Value<input name="discountValue" type="number" min="1" value="10" required></label>
              <label>Minimum order (ZAR)<input name="minimumOrder" type="number" min="0" step="0.01" value="0"></label>
              <label>Max redemptions<input name="maxRedemptions" type="number" min="1" placeholder="Optional"></label>
              <button class="button primary" type="submit">Save coupon</button>
            </form>
            <form class="panel form-panel" id="variantForm">
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
          <header><h3>Automation rules</h3><span class="status" id="commerceAutomationRuleCount">0</span></header>
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
      <section class="page" id="page-inbox"><div class="page-heading"><div><h1>Inbox</h1><p class="muted-copy">Manage customer conversations, ownership, notes, SLA, replies, and CSAT.</p></div><span class="status">${unreadInbox} unread</span></div><div class="inbox-grid"><article class="panel inbox-list" id="inboxList">${inbox.map(renderInboxListItem).join('')}</article><article class="panel conversation" id="inboxConversation" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><header><div><h3 id="inboxCustomerName">${escapeHtml(activeInbox.customerName || activeInbox.name || 'Conversation')}</h3><p class="muted-copy" id="inboxCustomerMeta">${escapeHtml(activeInbox.customerPhone || 'WhatsApp customer')}</p></div><span class="status" id="inboxSlaBadge">${escapeHtml(activeInbox.slaStatus || 'open')}</span></header><div class="inbox-meta"><span id="inboxAssigned">${activeInbox.assignedUserName ? `Assigned to ${escapeHtml(activeInbox.assignedUserName)}` : 'Unassigned'}</span><span id="inboxCsat">${activeInbox.csatScore ? `CSAT ${escapeHtml(activeInbox.csatScore)}/5` : 'No CSAT yet'}</span></div><div class="conversation-stream" id="inboxMessages"><p class="chat-left">${escapeHtml(activeInbox.preview || activeInbox.lastMessagePreview || 'Select a conversation to view messages.')}</p></div><p class="typing-indicator" id="typingIndicator"></p><form id="replyForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><input name="body" placeholder="Type a reply"><button class="button primary">Send</button></form><form class="inline-form" id="noteForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><input name="body" placeholder="Add an internal note"><button class="button">Add note</button></form><div class="note-list" id="inboxNotes"></div><form class="inline-form" id="csatForm" data-conversation-id="${escapeHtml(activeInbox.id || '')}"><select name="score"><option value="">CSAT</option><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Bad</option></select><input name="comment" placeholder="Optional CSAT note"><button class="button">Save</button></form></article></div></section>
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
      <section class="page" id="page-templates"><div class="page-heading"><div><h1>Templates</h1><p class="muted-copy">Maintain Meta-approved templates for compliant outbound messages.</p></div></div><div class="template-grid">${templates.map((tpl) => `<article class="panel template"><small>${escapeHtml(tpl.category)} · ${escapeHtml(tpl.status)}</small><h3>${escapeHtml(tpl.name)}</h3><p>${escapeHtml(tpl.body)}</p><button class="button ghost" data-page-link="campaigns">Use template</button></article>`).join('')}</div></section>
      <section class="page" id="page-analytics"><div class="page-heading"><div><h1>Insights</h1><p class="muted-copy">Track WhatsApp campaign performance, customer response trends, and Meta delivery costs.</p></div><button class="button" id="refreshInsightsBtn" type="button">Refresh</button></div><div class="metric-grid" id="insightSummary"><article class="metric"><small>Sent</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Delivered</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Read rate</small><strong>--</strong><span>Loading</span></article><article class="metric"><small>Replies</small><strong>--</strong><span>Loading</span></article></div><div class="two-col"><article class="panel"><header><h3>Campaign performance</h3><span class="status" id="insightStatus">Loading</span></header><div class="bar-chart" id="insightChart"></div></article><article class="panel"><header><h3>Actionable insights</h3><span class="status" id="insightCost">Cost loading</span></header><div class="insight-list" id="insightActions"><p class="muted-copy">Loading recommendations...</p></div></article></div><article class="panel"><header><h3>Campaign ranking</h3></header><div id="insightCampaigns"><p class="muted-copy">Loading campaigns...</p></div></article></section>
      <section class="page" id="page-billing"><div class="page-heading"><div><h1>Billing</h1><p class="muted-copy">Manage plan, payment provider, contact usage, and account renewal.</p></div></div><div class="two-col"><article class="panel"><h3>Current plan: ${safeBusinessPlan}</h3><p>Renews ${escapeHtml(business.billingRenewal)}. PayFast is the recommended first production provider for subscriptions on this build.</p><div class="provider-grid">${providers.map((p) => `<article><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.strength)}</span><small>${escapeHtml(p.fees)}</small><em>${escapeHtml(p.status)}</em></article>`).join('')}</div></article><article class="panel"><h3>Usage</h3><p>${Number(business.contactsUsed || 0)} of ${Number(business.contactsLimit || 0)} contacts used.</p><div class="meter"><span style="width:${contactUsage}%"></span></div></article></div></section>
      <section class="page" id="page-settings"><div class="page-heading"><div><h1>Settings & API</h1><p class="muted-copy">Configure Meta assets, encrypted credentials, team access, webhooks, and POPIA workflows.</p></div></div><div class="two-col"><div class="settings-stack"><article class="panel form-panel"><h3>Meta Business Verification</h3><p class="muted-copy">For South African businesses, keep CIPC registration documents, director ID, proof of address, display name evidence, and website/domain details ready before submitting in Meta Business Manager.</p><button class="button" id="markVerificationCompleteBtn" type="button">Mark verification ready</button><small class="muted-copy">Use this once Meta Business Manager shows the account as verified or ready for WABA review.</small></article><article class="panel form-panel" id="metaOnboardingPanel"><h3>Embedded Signup</h3><p class="muted-copy">Launch Meta onboarding, capture WABA and phone assets, exchange the returned code, and save the business token securely.</p><div class="setup-steps compact" id="metaOnboardingChecks"><p class="muted-copy">Loading Meta onboarding status...</p></div><button class="button primary" id="launchMetaSignupBtn" type="button">Launch Embedded Signup</button><small id="metaOnboardingStatus" class="muted-copy">Configure META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID for live launch.</small></article><form class="panel form-panel" id="metaEmbeddedSignupForm"><h3>Complete signup</h3><label>OAuth code<input name="code" value="demo_embedded_signup_code" required></label><label>WABA ID<input name="wabaId" value="demo_waba_signup" required></label><label>Phone Number ID<input name="phoneNumberId" value="demo_phone_signup" required></label><label>Business phone<input name="phoneNumber" placeholder="27821234567"></label><label>Verify token<input name="verifyToken" placeholder="Webhook verify token"></label><button class="button" type="submit">Save signup result</button><small class="muted-copy">In mock mode this simulates Meta's code exchange. In live mode it calls Meta's OAuth token endpoint.</small></form><form class="panel form-panel" id="metaPhoneRegistrationForm"><h3>Phone registration</h3><label>6 digit PIN<input name="pin" inputmode="numeric" minlength="6" maxlength="6" placeholder="123456" required></label><label>Data localization country<input name="dataLocalizationRegion" maxlength="2" placeholder="Optional, e.g. ZA"></label><button class="button" type="submit">Register phone</button><small id="metaPhoneRegistrationStatus" class="muted-copy">Register after Embedded Signup returns a verified phone number ID.</small></form><form class="panel form-panel" id="metaCredentialsForm"><h3>Meta Credentials</h3><p class="muted-copy">Credentials are encrypted at rest and scoped to this business workspace.</p><label>WABA ID<input name="wabaId" placeholder="WhatsApp Business Account ID" required></label><label>Phone Number ID<input name="phoneNumberId" placeholder="Meta Phone Number ID" required></label><label>Access Token<input name="accessToken" type="password" placeholder="Permanent or system-user token" required></label><label>Verify Token<input name="verifyToken" placeholder="Webhook verification token"></label><button class="button primary" type="submit">Save encrypted credentials</button><small id="metaCredentialStatus" class="muted-copy">Not connected</small></form><form class="panel form-panel" id="testMessageForm"><h3>Meta Cloud API</h3><p class="muted-copy">Send a test message using encrypted workspace credentials, or environment fallback in local mode.</p><label>Test recipient<input name="to" placeholder="27821234567"></label><label>Message<textarea name="text">Hello from ${brand.name}.</textarea></label><button class="button primary">Send test message</button></form><form class="panel form-panel" id="dataDeletionForm"><h3>POPIA Data Deletion</h3><p class="muted-copy">Submit a data subject deletion request. Matching contact data, campaign recipients, and inbox conversation content are redacted while the audit record is retained.</p><label>Customer WhatsApp number<input name="phone" placeholder="+27821234567" required></label><label>Reason<input name="reason" value="Customer requested deletion"></label><button class="button danger-button" type="submit">Process deletion request</button><small id="dataDeletionStatus" class="muted-copy">Owners and admins can process POPIA deletion requests.</small><div class="request-list" id="dataDeletionRequests"></div></form><form class="panel form-panel" id="teamUserForm"><h3>Team Access</h3><label>Name<input name="name" placeholder="Team member name" required></label><label>Email<input name="email" type="email" placeholder="teammate@example.co.za" required></label><label>Role<select name="role"><option value="agent">Agent</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></label><button class="button primary" type="submit">Add team member</button><small id="teamUserStatus" class="muted-copy">Owners and admins can add workspace users.</small></form></div><article class="panel"><h3>Webhook URLs</h3><code>/webhooks/meta</code><code>/webhooks/payfast/itn</code><p class="muted-copy">Use the Meta verify token you saved here when configuring the webhook subscription.</p></article></div></section>
    </section>
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

function renderLoginPage({ authenticated = false, socialProviders = [] } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="auth-body">
  <main class="auth-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card" id="loginForm">
      <div class="section-label">Secure access</div>
      <h1>Sign in to ${brand.name}</h1>
      <p>Use your workspace account to manage campaigns, contacts, billing, and API settings.</p>
      ${renderSocialAuthButtons({ providers: socialProviders, purpose: 'signin' })}
      <label>Email<input name="email" type="email" autocomplete="email" value="admin@chatclan.co.za" required></label>
      ${renderPasswordField({ name: 'password', autocomplete: 'current-password', placeholder: 'Enter password' })}
      <button class="btn-hero auth-submit" type="submit">Sign in</button>
      <small>New here? <a class="auth-link" href="/signup">Create a workspace</a>.</small>
      <small><a class="auth-link" href="/password-reset">Forgot your password?</a></small>
      <small>Local demo password defaults to <code>ChangeMe123!</code> unless <code>DEMO_ADMIN_PASSWORD</code> is set.</small>
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

function renderPasswordResetPage({ authenticated = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset password - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="auth-body">
  <main class="auth-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card reset-card" id="passwordResetRequestForm">
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

function renderSignupPage({ authenticated = false, planCode = 'starter', socialProviders = [] } = {}) {
  const plans = listPlans().map(publicPlan);
  const selectedPlanCode = plans.some((plan) => plan.code === String(planCode || '').toLowerCase()) ? String(planCode).toLowerCase() : 'starter';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Start free trial - ${brand.name}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="auth-body">
  <main class="auth-shell signup-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card signup-card" id="signupForm">
      <div class="section-label">Start free trial</div>
      <h1>Create your ${brand.name} workspace</h1>
      <p>Choose a plan, create the owner account, and continue into setup. Trial accounts use the same subscription limits as paid accounts.</p>
      ${renderSocialAuthButtons({ providers: socialProviders, purpose: 'signup', planCode: selectedPlanCode })}
      <label>Business name<input name="businessName" autocomplete="organization" placeholder="Nomsa Fashion Store" required></label>
      <label>Your name<input name="ownerName" autocomplete="name" placeholder="Nomsa Mkhize" required></label>
      <label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.co.za" required></label>
      ${renderPasswordField({ name: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters', minlength: 10 })}
      <label>Plan<select name="planCode">${plans.map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === selectedPlanCode ? 'selected' : ''}>${escapeHtml(plan.name)} - R ${escapeHtml(plan.amount)}/mo</option>`).join('')}</select></label>
      <div class="signup-plan-grid">
        ${plans.map((plan) => `<article class="${plan.code === selectedPlanCode ? 'selected' : ''}"><strong>${escapeHtml(plan.name)}</strong><span>${escapeHtml(plan.limits.contacts === null ? 'Unlimited contacts' : `${plan.limits.contacts.toLocaleString('en-ZA')} contacts`)}</span><small>${escapeHtml(plan.campaigns)} campaigns · ${escapeHtml(plan.limits.teamSeats === null ? 'Unlimited seats' : `${plan.limits.teamSeats} seats`)}</small></article>`).join('')}
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

function renderSocialSignupCompletionPage({ authenticated = false, verification = null, token = '' } = {}) {
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
</head>
<body class="auth-body">
  <main class="auth-shell signup-shell">
    <a class="brand auth-brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <form class="auth-card signup-card" id="socialSignupCompletionForm">
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

function campaignTable(campaigns) {
  return `<table><thead><tr><th>Name</th><th>Status</th><th>Audience</th><th>Read</th><th>Revenue</th></tr></thead><tbody>${campaigns.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td><span class="status">${escapeHtml(c.status)}</span></td><td>${escapeHtml(c.audience)}</td><td>${escapeHtml(c.readRate)}</td><td>${escapeHtml(c.revenue)}</td></tr>`).join('')}</tbody></table>`;
}

function contactTable(contacts) {
  return `<table><thead><tr><th>Name</th><th>Phone</th><th>Segment</th><th>Opt-in</th><th>Last seen</th></tr></thead><tbody>${contacts.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.segment)}</td><td>${c.optedIn ? 'Yes' : 'No'}</td><td>${escapeHtml(c.lastSeen)}</td></tr>`).join('')}</tbody></table>`;
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
  return `<label>Password<div class="password-field"><input name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" ${minlength ? `minlength="${Number(minlength)}"` : ''} placeholder="${escapeHtml(placeholder)}" required><button class="password-toggle" type="button" aria-label="Show password" title="Show password"><span aria-hidden="true">👁</span></button></div></label>`;
}

function renderSocialAuthButtons({ providers = [], purpose, planCode = 'starter' }) {
  if (!providers.length) return '';
  return `<div class="social-auth"><span>Continue with</span><div>${providers.map((provider) => {
    const query = new URLSearchParams({ purpose, plan: planCode });
    const title = provider.configured ? provider.name : `${provider.name} needs client ID configuration`;
    return `<a class="social-button social-${escapeHtml(provider.id)} ${provider.configured ? '' : 'disabled'}" href="/api/auth/social/${encodeURIComponent(provider.id)}/start?${query.toString()}" aria-label="${escapeHtml(provider.name)}" title="${escapeHtml(title)}" ${provider.configured ? '' : 'aria-disabled="true"'}>${socialIcon(provider.id)}<span class="sr-only">${escapeHtml(provider.name)}</span></a>`;
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

module.exports = { renderLoginPage, renderPage, renderPasswordResetPage, renderSignupPage, renderSocialSignupCompletionPage };
