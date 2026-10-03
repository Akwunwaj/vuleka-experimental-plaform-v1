const express = require('express');
const { getDashboardData, getPublicPreviewData } = require('../services/repository');
const { getSocialSignupVerification, listSocialProviders } = require('../services/socialAuth');
const {
  renderLoginPage,
  renderMarketingPage,
  renderPage,
  renderPasswordResetPage,
  renderPublicInformationPage,
  renderPublicLeadPage,
  renderPlatformDashboardPage,
  renderPlatformLoginPage,
  renderSignupPage,
  renderSocialSignupCompletionPage
} = require('../views');
const { brand } = require('../config/app');
const { ping } = require('../db/pool');
const { getPlatformOverview, recordPlatformAuditEvent } = require('../services/platform');
const { completeGoogleDriveOAuth } = require('../services/googleDriveOAuth');
const { createKnowledgeConnector } = require('../services/knowledgeConnectors');
const { publicInformationPages } = require('../data/publicPolicies');
const { publicMarketingPages } = require('../data/publicSite');
const { getRecaptchaClientConfig } = require('../services/recaptcha');
const { getSocialDataDeletionStatus } = require('../services/socialDataDeletion');
const { completeTenantCrmOAuth } = require('../services/tenantCrm');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.send(renderPage(getPublicPreviewData(), { authenticated: false, nonce: res.locals.cspNonce }));
  } catch (err) {
    next(err);
  }
});

router.get('/login', (req, res) => {
  res.send(renderLoginPage({ authenticated: Boolean(req.user), socialProviders: listSocialProviders(), recaptcha: getRecaptchaClientConfig() }));
});

router.get('/signup', (req, res) => {
  res.send(renderSignupPage({ authenticated: Boolean(req.user), planCode: req.query.plan, socialProviders: listSocialProviders(), recaptcha: getRecaptchaClientConfig() }));
});

