const landing = document.getElementById('landing');
const app = document.getElementById('app');
const pageTitle = document.getElementById('pageTitle');
const toast = document.getElementById('toast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function openApp() {
  if (!app) {
    window.location.href = '/login';
    return;
  }
  if (!landing) return;
  landing.classList.add('hidden');
  app.classList.remove('hidden');
}

function showSite() {
  if (!app || !landing) return;
  app.classList.add('hidden');
  landing.classList.remove('hidden');
}

function showPage(id) {
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${id}`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === id));
  const activeNav = document.querySelector(`.nav-item[data-page="${id}"]`);
  if (pageTitle) {
    pageTitle.textContent = activeNav?.dataset.title || id.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

document.querySelectorAll('[data-open-app]').forEach((button) => button.addEventListener('click', openApp));
document.querySelectorAll('[data-show-site]').forEach((button) => button.addEventListener('click', showSite));
document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.pageLink)));
document.querySelectorAll('.social-button.disabled').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    showToast('This social provider needs OAuth credentials first');
  });
});
document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.closest('.password-field')?.querySelector('input');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    button.setAttribute('title', show ? 'Hide password' : 'Show password');
    button.classList.toggle('active', show);
  });
});

const setupWizard = document.getElementById('setupWizard');
async function loadSetupWizard() {
  if (!setupWizard) return;
  const response = await fetch('/api/setup/wizard');
  const progress = await response.json().catch(() => null);
  if (!response.ok || !progress) {
    document.getElementById('setupWizardSummary').textContent = 'Sign in to resume setup progress for your workspace.';
    document.getElementById('setupWizardPercent').textContent = '0%';
    document.getElementById('setupWizardSteps').innerHTML = '<p class="muted-copy">Workspace setup tracking is available after sign-in.</p>';
    return;
  }

  document.getElementById('setupWizardPercent').textContent = `${progress.percent}%`;
  document.getElementById('setupWizardBar').style.width = `${progress.percent}%`;
  document.getElementById('setupWizardSummary').textContent = progress.complete
    ? 'Setup complete. This workspace is ready for beta activation.'
    : `${progress.completedCount} of ${progress.totalSteps} steps complete. Next: ${progress.steps.find((step) => step.id === progress.nextStepId)?.title || 'finish setup'}.`;
  document.getElementById('setupWizardSteps').innerHTML = progress.steps.map(renderSetupStep).join('');
  document.querySelectorAll('[data-setup-page]').forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.setupPage));
  });
  document.querySelectorAll('[data-complete-step]').forEach((button) => {
    button.addEventListener('click', () => completeSetupStep(button.dataset.completeStep));
  });
}

function renderSetupStep(step) {
  const action = step.action?.page
    ? `<button class="link-button" data-setup-page="${htmlEscape(step.action.page)}">${htmlEscape(step.action.label)}</button>`
    : '';
  const manual = !step.autoComplete && !step.completed
    ? `<button class="link-button" data-complete-step="${htmlEscape(step.id)}">Mark complete</button>`
    : '';
  return `<article class="setup-step ${step.completed ? 'complete' : ''}"><span>${step.completed ? '✓' : '•'}</span><div><strong>${htmlEscape(step.title)}</strong><small>${htmlEscape(step.description)}</small></div><div>${action}${manual}</div></article>`;
}

async function completeSetupStep(stepId) {
  const response = await fetch(`/api/setup/wizard/steps/${stepId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Setup step updated' : result.error || 'Setup step could not be updated');
  if (response.ok) loadSetupWizard();
}

loadSetupWizard();

const messageBody = document.getElementById('messageBody');
if (messageBody) {
  messageBody.addEventListener('input', () => {
    document.getElementById('phoneMessage').textContent = messageBody.value || 'Your message preview will appear here.';
  });
}

const campaignForm = document.getElementById('campaignForm');
if (campaignForm) {
  campaignForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(campaignForm).entries());
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const campaign = await response.json();
    if (!response.ok) {
      showToast(campaign.error || 'Campaign could not be saved');
      return;
    }

    const prepareResponse = await fetch(`/api/campaigns/${campaign.id}/recipients/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const summary = await prepareResponse.json();
    showToast(
      prepareResponse.ok
        ? `Campaign saved: ${summary.eligible} recipients prepared, ${summary.excludedOptOut} excluded`
        : summary.error || 'Campaign saved, but recipients could not be prepared'
    );
  });
}

const addContactBtn = document.getElementById('addContactBtn');
if (addContactBtn) {
  addContactBtn.addEventListener('click', async () => {
    const name = window.prompt('Contact name');
    const phone = name ? window.prompt('WhatsApp number, e.g. +27 82 123 4567') : null;
    if (!name || !phone) return;
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, segment: 'Manual' })
    });
    showToast(response.ok ? 'Contact added' : 'Contact could not be added');
    if (response.ok) loadSetupWizard();
  });
}

const replyForm = document.getElementById('replyForm');
if (replyForm) {
  const inboxConversation = document.getElementById('inboxConversation');
  const inboxList = document.getElementById('inboxList');
  const noteForm = document.getElementById('noteForm');
  const csatForm = document.getElementById('csatForm');
  const typingIndicator = document.getElementById('typingIndicator');
  let activeConversationId = replyForm.dataset.conversationId;
  let typingTimer = null;

  async function loadInboxList() {
    const response = await fetch('/api/inbox/conversations');
    if (!response.ok) return;
    const result = await response.json();
    inboxList.innerHTML = result.conversations.map(renderInboxItem).join('');
    bindInboxItems();
  }

  async function loadConversation(conversationId) {
    if (!conversationId) return;
    const response = await fetch(`/api/inbox/conversations/${conversationId}`);
    if (!response.ok) return;
    const detail = await response.json();
    activeConversationId = String(conversationId);
    inboxConversation.dataset.conversationId = activeConversationId;
    replyForm.dataset.conversationId = activeConversationId;
    noteForm.dataset.conversationId = activeConversationId;
    csatForm.dataset.conversationId = activeConversationId;
    renderConversation(detail);
  }

  function bindInboxItems() {
    document.querySelectorAll('.inbox-item[data-conversation-id]').forEach((button) => {
      button.addEventListener('click', () => loadConversation(button.dataset.conversationId));
    });
  }

  function renderInboxItem(item) {
    const unread = Number(item.unreadCount || 0);
    return `<button class="inbox-item" data-conversation-id="${item.id}"><strong>${item.customerName}</strong><span>${item.lastMessagePreview || ''}</span><small>${item.slaStatus || item.status}</small>${unread ? `<em>${unread}</em>` : ''}</button>`;
  }

  function renderConversation(detail) {
    const conversation = detail.conversation;
    document.getElementById('inboxCustomerName').textContent = conversation.customerName;
    document.getElementById('inboxCustomerMeta').textContent = conversation.customerPhone;
    document.getElementById('inboxSlaBadge').textContent = conversation.slaStatus;
    document.getElementById('inboxAssigned').textContent = conversation.assignedUserName ? `Assigned to ${conversation.assignedUserName}` : 'Unassigned';
    document.getElementById('inboxCsat').textContent = conversation.csatScore ? `CSAT ${conversation.csatScore}/5` : 'No CSAT yet';
    document.getElementById('inboxMessages').innerHTML = detail.messages.map((message) => `<p class="${message.direction === 'outbound' ? 'chat-right' : 'chat-left'}">${escapeHtml(message.body || '')}</p>`).join('');
    document.getElementById('inboxNotes').innerHTML = detail.notes.map((note) => `<article><strong>${escapeHtml(note.authorName || 'Team')}</strong><p>${escapeHtml(note.body)}</p></article>`).join('');
  }

  function refreshActiveConversation(event) {
    if (event?.conversationId && activeConversationId && String(event.conversationId) !== String(activeConversationId)) return;
    loadInboxList();
    loadConversation(activeConversationId);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  bindInboxItems();
  if (activeConversationId) loadConversation(activeConversationId);

  replyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = replyForm.querySelector('input');
    if (!input.value.trim()) return;
    fetch(`/api/inbox/conversations/${activeConversationId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: input.value })
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      showToast(response.ok ? 'Reply queued' : result.error || 'Reply failed');
      if (response.ok) {
        input.value = '';
        loadConversation(activeConversationId);
      }
    });
  });

  replyForm.querySelector('input')?.addEventListener('input', () => {
    if (!activeConversationId || typingTimer) return;
    fetch(`/api/inbox/conversations/${activeConversationId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: true })
    }).catch(() => {});
    typingTimer = window.setTimeout(() => {
      typingTimer = null;
    }, 2500);
  });

  noteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = noteForm.querySelector('input');
    if (!input.value.trim() || !activeConversationId) return;
    const response = await fetch(`/api/inbox/conversations/${activeConversationId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: input.value })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Note added' : result.error || 'Note failed');
    if (response.ok) {
      input.value = '';
      loadConversation(activeConversationId);
    }
  });

  csatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(csatForm).entries());
    if (!payload.score || !activeConversationId) return;
    const response = await fetch(`/api/inbox/conversations/${activeConversationId}/csat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'CSAT saved' : result.error || 'CSAT failed');
    if (response.ok) loadConversation(activeConversationId);
  });

  if (window.EventSource) {
    const source = new EventSource('/api/inbox/events');
    ['conversation.message.received', 'conversation.message.sent', 'conversation.updated', 'conversation.note.created', 'conversation.csat.received', 'conversation.message.status'].forEach((type) => {
      source.addEventListener(type, (event) => refreshActiveConversation(JSON.parse(event.data)));
    });
    source.addEventListener('conversation.typing', (event) => {
      const payload = JSON.parse(event.data);
      if (String(payload.conversationId) !== String(activeConversationId) || !typingIndicator) return;
      typingIndicator.textContent = payload.isTyping && payload.user ? `${payload.user.name} is typing...` : '';
      window.setTimeout(() => {
        typingIndicator.textContent = '';
      }, 3000);
    });
  }
}

const testMessageForm = document.getElementById('testMessageForm');
if (testMessageForm) {
  testMessageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(testMessageForm).entries());
    const response = await fetch('/api/messages/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    showToast(response.ok ? `Message queued (${result.mode})` : result.error || 'Message failed');
    if (response.ok) loadSetupWizard();
  });
}

const metaCredentialsForm = document.getElementById('metaCredentialsForm');
const metaEmbeddedSignupForm = document.getElementById('metaEmbeddedSignupForm');
const metaPhoneRegistrationForm = document.getElementById('metaPhoneRegistrationForm');
const metaOnboardingChecks = document.getElementById('metaOnboardingChecks');
const metaOnboardingStatus = document.getElementById('metaOnboardingStatus');
const launchMetaSignupBtn = document.getElementById('launchMetaSignupBtn');
const metaOnboardingPanel = document.getElementById('metaOnboardingPanel');
let metaAssetHealthChecks = document.getElementById('metaAssetHealthChecks');
let metaWebhookStatus = document.getElementById('metaWebhookStatus');
let subscribeMetaWebhooksBtn = document.getElementById('subscribeMetaWebhooksBtn');
let metaBusinessProfileForm = document.getElementById('metaBusinessProfileForm');
let metaBusinessProfileStatus = document.getElementById('metaBusinessProfileStatus');

if (metaOnboardingPanel && !metaAssetHealthChecks) {
  metaOnboardingPanel.insertAdjacentHTML('afterend', '<article class="panel form-panel" id="metaAssetHealthPanel"><h3>Meta asset health</h3><div class="setup-steps compact" id="metaAssetHealthChecks"><p class="muted-copy">Loading asset health...</p></div><button class="button" id="subscribeMetaWebhooksBtn" type="button">Subscribe webhooks</button><small id="metaWebhookStatus" class="muted-copy">Subscribes the WABA to message and template status events.</small></article>');
  metaAssetHealthChecks = document.getElementById('metaAssetHealthChecks');
  metaWebhookStatus = document.getElementById('metaWebhookStatus');
  subscribeMetaWebhooksBtn = document.getElementById('subscribeMetaWebhooksBtn');
}

if (metaOnboardingPanel && !metaBusinessProfileForm) {
  metaOnboardingPanel.insertAdjacentHTML('beforebegin', '<form class="panel form-panel" id="metaBusinessProfileForm"><h3>WhatsApp Business Profile</h3><p class="muted-copy">Keep the public WhatsApp profile complete and trustworthy.</p><label>About<input name="about" maxlength="139" placeholder="Short public status"></label><label>Description<textarea name="description" maxlength="512" placeholder="What the business does"></textarea></label><label>Email<input name="email" type="email" placeholder="support@example.co.za"></label><label>Address<input name="address" placeholder="City, province, country"></label><label>Websites<textarea name="websites" placeholder="https://example.co.za"></textarea></label><label>Vertical<select name="vertical"><option value="OTHER">Other</option><option value="RETAIL">Retail</option><option value="RESTAURANT">Restaurant</option><option value="BEAUTY">Beauty</option><option value="APPAREL">Apparel</option><option value="GROCERY">Grocery</option><option value="HEALTH">Health</option><option value="PROF_SERVICES">Professional services</option><option value="EDU">Education</option><option value="TRAVEL">Travel</option><option value="AUTO">Auto</option><option value="FINANCE">Finance</option><option value="EVENT_PLAN">Event planning</option></select></label><label>Profile picture handle<input name="profilePictureHandle" placeholder="Upload handle from Meta resumable upload"></label><button class="button primary" type="submit">Save business profile</button><small id="metaBusinessProfileStatus" class="muted-copy">Loading profile completeness...</small></form>');
  metaBusinessProfileForm = document.getElementById('metaBusinessProfileForm');
  metaBusinessProfileStatus = document.getElementById('metaBusinessProfileStatus');
}

async function loadMetaBusinessProfile() {
  if (!metaBusinessProfileForm) return;
  const response = await fetch('/api/integrations/meta/business-profile');
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    if (metaBusinessProfileStatus) metaBusinessProfileStatus.textContent = result?.error || 'Business profile could not load';
    return;
  }
  const profile = result.profile || {};
  metaBusinessProfileForm.about.value = profile.about || '';
  metaBusinessProfileForm.description.value = profile.description || '';
  metaBusinessProfileForm.email.value = profile.email || '';
  metaBusinessProfileForm.address.value = profile.address || '';
  metaBusinessProfileForm.websites.value = (profile.websites || []).join('\n');
  metaBusinessProfileForm.vertical.value = profile.vertical || 'OTHER';
  metaBusinessProfileForm.profilePictureHandle.value = profile.profilePictureHandle || '';
  if (metaBusinessProfileStatus) {
    const missing = result.completeness?.missing?.length ? ` Missing: ${result.completeness.missing.join(', ')}.` : '';
    metaBusinessProfileStatus.textContent = `Profile completeness ${result.completeness?.percent || 0}% (${result.mode}).${missing}`;
  }
}

if (metaBusinessProfileForm) {
  metaBusinessProfileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(metaBusinessProfileForm).entries());
    const response = await fetch('/api/integrations/meta/business-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(result.error || 'Business profile could not be saved');
      if (metaBusinessProfileStatus) metaBusinessProfileStatus.textContent = result.error || 'Business profile could not be saved';
      return;
    }
    showToast(`Business profile saved (${result.mode})`);
    if (metaBusinessProfileStatus) metaBusinessProfileStatus.textContent = `Profile completeness ${result.completeness?.percent || 0}% (${result.mode})`;
    loadSetupWizard();
  });
}

async function loadMetaOnboardingStatus() {
  if (!metaOnboardingChecks) return null;
  const response = await fetch('/api/integrations/meta/onboarding');
  const status = await response.json().catch(() => null);
  if (!response.ok || !status) {
    metaOnboardingChecks.innerHTML = '<p class="muted-copy">Meta onboarding status could not load.</p>';
    if (metaAssetHealthChecks) metaAssetHealthChecks.innerHTML = '<p class="muted-copy">Asset health could not load.</p>';
    if (metaOnboardingStatus) metaOnboardingStatus.textContent = status?.error || 'Status unavailable';
    return null;
  }

  metaOnboardingChecks.innerHTML = status.checks.map(renderMetaCheck).join('');
  if (metaAssetHealthChecks) {
    const assetChecks = status.assetHealth?.checks || [];
    const phone = status.assetHealth?.phone || {};
    metaAssetHealthChecks.innerHTML = [
      phone.verified_name ? `<article class="setup-step complete"><span>✓</span><div><strong>${htmlEscape(phone.verified_name)}</strong><small>${htmlEscape(phone.display_phone_number || phone.id || '')}</small></div></article>` : '',
      ...assetChecks.map(renderMetaCheck)
    ].join('') || '<p class="muted-copy">Connect Meta credentials to load asset health.</p>';
  }
  if (metaOnboardingStatus) {
    metaOnboardingStatus.textContent = status.config.configured
      ? `Embedded Signup ready in ${status.config.mode} mode`
      : 'Set META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID for live launch';
  }
  return status;
}

function renderMetaCheck(check) {
  return `<article class="setup-step ${check.ok ? 'complete' : ''}"><span>${check.ok ? '✓' : '•'}</span><div><strong>${htmlEscape(check.id.replaceAll('_', ' '))}</strong><small>${htmlEscape(check.message)}</small></div></article>`;
}

if (subscribeMetaWebhooksBtn) {
  subscribeMetaWebhooksBtn.addEventListener('click', async () => {
    const response = await fetch('/api/integrations/meta/webhooks/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(result.error || 'Webhook subscription failed');
      if (metaWebhookStatus) metaWebhookStatus.textContent = result.error || 'Webhook subscription failed';
      return;
    }
    showToast(`Webhooks subscribed (${result.mode})`);
    if (metaWebhookStatus) metaWebhookStatus.textContent = `Subscribed ${result.subscribedFields?.join(', ') || 'webhooks'} in ${result.mode} mode`;
    loadSetupWizard();
    loadMetaOnboardingStatus();
  });
}

if (launchMetaSignupBtn) {
  launchMetaSignupBtn.addEventListener('click', async () => {
    const status = await loadMetaOnboardingStatus();
    const config = status?.config;
    if (!config?.configured) {
      showToast('Embedded Signup needs Meta app configuration first');
      return;
    }
    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      config_id: config.configId,
      response_type: config.launchParams.response_type,
      override_default_response_type: String(config.launchParams.override_default_response_type),
      extras: JSON.stringify(config.launchParams.extras)
    });
    window.open(`https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params.toString()}`, '_blank', 'noopener,noreferrer');
  });
}

if (metaEmbeddedSignupForm) {
  metaEmbeddedSignupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(metaEmbeddedSignupForm).entries());
    const response = await fetch('/api/integrations/meta/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(result.error || 'Embedded Signup result could not be saved');
      return;
    }
    showToast(`Embedded Signup saved (${result.mode})`);
    metaEmbeddedSignupForm.reset();
    loadMetaOnboardingStatus();
    loadSetupWizard();
  });
}

if (metaPhoneRegistrationForm) {
  metaPhoneRegistrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(metaPhoneRegistrationForm).entries());
    const response = await fetch('/api/integrations/meta/phone/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    const statusEl = document.getElementById('metaPhoneRegistrationStatus');
    if (!response.ok) {
      showToast(result.error || 'Phone registration failed');
      if (statusEl) statusEl.textContent = result.error || 'Phone registration failed';
      return;
    }
    showToast(`Phone registration ${result.mode}`);
    if (statusEl) statusEl.textContent = result.registered ? `Registered in ${result.mode} mode` : 'Registration response received';
    metaPhoneRegistrationForm.reset();
    loadMetaOnboardingStatus();
    loadSetupWizard();
  });
}

if (metaCredentialsForm) {
  const statusEl = document.getElementById('metaCredentialStatus');

  async function loadMetaCredentials() {
    const response = await fetch('/api/integrations/meta');
    if (!response.ok) return;
    const credentials = await response.json();
    if (!credentials.connected) {
      statusEl.textContent = 'Not connected';
      return;
    }
    metaCredentialsForm.wabaId.value = credentials.wabaId || '';
    metaCredentialsForm.phoneNumberId.value = credentials.phoneNumberId || '';
    metaCredentialsForm.accessToken.placeholder = credentials.accessTokenMasked || 'Saved token';
    metaCredentialsForm.accessToken.required = false;
    metaCredentialsForm.verifyToken.placeholder = credentials.verifyTokenMasked || 'Saved verify token';
    statusEl.textContent = `Connected via ${credentials.status}`;
    loadMetaOnboardingStatus();
  }

  metaCredentialsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(metaCredentialsForm).entries());
    const response = await fetch('/api/integrations/meta', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || 'Credentials could not be saved');
      return;
    }
    metaCredentialsForm.accessToken.value = '';
    metaCredentialsForm.accessToken.required = false;
    statusEl.textContent = `Connected via ${result.status}`;
    showToast('Meta credentials encrypted and saved');
    loadSetupWizard();
    loadMetaOnboardingStatus();
  });

  loadMetaCredentials();
}

loadMetaOnboardingStatus();
loadMetaBusinessProfile();

const markVerificationCompleteBtn = document.getElementById('markVerificationCompleteBtn');
if (markVerificationCompleteBtn) {
  markVerificationCompleteBtn.addEventListener('click', () => completeSetupStep('business_verification'));
}

const teamUserForm = document.getElementById('teamUserForm');
if (teamUserForm) {
  const statusEl = document.getElementById('teamUserStatus');

  teamUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(teamUserForm).entries());
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || 'Team member could not be added');
      return;
    }
    statusEl.textContent = result.temporaryPassword
      ? `Temporary password: ${result.temporaryPassword}`
      : `${result.email} added as ${result.role}`;
    teamUserForm.reset();
    showToast('Team member added');
  });
}

const dataDeletionForm = document.getElementById('dataDeletionForm');
if (dataDeletionForm) {
  const statusEl = document.getElementById('dataDeletionStatus');
  const listEl = document.getElementById('dataDeletionRequests');

  async function loadDeletionRequests() {
    const response = await fetch('/api/compliance/deletion-requests');
    const result = await response.json().catch(() => ({ requests: [] }));
    if (!response.ok) {
      listEl.innerHTML = '<p class="muted-copy">Sign in as an owner or admin to view deletion requests.</p>';
      return;
    }
    listEl.innerHTML = result.requests.length
      ? result.requests.slice(0, 4).map(renderDeletionRequest).join('')
      : '<p class="muted-copy">No deletion requests processed yet.</p>';
  }

  function renderDeletionRequest(request) {
    const counts = request.affectedCounts || {};
    const affected = `contacts ${counts.contacts || 0}, conversations ${counts.conversations || 0}, messages ${counts.messages || 0}`;
    return `<article><strong>${htmlEscape(request.phoneMasked)} · ${htmlEscape(request.status)}</strong><small>${htmlEscape(affected)}</small></article>`;
  }

  dataDeletionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmed = window.confirm('Process this POPIA deletion request? This will redact customer personal data from contacts, inbox messages, notes, and campaign recipients.');
    if (!confirmed) return;
    const payload = Object.fromEntries(new FormData(dataDeletionForm).entries());
    const response = await fetch('/api/compliance/deletion-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(result.error || 'Deletion request failed');
      return;
    }
    statusEl.textContent = `Completed: ${result.phoneMasked}`;
    dataDeletionForm.reset();
    showToast('Deletion request processed');
    loadDeletionRequests();
  });

  loadDeletionRequests();
}

const productForm = document.getElementById('productForm');
if (productForm) {
  const productGrid = document.getElementById('productGrid');
  const orderTableEl = document.getElementById('orderTable');
  const shareCatalogForm = document.getElementById('shareCatalogForm');
  const variantForm = document.getElementById('variantForm');
  const catalogSyncForm = document.getElementById('catalogSyncForm');
  const catalogSyncStatus = document.getElementById('catalogSyncStatus');
  const previewCatalogSyncBtn = document.getElementById('previewCatalogSyncBtn');
  const productImportForm = document.getElementById('productImportForm');
  const productImportStatus = document.getElementById('productImportStatus');
  const previewProductImportBtn = document.getElementById('previewProductImportBtn');
  const collectionForm = document.getElementById('collectionForm');
  const collectionGrid = document.getElementById('collectionGrid');
  const collectionCount = document.getElementById('collectionCount');
  const couponForm = document.getElementById('couponForm');
  const couponGrid = document.getElementById('couponGrid');
  const couponCount = document.getElementById('couponCount');
  const abandonedCartList = document.getElementById('abandonedCartList');
  const abandonedCartCount = document.getElementById('abandonedCartCount');
  const returnRequestList = document.getElementById('returnRequestList');
  const returnRequestCount = document.getElementById('returnRequestCount');
  const customerSegmentList = document.getElementById('customerSegmentList');
  const customerSegmentCount = document.getElementById('customerSegmentCount');
  const commerceAutomationRuleList = document.getElementById('commerceAutomationRuleList');
  const commerceAutomationRuleCount = document.getElementById('commerceAutomationRuleCount');
  const commerceAutomationInsightStrip = document.getElementById('commerceAutomationInsightStrip');
  const commerceAutomationRecommendationList = document.getElementById('commerceAutomationRecommendationList');
  const commerceAutomationActivityList = document.getElementById('commerceAutomationActivityList');
  const inventoryAlertList = document.getElementById('inventoryAlertList');
  const inventoryAlertCount = document.getElementById('inventoryAlertCount');
  const productSubmitBtn = document.getElementById('productSubmitBtn');
  const cancelProductEditBtn = document.getElementById('cancelProductEditBtn');
  const commerceMetrics = document.getElementById('commerceMetrics');
  const orderDetail = document.getElementById('orderDetail');
  let currentProducts = [];

  async function loadCommerce() {
    const [productsResponse, ordersResponse, analyticsResponse, collectionsResponse, inventoryAlertsResponse, couponsResponse, abandonedCartsResponse, returnsResponse, segmentsResponse, automationRulesResponse, automationInsightsResponse] = await Promise.all([
      fetch('/api/commerce/products'),
      fetch('/api/commerce/orders'),
      fetch('/api/commerce/analytics'),
      fetch('/api/commerce/collections'),
      fetch('/api/commerce/inventory-alerts'),
      fetch('/api/commerce/coupons'),
      fetch('/api/commerce/abandoned-carts'),
      fetch('/api/commerce/returns'),
      fetch('/api/commerce/customer-segments'),
      fetch('/api/commerce/automation-rules'),
      fetch('/api/commerce/automation-insights')
    ]);
    const products = await productsResponse.json().catch(() => ({ products: [] }));
    const orders = await ordersResponse.json().catch(() => ({ orders: [] }));
    const analytics = await analyticsResponse.json().catch(() => null);
    const collections = await collectionsResponse.json().catch(() => ({ collections: [] }));
    const inventoryAlerts = await inventoryAlertsResponse.json().catch(() => null);
    const coupons = await couponsResponse.json().catch(() => ({ coupons: [] }));
    const abandonedCarts = await abandonedCartsResponse.json().catch(() => ({ carts: [] }));
    const returns = await returnsResponse.json().catch(() => ({ returns: [] }));
    const segments = await segmentsResponse.json().catch(() => ({ segments: [] }));
    const automationRules = await automationRulesResponse.json().catch(() => ({ rules: [] }));
    const automationInsights = await automationInsightsResponse.json().catch(() => null);
    if (productsResponse.ok) {
      currentProducts = products.products || [];
      productGrid.innerHTML = products.products.length
        ? products.products.map(renderProductCard).join('')
        : '<p class="muted-copy">Add your first product to start selling on WhatsApp.</p>';
      bindProductActions();
    }
    if (analyticsResponse.ok && analytics) {
      renderCommerceMetrics(analytics);
    }
    if (ordersResponse.ok) {
      document.getElementById('commerceOrderCount').textContent = orders.orders.length;
      orderTableEl.innerHTML = renderOrderTable(orders.orders);
      bindOrderActions();
    }
    if (collectionsResponse.ok) {
      renderCollections(collections.collections || []);
    }
    if (inventoryAlertsResponse.ok && inventoryAlerts) {
      renderInventoryAlerts(inventoryAlerts);
    }
    if (couponsResponse.ok) {
      renderCoupons(coupons.coupons || []);
    }
    if (abandonedCartsResponse.ok) {
      renderAbandonedCarts(abandonedCarts.carts || []);
    }
    if (returnsResponse.ok) {
      renderReturnRequests(returns.returns || []);
    }
    if (segmentsResponse.ok) {
      renderCustomerSegments(segments);
    }
    if (automationRulesResponse.ok) {
      renderAutomationRules(automationRules.rules || [], automationInsights);
    }
    loadCatalogSyncPreview();
  }

  function renderCommerceMetrics(analytics) {
    const summary = analytics.summary || {};
    commerceMetrics.innerHTML = [
      renderMetric('Products', summary.activeProducts || 0, `${summary.products || 0} total catalogue items`),
      renderMetric('Orders', summary.orders || 0, `${summary.pendingPayment || 0} awaiting payment`),
      renderMetric('Revenue', `R ${summary.totalRevenue || '0.00'}`, `${summary.paidOrders || 0} paid orders`),
      renderMetric('Stock alerts', summary.lowStock || 0, 'Products at 5 units or fewer')
    ].join('');
  }

  function renderMetric(label, value, detail) {
    return `<article class="metric"><small>${htmlEscape(label)}</small><strong>${htmlEscape(value)}</strong><span>${htmlEscape(detail)}</span></article>`;
  }

  function renderProductCard(product) {
    const image = product.imageUrl
      ? `<img src="${htmlEscape(product.imageUrl)}" alt="">`
      : '<span>Product</span>';
    return `<article class="product-card" data-product-id="${htmlEscape(product.id)}"><div class="product-thumb">${image}</div><div><small>#${htmlEscape(product.id)} · ${htmlEscape(product.sku || product.metaProductRetailerId || 'SKU')}</small><h4>${htmlEscape(product.name)}</h4><p>${htmlEscape(product.description || 'Ready to share in WhatsApp.')}</p><p class="muted-copy">Stock ${Number(product.inventoryCount || 0)} · Retailer ${htmlEscape(product.metaProductRetailerId || product.sku || 'not set')}</p><div class="commerce-row-actions"><button class="link-button" data-product-edit="${htmlEscape(product.id)}" type="button">Edit</button><button class="link-button" data-product-archive="${htmlEscape(product.id)}" type="button">Archive</button></div></div><strong>R ${htmlEscape(product.price)}</strong><span class="status">${htmlEscape(product.status)}</span></article>`;
  }

  function bindProductActions() {
    document.querySelectorAll('[data-product-edit]').forEach((button) => {
      button.addEventListener('click', () => fillProductForm(button.dataset.productEdit));
    });
    document.querySelectorAll('[data-product-archive]').forEach((button) => {
      button.addEventListener('click', () => archiveProductFromCard(button.dataset.productArchive));
    });
  }

  function fillProductForm(productId) {
    const product = currentProducts.find((item) => String(item.id) === String(productId));
    if (!product) return;
    productForm.productId.value = product.id;
    productForm.name.value = product.name || '';
    productForm.sku.value = product.sku || '';
    productForm.price.value = product.price || '';
    productForm.inventoryCount.value = product.inventoryCount || 0;
    productForm.imageUrl.value = product.imageUrl || '';
    productForm.metaCatalogId.value = product.metaCatalogId || '';
    productForm.metaProductRetailerId.value = product.metaProductRetailerId || '';
    productForm.paymentLinkUrl.value = product.paymentLinkUrl || '';
    productForm.status.value = product.status || 'active';
    productForm.description.value = product.description || '';
    if (productSubmitBtn) productSubmitBtn.textContent = `Update #${product.id}`;
    productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetProductForm() {
    productForm.reset();
    productForm.productId.value = '';
    if (productSubmitBtn) productSubmitBtn.textContent = 'Save product';
  }

  async function archiveProductFromCard(productId) {
    const confirmed = window.confirm('Archive this product? It will stop appearing in active catalogue shares.');
    if (!confirmed) return;
    const response = await fetch(`/api/commerce/products/${encodeURIComponent(productId)}/archive`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Product archived' : result.error || 'Product could not be archived');
    if (response.ok) loadCommerce();
  }

  function renderOrderTable(orders) {
    if (!orders.length) return '<p class="muted-copy">WhatsApp catalogue orders will appear here.</p>';
    const rows = orders.map((order) => `<tr><td>${htmlEscape(order.customerName)}<br><small>${htmlEscape(order.customerPhone)}</small></td><td><span class="status">${htmlEscape(order.status)}</span></td><td>${Number(order.itemCount || 0)}</td><td>R ${htmlEscape(order.total)}${order.discountCode ? `<br><small>${htmlEscape(order.discountCode)} saved R ${htmlEscape(order.discount || '0.00')}</small>` : ''}</td><td>${htmlEscape(order.source)}</td><td><div class="commerce-row-actions"><button class="link-button" data-commerce-order="${htmlEscape(order.id)}" type="button">View</button><button class="link-button" data-commerce-pay="${htmlEscape(order.id)}" type="button">Pay link</button><button class="link-button" data-commerce-status="${htmlEscape(order.id)}" type="button">Update</button><button class="link-button" data-commerce-fulfil="${htmlEscape(order.id)}" type="button">Fulfil</button><button class="link-button" data-commerce-coupon="${htmlEscape(order.id)}" type="button">Coupon</button><button class="link-button" data-commerce-recover="${htmlEscape(order.id)}" type="button">Recover</button><button class="link-button" data-commerce-reconcile="${htmlEscape(order.id)}" type="button">Reconcile</button><button class="link-button" data-commerce-return="${htmlEscape(order.id)}" type="button">Return</button><button class="link-button" data-commerce-post-purchase="${htmlEscape(order.id)}" type="button">Post-sale</button><button class="link-button" data-commerce-schedule-post-purchase="${htmlEscape(order.id)}" type="button">Schedule</button></div></td></tr>`).join('');
    return `<table><thead><tr><th>Customer</th><th>Status</th><th>Items</th><th>Total</th><th>Source</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCollections(collections) {
    if (collectionCount) collectionCount.textContent = collections.length;
    if (!collectionGrid) return;
    collectionGrid.innerHTML = collections.length
      ? collections.map(renderCollectionCard).join('')
      : '<p class="muted-copy">Create a collection to share a focused product set.</p>';
    document.querySelectorAll('[data-collection-share]').forEach((button) => {
      button.addEventListener('click', () => shareCollection(button.dataset.collectionShare));
    });
  }

  function renderCollectionCard(collection) {
    const retailerIds = (collection.retailerIds || []).slice(0, 4).join(', ');
    return `<article class="collection-card"><div><small>${Number(collection.productCount || 0)} product(s)</small><h4>${htmlEscape(collection.name)}</h4><p>${htmlEscape(collection.description || 'Ready to share on WhatsApp.')}</p><p class="muted-copy">${htmlEscape(retailerIds || 'No retailer IDs yet')}</p></div><button class="button" data-collection-share="${htmlEscape(collection.id)}" type="button">Share</button></article>`;
  }

  async function shareCollection(collectionId) {
    const to = window.prompt('Customer WhatsApp number', '27821234567');
    if (!to) return;
    const response = await fetch(`/api/commerce/collections/${encodeURIComponent(collectionId)}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Collection queued (${result.mode})` : result.error || 'Collection could not be shared');
  }

  function bindOrderActions() {
    document.querySelectorAll('[data-commerce-order]').forEach((button) => {
      button.addEventListener('click', () => loadOrderDetail(button.dataset.commerceOrder));
    });
    document.querySelectorAll('[data-commerce-pay]').forEach((button) => {
      button.addEventListener('click', () => createAndSendPaymentLink(button.dataset.commercePay));
    });
    document.querySelectorAll('[data-commerce-status]').forEach((button) => {
      button.addEventListener('click', () => updateOrderFromPrompt(button.dataset.commerceStatus));
    });
    document.querySelectorAll('[data-commerce-fulfil]').forEach((button) => {
      button.addEventListener('click', () => fulfilOrderFromPrompt(button.dataset.commerceFulfil));
    });
    document.querySelectorAll('[data-commerce-coupon]').forEach((button) => {
      button.addEventListener('click', () => applyCouponFromPrompt(button.dataset.commerceCoupon));
    });
    document.querySelectorAll('[data-commerce-recover]').forEach((button) => {
      button.addEventListener('click', () => recoverCart(button.dataset.commerceRecover));
    });
    document.querySelectorAll('[data-commerce-reconcile]').forEach((button) => {
      button.addEventListener('click', () => reconcilePaymentFromPrompt(button.dataset.commerceReconcile));
    });
    document.querySelectorAll('[data-commerce-return]').forEach((button) => {
      button.addEventListener('click', () => createReturnFromPrompt(button.dataset.commerceReturn));
    });
    document.querySelectorAll('[data-commerce-post-purchase]').forEach((button) => {
      button.addEventListener('click', () => sendPostPurchaseFromPrompt(button.dataset.commercePostPurchase));
    });
    document.querySelectorAll('[data-commerce-schedule-post-purchase]').forEach((button) => {
      button.addEventListener('click', () => schedulePostPurchaseFromPrompt(button.dataset.commerceSchedulePostPurchase));
    });
  }

  function renderInventoryAlerts(alerts) {
    const items = [...(alerts.outOfStock || []), ...(alerts.lowStock || [])];
    if (inventoryAlertCount) inventoryAlertCount.textContent = alerts.summary?.alertCount || 0;
    if (!inventoryAlertList) return;
    inventoryAlertList.innerHTML = items.length
      ? items.map((product) => `<article><strong>${htmlEscape(product.name)}</strong><span>${Number(product.inventoryCount || 0)} in stock</span><small>${htmlEscape(product.sku || product.metaProductRetailerId || '')}</small></article>`).join('')
      : '<p class="muted-copy">No inventory alerts right now.</p>';
  }

  function renderCoupons(coupons) {
    if (couponCount) couponCount.textContent = coupons.length;
    if (!couponGrid) return;
    couponGrid.innerHTML = coupons.length
      ? coupons.map((coupon) => {
        const value = coupon.discountType === 'fixed' ? `R ${(Number(coupon.discountValue || 0) / 100).toFixed(2)}` : `${Number(coupon.discountValue || 0)}%`;
        return `<article><strong>${htmlEscape(coupon.code)}</strong><span>${htmlEscape(value)} off</span><small>${Number(coupon.redeemedCount || 0)} redeemed · ${htmlEscape(coupon.status)}</small></article>`;
      }).join('')
      : '<p class="muted-copy">Create WhatsApp-only offers and apply them to orders.</p>';
  }

  function renderAbandonedCarts(carts) {
    if (abandonedCartCount) abandonedCartCount.textContent = carts.length;
    if (!abandonedCartList) return;
    abandonedCartList.innerHTML = carts.length
      ? carts.map((cart) => {
        const lastRecovery = cart.lastRecoverySentAt ? `Last recovery ${htmlEscape(formatShortDate(cart.lastRecoverySentAt))}` : 'No recovery sent';
        return `<article><div><strong>${htmlEscape(cart.customerName)}</strong><span>R ${htmlEscape(cart.total)} · ${htmlEscape(cart.status)}</span><small>${htmlEscape(cart.customerPhone)} · ${Number(cart.recoveryCount || 0)} attempt(s) · ${lastRecovery}</small></div><button class="button" data-commerce-recover="${htmlEscape(cart.id)}" type="button">Recover</button></article>`;
      }).join('')
      : '<p class="muted-copy">No recoverable carts right now.</p>';
    abandonedCartList.querySelectorAll('[data-commerce-recover]').forEach((button) => {
      button.addEventListener('click', () => recoverCart(button.dataset.commerceRecover));
    });
  }

  function renderReturnRequests(requests) {
    if (returnRequestCount) returnRequestCount.textContent = requests.length;
    if (!returnRequestList) return;
    returnRequestList.innerHTML = requests.length
      ? requests.map((request) => `<article><div><strong>#${htmlEscape(request.id)} · Order #${htmlEscape(request.orderId)}</strong><span>R ${htmlEscape(request.amount)} · ${htmlEscape(request.status)}</span><small>${htmlEscape(request.customerName || request.customerPhone || 'WhatsApp customer')} · ${htmlEscape(request.reason)}</small></div><button class="button" data-return-update="${htmlEscape(request.id)}" type="button">Update</button></article>`).join('')
      : '<p class="muted-copy">No return or refund requests yet.</p>';
    returnRequestList.querySelectorAll('[data-return-update]').forEach((button) => {
      button.addEventListener('click', () => updateReturnFromPrompt(button.dataset.returnUpdate));
    });
  }

  function renderCustomerSegments(result) {
    const segments = result.segments || [];
    if (customerSegmentCount) customerSegmentCount.textContent = result.summary?.customers || 0;
    if (!customerSegmentList) return;
    customerSegmentList.innerHTML = segments.length
      ? segments.map((segment) => `<article><strong>${htmlEscape(segment.label)}</strong><span>${Number(segment.count || 0)} customer(s)</span><small>${htmlEscape((segment.customers || []).slice(0, 3).map((customer) => `${customer.customerName} · R ${customer.lifetimeValue}`).join(' | ') || 'No customers yet')}</small></article>`).join('')
      : '<p class="muted-copy">Buyer segments will appear after orders are created.</p>';
  }

  function renderAutomationRules(rules, insights = null) {
    if (commerceAutomationRuleCount) commerceAutomationRuleCount.textContent = rules.filter((rule) => rule.enabled).length;
    const metricRules = insights?.rules || [];
    const metricsByRule = new Map(metricRules.map((rule) => [rule.ruleKey, rule.metrics || {}]));
    if (commerceAutomationInsightStrip) {
      const summary = insights?.summary || {};
      const roi = summary.roi === null || summary.roi === undefined ? '--' : `${Number(summary.roi).toFixed(2)}x`;
      commerceAutomationInsightStrip.innerHTML = `<span>Scheduled ${Number(summary.scheduled || 0)}</span><span>Sent ${Number(summary.sent || 0)}</span><span>Revenue R ${htmlEscape(summary.attributedRevenue || '0.00')}</span><span>Cost R ${htmlEscape(summary.estimatedCost || '0.00')}</span><span>ROI ${htmlEscape(roi)}</span><span>Rate ${Number(summary.sendRate || 0)}%</span>`;
    }
    if (commerceAutomationRecommendationList) {
      const recommendations = insights?.recommendations || [];
      commerceAutomationRecommendationList.innerHTML = recommendations.length
        ? recommendations.map((item) => `<article><strong>${htmlEscape(item.action)}</strong><span>${htmlEscape(item.priority || 'low')}</span><small>${htmlEscape(item.message || '')}</small></article>`).join('')
        : '<p class="muted-copy">Automation recommendations will appear after activity.</p>';
    }
    if (commerceAutomationActivityList) {
      renderAutomationActivity(insights?.recent || []);
    }
    if (!commerceAutomationRuleList) return;
    commerceAutomationRuleList.innerHTML = rules.length
      ? rules.map((rule) => {
        const metrics = metricsByRule.get(rule.ruleKey) || {};
        const roi = metrics.roi === null || metrics.roi === undefined ? '--' : `${Number(metrics.roi).toFixed(2)}x`;
        return `<article><div><strong>${htmlEscape(rule.name)}</strong><span>${htmlEscape(rule.triggerStatus)} · ${htmlEscape(rule.promptType)}</span><small>${htmlEscape(rule.description || '')}</small><small>${Number(rule.delayValue || 0)} ${htmlEscape(rule.delayUnit || 'hours')} delay · ${rule.enabled ? 'enabled' : 'paused'}</small><small>${Number(metrics.scheduled || 0)} scheduled · ${Number(metrics.sent || 0)} sent · ${Number(metrics.attributedOrders || 0)} order(s)</small><small>R ${htmlEscape(metrics.attributedRevenue || '0.00')} revenue · R ${htmlEscape(metrics.estimatedCost || '0.00')} cost · ROI ${htmlEscape(roi)}</small><small>${htmlEscape(rule.recommendation?.action || 'Monitor')}: ${htmlEscape(rule.recommendation?.message || 'Let this automation gather more activity.')}</small></div><div class="commerce-row-actions"><button class="link-button" data-automation-preview="${htmlEscape(rule.ruleKey)}" type="button">Preview</button><button class="link-button" data-automation-apply-ready="${htmlEscape(rule.ruleKey)}" type="button">Apply ready</button><button class="link-button" data-automation-toggle="${htmlEscape(rule.ruleKey)}" data-enabled="${rule.enabled ? 'true' : 'false'}" type="button">${rule.enabled ? 'Pause' : 'Enable'}</button><button class="link-button" data-automation-delay="${htmlEscape(rule.ruleKey)}" data-delay-value="${htmlEscape(rule.delayValue)}" data-delay-unit="${htmlEscape(rule.delayUnit)}" type="button">Tune</button></div></article>`;
      }).join('')
      : '<p class="muted-copy">Post-purchase automation rules will appear here.</p>';
    commerceAutomationRuleList.querySelectorAll('[data-automation-preview]').forEach((button) => {
      button.addEventListener('click', () => previewAutomationRule(button.dataset.automationPreview));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-apply-ready]').forEach((button) => {
      button.addEventListener('click', () => applyReadyAutomationRule(button.dataset.automationApplyReady));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-toggle]').forEach((button) => {
      button.addEventListener('click', () => updateAutomationRule(button.dataset.automationToggle, {
        enabled: button.dataset.enabled !== 'true'
      }));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-delay]').forEach((button) => {
      button.addEventListener('click', () => tuneAutomationRule(button));
    });
  }

  function renderAutomationActivity(events) {
    commerceAutomationActivityList.innerHTML = events.length
      ? events.map((event) => {
        const label = automationActivityLabel(event);
        const detail = automationActivityDetail(event);
        return `<article><strong>${htmlEscape(label)}</strong><span>${htmlEscape(event.ruleKey || '')}</span><small>${htmlEscape(detail)}</small></article>`;
      }).join('')
      : '<p class="muted-copy">Automation activity will appear here.</p>';
  }

  function automationActivityLabel(event) {
    if (event.type === 'attributed_order') return `Attributed order #${event.orderId}`;
    if (event.type === 'sent') return `${event.promptType || 'Prompt'} sent`;
    if (event.type === 'scheduled') return `${event.promptType || 'Prompt'} scheduled`;
    return event.type || 'Automation event';
  }

  function automationActivityDetail(event) {
    const parts = [
      event.occurredAt ? formatShortDate(event.occurredAt) : '',
      event.revenue ? `R ${event.revenue}` : '',
      event.deduped ? 'deduped' : '',
      event.mode ? event.mode : ''
    ].filter(Boolean);
    return parts.join(' · ') || `Order #${event.orderId || '-'}`;
  }

  async function previewAutomationRule(ruleKey) {
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/preview`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || 'Automation preview could not load');
    const orders = (result.orders || []).slice(0, 5).map((order) => `#${order.id} ${order.customerName} R ${order.total}${order.alreadyScheduled ? ' already scheduled' : ''}`);
    window.alert([
      `${result.rule?.name || ruleKey}`,
      `${Number(result.summary?.readyToSchedule || 0)} ready to schedule`,
      `${Number(result.summary?.alreadyScheduled || 0)} already scheduled`,
      `${Number(result.summary?.matchingOrders || 0)} matching order(s)`,
      ...orders
    ].join('\n'));
  }

  async function applyReadyAutomationRule(ruleKey) {
    const confirmed = window.confirm('Schedule this automation for all currently ready orders?');
    if (!confirmed) return;
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/apply-ready`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `${Number(result.summary?.scheduled || 0)} automation prompt(s) scheduled` : result.error || 'Automation could not be applied');
    if (response.ok) loadCommerce();
  }

  async function tuneAutomationRule(button) {
    const delayValue = window.prompt('Delay value', button.dataset.delayValue || '2');
    if (delayValue === null) return;
    const delayUnit = window.prompt('Delay unit: minutes, hours, or days', button.dataset.delayUnit || 'hours');
    if (!delayUnit) return;
    await updateAutomationRule(button.dataset.automationDelay, { delayValue, delayUnit });
  }

  async function updateAutomationRule(ruleKey, payload) {
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Automation rule updated' : result.error || 'Automation rule could not be updated');
    if (response.ok) loadCommerce();
  }

  async function loadOrderDetail(orderId) {
    const response = await fetch(`/api/commerce/orders/${orderId}`);
    const detail = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(detail.error || 'Order could not load');
    orderDetail.innerHTML = renderOrderDetail(detail);
  }

  function renderOrderDetail(order) {
    const items = (order.items || []).map((item) => `<li>${Number(item.quantity || 1)} x ${htmlEscape(item.productName || item.sku)} · R ${htmlEscape(item.unitPrice || '0.00')}</li>`).join('');
    const events = (order.events || []).slice(0, 5).map((event) => `<li>${htmlEscape(event.eventType)} ${event.status ? `· ${htmlEscape(event.status)}` : ''}<small>${htmlEscape(event.note || '')}</small></li>`).join('');
    const fulfilment = order.trackingNumber || order.fulfilmentProvider || order.trackingUrl
      ? `<p>${htmlEscape(order.fulfilmentProvider || 'Fulfilment')} ${order.trackingNumber ? `· ${htmlEscape(order.trackingNumber)}` : ''} ${order.trackingUrl ? `· ${htmlEscape(order.trackingUrl)}` : ''}</p>`
      : '';
    const discount = order.discountCode ? `<p>Coupon ${htmlEscape(order.discountCode)} saved R ${htmlEscape(order.discount || '0.00')} from subtotal R ${htmlEscape(order.subtotal || order.total)}</p>` : '';
    return `<article><header><h4>Order #${htmlEscape(order.id)}</h4><span class="status">${htmlEscape(order.status)}</span></header><p>${htmlEscape(order.customerName)} · ${htmlEscape(order.customerPhone)}</p><p><strong>R ${htmlEscape(order.total)}</strong> ${order.paymentReady ? '· payment link ready' : '· no payment link yet'}</p>${discount}${fulfilment}<ul>${items || '<li>No line items found.</li>'}</ul><h4>Timeline</h4><ul>${events || '<li>No events yet.</li>'}</ul></article>`;
  }

  async function loadCatalogSyncPreview() {
    if (!catalogSyncStatus) return;
    const params = new URLSearchParams();
    if (catalogSyncForm?.catalogId?.value) params.set('catalogId', catalogSyncForm.catalogId.value);
    if (catalogSyncForm?.includeVariants && !catalogSyncForm.includeVariants.checked) params.set('includeVariants', 'false');
    const response = await fetch(`/api/commerce/catalog-sync/preview${params.toString() ? `?${params}` : ''}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      catalogSyncStatus.innerHTML = `<p class="muted-copy">${htmlEscape(result.error || 'Catalog sync preview could not load')}</p>`;
      return;
    }
    renderCatalogSyncStatus(result);
  }

  function renderCatalogSyncStatus(result) {
    const checks = (result.checks || []).map((check) => {
      const icon = check.ok ? 'OK' : 'Fix';
      return `<li><strong>${htmlEscape(icon)}</strong> ${htmlEscape(check.label)}<small>${htmlEscape(check.detail || '')}</small></li>`;
    }).join('');
    catalogSyncStatus.innerHTML = `<p><strong>${result.ready ? 'Ready to sync' : 'Needs attention'}</strong> · ${Number(result.itemCount || 0)} item(s) · ${htmlEscape(result.mode || 'mock')}</p><ul>${checks}</ul><details><summary>Meta batch payload</summary><pre>${htmlEscape(JSON.stringify(result.batchPayload || {}, null, 2))}</pre></details>`;
  }

  async function runProductImportPreview(commit = false) {
    if (!productImportForm || !productImportStatus) return;
    const payload = Object.fromEntries(new FormData(productImportForm).entries());
    payload.commit = commit;
    const response = await fetch('/api/commerce/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      productImportStatus.textContent = result.error || 'Product import could not run';
      return;
    }
    renderProductImportStatus(result);
    showToast(commit ? `Imported ${result.imported} product(s)` : `${result.validRows} product(s) ready to import`);
    if (commit) loadCommerce();
  }

  function renderProductImportStatus(result) {
    const errors = (result.errors || []).slice(0, 5).map((error) => `Row ${error.row}: ${error.message}`).join('; ');
    productImportStatus.textContent = `${result.commit ? 'Imported' : 'Preview'}: ${result.validRows} valid of ${result.totalRows} row(s), ${result.duplicates} duplicate(s), ${result.errors?.length || 0} error(s).${errors ? ` ${errors}` : ''}`;
  }

  async function createAndSendPaymentLink(orderId) {
    const provider = window.prompt('Payment provider: payfast, yoco, ozow, or payment_link', 'payfast');
    if (!provider) return;
    const response = await fetch(`/api/commerce/orders/${orderId}/payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || 'Payment link could not be created');
    const sendNow = window.confirm('Payment link created. Send it to the customer on WhatsApp now?');
    if (sendNow) {
      const sendResponse = await fetch(`/api/commerce/orders/${orderId}/send-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const sent = await sendResponse.json().catch(() => ({}));
      showToast(sendResponse.ok ? `Payment link queued (${sent.mode})` : sent.error || 'Payment link was created but not sent');
    } else {
      showToast('Payment link created');
    }
    loadCommerce();
    loadOrderDetail(orderId);
  }

  async function updateOrderFromPrompt(orderId) {
    const status = window.prompt('New status: new, confirmed, pending_payment, paid, packed, out_for_delivery, completed, cancelled, refunded', 'paid');
    if (!status) return;
    const sendWhatsApp = window.confirm('Send this order status update on WhatsApp?');
    const response = await fetch(`/api/commerce/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, sendWhatsApp })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Order status updated' : result.error || 'Order could not be updated');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function fulfilOrderFromPrompt(orderId) {
    const provider = window.prompt('Courier or fulfilment provider', 'Courier');
    if (provider === null) return;
    const trackingNumber = window.prompt('Tracking number', '');
    if (trackingNumber === null) return;
    const trackingUrl = window.prompt('Tracking URL', '');
    if (trackingUrl === null) return;
    const sendWhatsApp = window.confirm('Send this tracking update on WhatsApp?');
    const response = await fetch(`/api/commerce/orders/${orderId}/fulfilment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, trackingNumber, trackingUrl, sendWhatsApp })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Fulfilment updated' : result.error || 'Fulfilment could not be updated');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function applyCouponFromPrompt(orderId) {
    const code = window.prompt('Coupon code', 'WINTER10');
    if (!code) return;
    const response = await fetch(`/api/commerce/orders/${orderId}/coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Coupon applied: R ${result.discount || '0.00'} saved` : result.error || 'Coupon could not be applied');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function recoverCart(orderId) {
    const customBody = window.prompt('Recovery message', '');
    if (customBody === null) return;
    const response = await fetch(`/api/commerce/orders/${orderId}/recover-cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: customBody })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Recovery queued (${result.mode})` : result.error || 'Cart recovery could not be sent');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function reconcilePaymentFromPrompt(orderId) {
    const provider = window.prompt('Payment provider', 'payfast');
    if (!provider) return;
    const amount = window.prompt('Paid amount in ZAR', '');
    if (!amount) return;
    const providerPaymentId = window.prompt('Provider payment/reference ID', '');
    if (providerPaymentId === null) return;
    const response = await fetch(`/api/commerce/orders/${orderId}/reconcile-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, amount, providerPaymentId, paymentStatus: 'COMPLETE' })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok && result.status === 'processed' ? 'Payment reconciled' : result.error || result.reason || 'Payment could not be reconciled');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function createReturnFromPrompt(orderId) {
    const reason = window.prompt('Return reason', 'Customer requested a refund');
    if (!reason) return;
    const amount = window.prompt('Refund/return amount in ZAR', '');
    if (amount === null) return;
    const resolution = window.prompt('Resolution: refund, exchange, or store_credit', 'refund');
    if (!resolution) return;
    const sendWhatsApp = window.confirm('Notify the customer on WhatsApp?');
    const response = await fetch(`/api/commerce/orders/${orderId}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, amount, resolution, sendWhatsApp })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Return request opened' : result.error || 'Return could not be opened');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function updateReturnFromPrompt(returnId) {
    const status = window.prompt('Return status: requested, approved, rejected, item_received, refunded, closed', 'approved');
    if (!status) return;
    const refundReference = window.prompt('Refund/reference ID', '');
    if (refundReference === null) return;
    const note = window.prompt('Internal note', '');
    if (note === null) return;
    const sendWhatsApp = window.confirm('Notify the customer on WhatsApp?');
    const response = await fetch(`/api/commerce/returns/${returnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, refundReference, note, sendWhatsApp })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Return updated' : result.error || 'Return could not be updated');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(result.orderId);
    }
  }

  async function sendPostPurchaseFromPrompt(orderId) {
    const promptType = window.prompt('Prompt type: review, reorder, or follow_up', 'review');
    if (!promptType) return;
    const customBody = window.prompt('Custom WhatsApp message, or leave blank for default', '');
    if (customBody === null) return;
    const response = await fetch(`/api/commerce/orders/${orderId}/post-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptType, body: customBody })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Post-sale prompt queued (${result.mode})` : result.error || 'Post-sale prompt could not be sent');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  async function schedulePostPurchaseFromPrompt(orderId) {
    const triggersText = window.prompt('Schedule prompts: review, reorder, follow_up', 'review,reorder,follow_up');
    if (!triggersText) return;
    const triggers = triggersText.split(',').map((item) => item.trim()).filter(Boolean);
    const response = await fetch(`/api/commerce/orders/${orderId}/schedule-post-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggers })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `${result.scheduled?.length || 0} post-sale prompt(s) scheduled` : result.error || 'Post-sale prompts could not be scheduled');
    if (response.ok) {
      loadCommerce();
      loadOrderDetail(orderId);
    }
  }

  function formatShortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(productForm).entries());
    const productId = payload.productId;
    delete payload.productId;
    const response = await fetch(productId ? `/api/commerce/products/${encodeURIComponent(productId)}` : '/api/commerce/products', {
      method: productId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? (productId ? 'Product updated' : 'Product saved') : result.error || 'Product could not be saved');
    if (response.ok) {
      resetProductForm();
      loadCommerce();
    }
  });

  cancelProductEditBtn?.addEventListener('click', resetProductForm);

  shareCatalogForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(shareCatalogForm).entries());
    const response = await fetch('/api/commerce/share-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Catalogue queued (${result.mode})` : result.error || 'Catalogue could not be sent');
  });

  variantForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(variantForm).entries());
    const productId = payload.productId;
    delete payload.productId;
    const response = await fetch(`/api/commerce/products/${encodeURIComponent(productId)}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Variant saved' : result.error || 'Variant could not be saved');
    if (response.ok) variantForm.reset();
  });

  previewCatalogSyncBtn?.addEventListener('click', loadCatalogSyncPreview);

  catalogSyncForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(catalogSyncForm);
    const payload = Object.fromEntries(formData.entries());
    payload.includeVariants = catalogSyncForm.includeVariants.checked;
    const response = await fetch('/api/commerce/catalog-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? `Catalog sync ready (${result.mode})` : result.error || 'Catalog sync could not run');
    if (response.ok) renderCatalogSyncStatus({ ...result, ready: true, checks: [] });
    if (!response.ok) loadCatalogSyncPreview();
  });

  previewProductImportBtn?.addEventListener('click', () => runProductImportPreview(false));

  productImportForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runProductImportPreview(true);
  });

  collectionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(collectionForm).entries());
    const response = await fetch('/api/commerce/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Collection saved' : result.error || 'Collection could not be saved');
    if (response.ok) {
      collectionForm.reset();
      loadCommerce();
    }
  });

  couponForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(couponForm).entries());
    const response = await fetch('/api/commerce/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Coupon saved' : result.error || 'Coupon could not be saved');
    if (response.ok) {
      couponForm.reset();
      loadCommerce();
    }
  });

  document.getElementById('refreshCommerceBtn')?.addEventListener('click', loadCommerce);
  loadCommerce();
}

const insightSummary = document.getElementById('insightSummary');
if (insightSummary) {
  const insightChart = document.getElementById('insightChart');
  const insightActions = document.getElementById('insightActions');
  const insightCampaigns = document.getElementById('insightCampaigns');
  const insightStatus = document.getElementById('insightStatus');
  const insightCost = document.getElementById('insightCost');

  async function loadInsights() {
    insightStatus.textContent = 'Loading';
    const [overviewResponse, costsResponse] = await Promise.all([
      fetch('/api/analytics/overview'),
      fetch('/api/analytics/costs')
    ]);
    const overview = await overviewResponse.json().catch(() => null);
    const costs = await costsResponse.json().catch(() => null);

    if (!overviewResponse.ok || !overview) {
      insightStatus.textContent = 'Unavailable';
      insightSummary.innerHTML = '<article class="metric"><small>Insights</small><strong>--</strong><span>Sign in to load analytics</span></article>';
      insightActions.innerHTML = `<p class="muted-copy">${htmlEscape(overview?.error || 'Analytics could not load.')}</p>`;
      insightCampaigns.innerHTML = '';
      insightChart.innerHTML = '';
      return;
    }

    const summary = overview.summary || {};
    const campaigns = Array.isArray(overview.campaigns) ? overview.campaigns : [];
    insightStatus.textContent = `${campaigns.length} campaigns`;
    insightSummary.innerHTML = [
      renderInsightMetric('Sent', summary.sent || 0, `${summary.campaigns || 0} campaigns`),
      renderInsightMetric('Delivered', summary.delivered || 0, `${summary.deliveryRate || '0%'} delivery`),
      renderInsightMetric('Read rate', summary.readRate || '0%', `${summary.read || 0} reads`),
      renderInsightMetric('Replies', summary.replies || 0, `${summary.replyRate || '0%'} reply rate`)
    ].join('');

    renderInsightChart(campaigns);
    renderInsightCampaigns(campaigns);
    renderInsightActions({ summary, campaigns, costs, costsOk: costsResponse.ok });
  }

  function renderInsightMetric(label, value, detail) {
    return `<article class="metric"><small>${htmlEscape(label)}</small><strong>${htmlEscape(value)}</strong><span>${htmlEscape(detail)}</span></article>`;
  }

  function renderInsightChart(campaigns) {
    if (!campaigns.length) {
      insightChart.innerHTML = '<p class="muted-copy">No campaign delivery data yet.</p>';
      return;
    }
    const maxDelivered = Math.max(...campaigns.map((campaign) => Number(campaign.delivered || 0)), 1);
    insightChart.innerHTML = campaigns
      .slice(0, 8)
      .map((campaign) => {
        const height = Math.max(8, Math.round((Number(campaign.delivered || 0) / maxDelivered) * 100));
        return `<span title="${htmlEscape(campaign.name)}: ${Number(campaign.delivered || 0)} delivered" style="height:${height}%"><small>${htmlEscape(String(campaign.name || '').slice(0, 8))}</small></span>`;
      })
      .join('');
  }

  function renderInsightCampaigns(campaigns) {
    if (!campaigns.length) {
      insightCampaigns.innerHTML = '<p class="muted-copy">Create and dispatch a campaign to see ranking data.</p>';
      return;
    }
    const rows = campaigns
      .slice()
      .sort((a, b) => Number(b.read || 0) - Number(a.read || 0))
      .slice(0, 8)
      .map((campaign) => `<tr><td>${htmlEscape(campaign.name)}</td><td>${htmlEscape(campaign.category)}</td><td>${Number(campaign.sent || 0)}</td><td>${Number(campaign.delivered || 0)}</td><td>${Number(campaign.read || 0)}</td><td>${htmlEscape(campaign.readRate || '0%')}</td><td>${Number(campaign.failed || 0)}</td></tr>`)
      .join('');
    insightCampaigns.innerHTML = `<table><thead><tr><th>Name</th><th>Category</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Read rate</th><th>Failed</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderInsightActions({ summary, campaigns, costs, costsOk }) {
    const actions = [];
    const failed = Number(summary.failed || 0);
    const sent = Number(summary.sent || 0);
    const replyRate = parsePercent(summary.replyRate);
    const readRate = parsePercent(summary.readRate);
    const weakCampaign = campaigns.find((campaign) => parsePercent(campaign.readRate) > 0 && parsePercent(campaign.readRate) < 35);
    const strongCampaign = campaigns
      .slice()
      .sort((a, b) => parsePercent(b.readRate) - parsePercent(a.readRate))[0];

    if (!sent) actions.push(['Start measurement', 'Prepare and dispatch a campaign to establish delivery, read, reply, and cost baselines.']);
    if (failed > 0) actions.push(['Clean failed numbers', `${failed} recipients failed. Export or review failed recipients before the next broadcast.`]);
    if (replyRate < 2 && sent > 0) actions.push(['Improve reply intent', 'Add a clear reply keyword or stronger call to action so the inbox can capture qualified leads.']);
    if (readRate < 50 && sent > 0) actions.push(['Review template timing', 'Read rate is below 50%. Test a different send time or simplify the first sentence.']);
    if (weakCampaign) actions.push(['Fix low-read campaign', `${weakCampaign.name} is under 35% read rate. Compare its copy, audience, and send time against stronger campaigns.`]);
    if (strongCampaign && parsePercent(strongCampaign.readRate) >= 60) actions.push(['Reuse winning pattern', `${strongCampaign.name} is the current strongest campaign by read rate. Reuse its audience or opening structure.`]);

    const costCents = Number(costs?.summary?.estimatedCostCents || costs?.estimatedCostCents || 0);
    const reconciled = costs?.summary?.reconciled ?? costs?.reconciled;
    insightCost.textContent = costsOk ? `R ${(costCents / 100).toFixed(2)}${reconciled ? ' reconciled' : ' estimated'}` : 'Cost unavailable';
    if (costsOk && costCents === 0 && sent > 0) actions.push(['Confirm Meta rates', 'Messages exist but estimated cost is R 0. Configure current Meta category rates or wait for delivery ledger reconciliation.']);

    insightActions.innerHTML = actions.length
      ? actions.map(([title, body]) => `<article><strong>${htmlEscape(title)}</strong><small>${htmlEscape(body)}</small></article>`).join('')
      : '<p class="muted-copy">No urgent actions. Keep monitoring campaign and inbox trends.</p>';
  }

  function parsePercent(value) {
    const parsed = Number(String(value || '').replace('%', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  document.getElementById('refreshInsightsBtn')?.addEventListener('click', loadInsights);
  loadInsights();
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm).entries());
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || 'Sign in failed');
      return;
    }
    showToast('Signed in');
    window.setTimeout(() => {
      window.location.href = '/dashboard';
    }, 450);
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  const statusEl = document.getElementById('signupStatus');
  const planSelect = signupForm.querySelector('select[name="planCode"]');

  planSelect?.addEventListener('change', () => {
    document.querySelectorAll('.signup-plan-grid article').forEach((card) => {
      const title = card.querySelector('strong')?.textContent || '';
      card.classList.toggle('selected', title.toLowerCase() === planSelect.value);
    });
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(signupForm).entries());
    statusEl.textContent = 'Creating workspace...';
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      statusEl.textContent = result.error || 'Workspace could not be created.';
      showToast(result.error || 'Signup failed');
      return;
    }
    statusEl.textContent = `Workspace created on ${result.subscription?.planName || 'trial'} trial.`;
    showToast('Workspace created');
    window.setTimeout(() => {
      window.location.href = '/dashboard';
    }, 450);
  });
}

