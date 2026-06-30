const express = require('express');
const { getDashboardData, getPublicPreviewData } = require('../services/repository');
const { getSocialSignupVerification, listSocialProviders } = require('../services/socialAuth');
const { renderLoginPage, renderPage, renderPasswordResetPage, renderSignupPage, renderSocialSignupCompletionPage } = require('../views');
const { brand } = require('../config/app');
const { ping } = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.send(renderPage(getPublicPreviewData(), { authenticated: false }));
  } catch (err) {
    next(err);
  }
});

router.get('/login', (req, res) => {
  res.send(renderLoginPage({ authenticated: Boolean(req.user), socialProviders: listSocialProviders() }));
});

router.get('/signup', (req, res) => {
  res.send(renderSignupPage({ authenticated: Boolean(req.user), planCode: req.query.plan, socialProviders: listSocialProviders() }));
});

router.get('/signup/social/complete', async (req, res, next) => {
  try {
    res.send(
      renderSocialSignupCompletionPage({
        authenticated: Boolean(req.user),
        verification: await getSocialSignupVerification(req.query.token),
        token: req.query.token
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/password-reset', (req, res) => {
  res.send(renderPasswordResetPage({ authenticated: Boolean(req.user) }));
});

router.get('/dashboard', async (req, res, next) => {
  try {
    if (!req.user || !req.businessId) return res.redirect('/login');
    res.send(renderPage(await getDashboardData(req.businessId), { authenticated: true }));
  } catch (err) {
    next(err);
  }
});

router.get('/docs', (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brand.name} Docs</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <section class="section">
    <a class="brand" href="/"><span class="brand-mark">${brand.mark}</span><span>${brand.name}</span></a>
    <h1>Project Documentation</h1>
    <div class="feature-grid">
      <article><h3>Tech Stack Decision</h3><p>See <code>docs/tech_stack_decision.md</code> for the Node.js/MariaDB recommendation.</p></article>
      <article><h3>Execution Plan</h3><p>See <code>docs/execution_plan.md</code> for the phased product plan and DirectAdmin deployment outline.</p></article>
      <article><h3>Implementation Log</h3><p>See <code>docs/implementation_log.md</code> for the work completed so far and known gaps.</p></article>
    </div>
  </section>
</body>
</html>`);
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