router.get('/signup/social/complete', async (req, res, next) => {
  try {
    res.send(
      renderSocialSignupCompletionPage({
        authenticated: Boolean(req.user),
        verification: await getSocialSignupVerification(req.query.token),
        token: req.query.token,
        recaptcha: getRecaptchaClientConfig()
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/password-reset', (req, res) => {
  res.send(renderPasswordResetPage({ authenticated: Boolean(req.user), recaptcha: getRecaptchaClientConfig() }));
});

router.get('/platform/login', (req, res) => {
  res.send(renderPlatformLoginPage({ authenticated: Boolean(req.platformUser), recaptcha: getRecaptchaClientConfig() }));
});

router.get('/platform', async (req, res, next) => {
  try {
    if (!req.platformUser) return res.redirect('/platform/login');
    await recordPlatformAuditEvent({
      platformUser: req.platformUser,
      action: 'platform.dashboard.view',
      targetType: 'platform',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.send(renderPlatformDashboardPage({ overview: await getPlatformOverview(), user: req.platformUser }));
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    if (!req.user || !req.businessId) return res.redirect('/login');
    res.setHeader('cache-control', 'no-store, private');
    res.send(renderPage(await getDashboardData(req.businessId), { authenticated: true, nonce: res.locals.cspNonce }));
  } catch (err) {
    next(err);
  }
});

router.get('/auth/google-drive/callback', async (req, res) => {
  if (!req.user || !req.businessId) return res.redirect('/login?returnTo=/auth/google-drive/callback');
  try {
    const completed = await completeGoogleDriveOAuth({
      code:req.query.code, state:req.query.state, error:req.query.error,
      businessId:req.businessId, actorUser:req.user
    });
    await createKnowledgeConnector({
      ...completed.payload, credentials:completed.credentials, provider:'google_drive',
      businessId:req.businessId, actorUser:req.user, triggerType:'oauth'
    });
    return res.redirect('/dashboard?googleDrive=connected#intelligence');
  } catch (error) {
    return res.redirect(`/dashboard?googleDrive=error&message=${encodeURIComponent(String(error.message || error).slice(0, 180))}#intelligence`);
  }
});

router.get('/auth/crm/:provider/callback', async (req, res) => {
  if (!req.user || !req.businessId) return res.redirect('/login?returnTo=/dashboard');
  try {
    await completeTenantCrmOAuth({ provider:req.params.provider, code:req.query.code, state:req.query.state, error:req.query.error, businessId:req.businessId, actorUser:req.user });
    return res.redirect(`/dashboard?crm=${encodeURIComponent(req.params.provider)}&result=connected#integrations`);
  } catch (error) {
    return res.redirect(`/dashboard?crm=${encodeURIComponent(req.params.provider)}&result=error&message=${encodeURIComponent(String(error.message || error).slice(0,180))}#integrations`);
  }
});

router.get('/docs', (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brand.name} Help</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="docs-body">
  <main class="docs-shell">
    <a class="brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <header><p class="section-label">Help centre</p><h1>Set up your WhatsApp workspace</h1><p>Follow the guided setup in your workspace. These steps keep business, consent, and messaging configuration in the right order.</p></header>
    <div class="docs-grid">
      <article><span>01</span><h2>Create your workspace</h2><p>Choose a plan, create the owner account, and confirm the business profile used by your team.</p></article>
      <article><span>02</span><h2>Prepare Meta verification</h2><p>Gather your CIPC registration details, website, business address, and display-name evidence before starting Meta onboarding.</p></article>
      <article><span>03</span><h2>Connect WhatsApp</h2><p>Use Embedded Signup to connect the WhatsApp Business Account and phone number owned by your business.</p></article>
      <article><span>04</span><h2>Confirm consent</h2><p>Import only contacts with a documented opt-in and test STOP handling before preparing a campaign.</p></article>
      <article><span>05</span><h2>Review templates</h2><p>Adapt a workflow starter, submit the required message template to Meta, and wait for approval before live use.</p></article>
      <article><span>06</span><h2>Run a controlled test</h2><p>Send to an approved internal test recipient, verify webhook events, then review delivery and cost records.</p></article>
    </div>
    <footer class="docs-support"><strong>Need help?</strong><p>Contact <a href="mailto:${brand.supportEmail}">${brand.supportEmail}</a> with your workspace name and the setup step you are completing.</p></footer>
  </main>
</body>
</html>`);
});

router.get('/contact', (req, res) => {
  res.send(renderPublicLeadPage({ leadType: 'sales', recaptcha: getRecaptchaClientConfig(), nonce: res.locals.cspNonce }));
});

router.get('/demo', (req, res) => {
  res.send(renderPublicLeadPage({ leadType: 'demo', recaptcha: getRecaptchaClientConfig(), nonce: res.locals.cspNonce }));
});

Object.entries(publicMarketingPages).forEach(([path, page]) => {
  router.get(path, (req, res) => res.send(renderMarketingPage({ ...page, path }, { authenticated: Boolean(req.user), nonce: res.locals.cspNonce })));
});

router.get('/status', async (req, res, next) => {
  try {
    const database = await ping();
    const operational = Boolean(database.ok);
    res.status(operational ? 200 : 503).send(
      renderMarketingPage({
        path: '/status',
        kind: 'Service status',
        title: operational ? 'ChatClan beta services are responding' : 'ChatClan is investigating a service issue',
        description: operational
          ? 'The application and configured data service responded to the latest readiness check.'
          : 'One or more required readiness checks did not respond successfully. The operations team should review the active incident evidence.',
        availability: operational ? 'Operational' : 'Service issue',
        proofTitle: 'Current beta readiness',
        proofItems: [
          ['Application', 'The public application route is responding.'],
          ['Data service', operational ? 'The configured data readiness check passed.' : 'The configured data readiness check requires attention.'],
          ['History', 'Historical uptime percentages will be published only after production monitoring has sufficient evidence.']
        ],
        sections: [
          { title: 'What this page reports', body: 'This beta status page reports the latest application readiness result. It does not yet claim a production uptime percentage or contractual service level.' },
          { title: 'Incident operations', body: 'ChatClan includes internal alert acknowledgement, escalation, incident updates, worker health, provider correlation, and audited recovery controls.' },
          { title: 'Need help with your workspace?', body: `Contact ${brand.supportEmail} with the workspace name, approximate time, affected workflow, and request ID where available.` }
        ],
        faq: [['Is this a production SLA page?', 'No. Formal uptime history and service commitments require production monitoring evidence and approved service terms.']]
      }, { authenticated: Boolean(req.user), nonce: res.locals.cspNonce })
    );
  } catch (err) {
    next(err);
  }
});

Object.entries(publicInformationPages).filter(([path]) => path !== '/contact').forEach(([path, page]) => {
  router.get(path, (req, res) => res.send(renderPublicInformationPage({ ...page, path })));
});

router.get('/data-deletion/status', async (req, res, next) => {
  try {
    const status = await getSocialDataDeletionStatus(req.query.code);
    res.status(status ? 200 : 404).send(
      renderPublicInformationPage({
        path: '/data-deletion/status',
        title: status ? 'Data Deletion Complete' : 'Deletion Request Not Found',
        label: 'Privacy request status',
        lastUpdated: new Date().toISOString().slice(0, 10),
        introduction: status
          ? 'ChatClan has completed the deletion request associated with this confirmation code.'
          : 'We could not find a deletion request for this confirmation code. Check the link or contact the privacy team.',
        sections: status
          ? [{ id: 'status', title: 'Request status', facts: [['Confirmation code', status.confirmationCode], ['Status', 'Completed'], ['Completed', new Date(status.completedAt).toISOString()]] }]
          : [{ id: 'help', title: 'Get help', paragraphs: ['Contact {{privacyEmail}} and include the confirmation code shown in your original request response.'] }],
        references: []
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'chatclan' });
});

router.get('/ready', async (req, res) => {
  const database = await ping();
  res.json({
    ok: database.ok,
    service: 'chatclan',
    database
  });
});

module.exports = router;