const socialSignupCompletionForm = document.getElementById('socialSignupCompletionForm');
if (socialSignupCompletionForm) {
  const statusEl = document.getElementById('socialSignupStatus');
  socialSignupCompletionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(socialSignupCompletionForm).entries());
    statusEl.textContent = 'Creating workspace...';
    const response = await fetch('/api/auth/social/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      statusEl.textContent = result.error || 'Workspace could not be created.';
      showToast(result.error || 'Signup failed');
      return;
    }
    statusEl.textContent = `Workspace created on ${result.subscription?.planName || 'trial'} trial.`;
    showToast('Workspace created');
    window.setTimeout(() => {
      window.location.href = '/dashboard';
    }, 450);
  });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login';
  });
}

const passwordResetRequestForm = document.getElementById('passwordResetRequestForm');
if (passwordResetRequestForm) {
  const statusEl = document.getElementById('passwordResetStatus');

  passwordResetRequestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(passwordResetRequestForm).entries());
    const response = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || 'Reset request failed');
      return;
    }
    statusEl.textContent = result.resetToken ? `Local reset token: ${result.resetToken}` : 'Check your email for the reset link.';
    showToast('Password reset requested');
  });
}

const flowTemplateGrid = document.getElementById('flowTemplateGrid');
if (flowTemplateGrid) {
  const flowList = document.getElementById('flowList');
  const editor = document.getElementById('flowDefinitionEditor');
  const validationStatus = document.getElementById('flowValidationStatus');
  const transcript = document.getElementById('flowTranscript');
  let selectedFlowId = null;
  let selectedFlowName = '';

  async function loadFlowTemplates() {
    const response = await fetch('/api/chatbot/templates');
    const result = await response.json().catch(() => ({ templates: [] }));
    if (!response.ok) {
      flowTemplateGrid.innerHTML = `<p class="muted-copy">${escapeHtml(result.error || 'Templates could not load')}</p>`;
      return;
    }
    flowTemplateGrid.innerHTML = result.templates
      .map(
        (template) => `<article class="flow-template"><small>${escapeHtml(template.industryName)}</small><h4>${escapeHtml(template.name)}</h4><p>${escapeHtml(template.description)}</p><button class="button" data-duplicate-flow="${template.id}">Duplicate</button></article>`
      )
      .join('');
    document.querySelectorAll('[data-duplicate-flow]').forEach((button) => {
      button.addEventListener('click', () => duplicateFlow(button.dataset.duplicateFlow));
    });
  }

  async function loadFlows() {
    const response = await fetch('/api/chatbot/flows');
    const result = await response.json().catch(() => ({ flows: [] }));
    if (!response.ok) {
      flowList.innerHTML = `<p class="muted-copy">${escapeHtml(result.error || 'Flows could not load')}</p>`;
      return;
    }
    flowList.innerHTML = result.flows.length
      ? result.flows.map(renderFlowRow).join('')
      : '<p class="muted-copy">Duplicate a template to start.</p>';
    document.querySelectorAll('[data-flow-id]').forEach((button) => {
      button.addEventListener('click', () => loadFlowDetail(button.dataset.flowId));
    });
  }

  function renderFlowRow(flow) {
    return `<button class="flow-row ${String(flow.id) === String(selectedFlowId) ? 'active' : ''}" data-flow-id="${flow.id}"><strong>${escapeHtml(flow.name)}</strong><span>${escapeHtml(flow.industryName)} · ${escapeHtml(flow.status)} · ${flow.nodeCount || 0} nodes</span></button>`;
  }

  async function duplicateFlow(templateId) {
    const response = await fetch(`/api/chatbot/templates/${templateId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const flow = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Flow duplicated' : flow.error || 'Flow could not be duplicated');
    if (response.ok) {
      await loadFlows();
      await loadFlowDetail(flow.id);
    }
  }

  async function loadFlowDetail(flowId) {
    const response = await fetch(`/api/chatbot/flows/${flowId}`);
    const flow = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(flow.error || 'Flow could not load');
      return;
    }
    selectedFlowId = flow.id;
    selectedFlowName = flow.name;
    editor.value = JSON.stringify(flow.definition, null, 2);
    renderValidation(flow.validation);
    await loadFlows();
  }

  async function saveFlow() {
    if (!selectedFlowId) return showToast('Select a flow first');
    let definition;
    try {
      definition = JSON.parse(editor.value);
    } catch {
      return showToast('Flow JSON is invalid');
    }
    const response = await fetch(`/api/chatbot/flows/${selectedFlowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedFlowName, definition })
    });
    const flow = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Flow saved' : flow.error || 'Flow could not save');
    if (response.ok) {
      editor.value = JSON.stringify(flow.definition, null, 2);
      renderValidation(flow.validation);
      await loadFlows();
    }
  }

  async function publishFlow() {
    if (!selectedFlowId) return showToast('Select a flow first');
    const response = await fetch(`/api/chatbot/flows/${selectedFlowId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const flow = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Flow published' : flow.error || 'Flow could not publish');
    if (response.ok) {
      renderValidation(flow.validation);
      await loadFlows();
    }
  }

  async function simulateFlow() {
    if (!selectedFlowId) return showToast('Select a flow first');
    const input = document.getElementById('flowTestInput').value;
    const response = await fetch(`/api/chatbot/flows/${selectedFlowId}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, contact: { firstName: 'Nomsa' } })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || 'Simulation failed');
    transcript.innerHTML = result.transcript.map(renderTranscriptLine).join('');
  }

  function renderTranscriptLine(line) {
    if (line.direction === 'system') return `<p class="flow-system">${escapeHtml(line.body)}</p>`;
    const cls = line.direction === 'user' ? 'chat-right' : 'chat-left';
    const buttons = line.buttons?.length ? `<div class="flow-buttons">${line.buttons.map((button) => `<span>${escapeHtml(button)}</span>`).join('')}</div>` : '';
    return `<div><p class="${cls}">${escapeHtml(line.body)}</p>${buttons}</div>`;
  }

  function renderValidation(validation = {}) {
    validationStatus.textContent = validation.valid ? 'Valid' : `${validation.errors?.length || 0} errors`;
    validationStatus.classList.toggle('danger-status', !validation.valid);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  document.getElementById('refreshFlowsBtn')?.addEventListener('click', () => {
    loadFlowTemplates();
    loadFlows();
  });
  document.getElementById('saveFlowBtn')?.addEventListener('click', saveFlow);
  document.getElementById('publishFlowBtn')?.addEventListener('click', publishFlow);
  document.getElementById('simulateFlowBtn')?.addEventListener('click', simulateFlow);
  document.getElementById('sendFlowTestBtn')?.addEventListener('click', simulateFlow);

  loadFlowTemplates();
  loadFlows();
}
