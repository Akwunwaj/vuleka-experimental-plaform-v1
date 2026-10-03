const landing = document.getElementById('landing');
const app = document.getElementById('app');
const pageTitle = document.getElementById('pageTitle');
const toast = document.getElementById('toast');
const landingNavToggle = document.querySelector('[data-landing-nav-toggle]');
const landingMobileNav = document.getElementById('landingMobileNav');
const publicNavDropdowns = [...document.querySelectorAll('.nav-dropdown')];

function setLandingMenu(open) {
  if (!landingNavToggle || !landingMobileNav) return;
  landingMobileNav.hidden = !open;
  landingNavToggle.setAttribute('aria-expanded', String(open));
  landingNavToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  document.body.classList.toggle('landing-menu-open', open);
}

landingNavToggle?.addEventListener('click', () => {
  setLandingMenu(landingNavToggle.getAttribute('aria-expanded') !== 'true');
});
landingMobileNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setLandingMenu(false)));
publicNavDropdowns.forEach((dropdown) => {
  dropdown.addEventListener('toggle', () => {
    if (!dropdown.open) return;
    publicNavDropdowns.forEach((other) => {
      if (other !== dropdown) other.open = false;
    });
  });
  dropdown.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    dropdown.open = false;
  }));
});
document.addEventListener('click', (event) => {
  if (event.target.closest('.nav-dropdown')) return;
  publicNavDropdowns.forEach((dropdown) => {
    dropdown.open = false;
  });
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

const appModal = document.getElementById('appModal');
const appModalBody = document.getElementById('appModalBody');
const appModalTitle = document.getElementById('appModalTitle');
const appModalKicker = document.getElementById('appModalKicker');

function openAppModal(sourceId, { title, kicker = 'Workspace' } = {}) {
  const source = document.getElementById(sourceId);
  if (!appModal || !appModalBody || !source) return;
  appModalTitle.textContent = title || source.querySelector('h3')?.textContent || 'Workspace action';
  appModalKicker.textContent = kicker;
  appModalBody.replaceChildren(source);
  appModal.showModal();
  window.setTimeout(() => source.querySelector('input, textarea, select')?.focus(), 0);
}

function closeAppModal() {
  if (appModal?.open) appModal.close();
}

document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', () => {
  openAppModal(button.dataset.openModal, { title: button.textContent.trim(), kicker: 'Commerce' });
}));
document.getElementById('closeAppModalButton')?.addEventListener('click', closeAppModal);
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-modal]')) closeAppModal();
});

const notificationsButton = document.getElementById('notificationsButton');
const notificationCenter = document.getElementById('notificationCenter');
const notificationCount = document.getElementById('notificationCount');
const notificationList = document.getElementById('notificationList');

function renderNotifications({ conversations = [], campaigns = [] } = {}) {
  if (!notificationList) return;
  const unread = conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
  const activeCampaigns = campaigns.filter((campaign) => !['sent', 'completed'].includes(String(campaign.status || '').toLowerCase()));

  if (notificationCount) {
    notificationCount.textContent = String(unread);
    notificationCount.hidden = unread === 0;
  }

  const items = [];
  if (unread) {
    items.push(`<article><span class="notification-icon inbox">☏</span><div><strong>${unread} unread ${unread === 1 ? 'conversation' : 'conversations'}</strong><small>Reply to customers waiting for your team.</small></div><button data-notification-page="inbox" type="button">Open inbox</button></article>`);
  }
  if (activeCampaigns.length) {
    items.push(`<article><span class="notification-icon campaign">▣</span><div><strong>${activeCampaigns.length} ${activeCampaigns.length === 1 ? 'campaign' : 'campaigns'} in progress</strong><small>Review delivery and audience performance.</small></div><button data-notification-page="insights" type="button">View insights</button></article>`);
  }

  notificationList.innerHTML = items.length
    ? items.join('')
    : '<p class="muted-copy notification-empty">You’re all caught up. New customer messages will appear here.</p>';
  notificationList.querySelectorAll('[data-notification-page]').forEach((button) => {
    button.addEventListener('click', () => {
      showPage(button.dataset.notificationPage);
      setNotificationCenter(false);
    });
  });
}

async function loadNotifications() {
  if (!notificationList) return;
  notificationList.innerHTML = '<p class="muted-copy">Loading activity…</p>';
  const [inboxResponse, overviewResponse] = await Promise.all([
    fetch('/api/inbox/conversations').catch(() => null),
    fetch('/api/analytics/overview').catch(() => null)
  ]);
  if (!inboxResponse && !overviewResponse) {
    notificationList.innerHTML = '<p class="muted-copy notification-empty">Activity is temporarily unavailable. Please try again.</p>';
    return;
  }
  const inbox = await inboxResponse?.json().catch(() => ({}));
  const overview = await overviewResponse?.json().catch(() => ({}));
  renderNotifications({
    conversations: inboxResponse?.ok && Array.isArray(inbox.conversations) ? inbox.conversations : [],
    campaigns: overviewResponse?.ok && Array.isArray(overview.campaigns) ? overview.campaigns : []
  });
}

function setNotificationCenter(open) {
  notificationCenter?.classList.toggle('open', open);
  notificationCenter?.setAttribute('aria-hidden', open ? 'false' : 'true');
  notificationsButton?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) loadNotifications();
}
notificationsButton?.addEventListener('click', () => setNotificationCenter(!notificationCenter?.classList.contains('open')));
document.getElementById('closeNotificationsButton')?.addEventListener('click', () => setNotificationCenter(false));
document.addEventListener('click', (event) => {
  if (!notificationCenter?.classList.contains('open')) return;
  if (notificationCenter.contains(event.target) || notificationsButton?.contains(event.target)) return;
  setNotificationCenter(false);
});

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

const dashboardPageIds = new Set([...document.querySelectorAll('.page')]
  .map((page) => page.id.replace(/^page-/, '')));

function pageFromLocationHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return dashboardPageIds.has(id) ? id : null;
}

function showPage(id, { updateUrl = true } = {}) {
  if (!dashboardPageIds.has(id)) id = 'dashboard';
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${id}`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === id));
  const activeNav = document.querySelector(`.nav-item[data-page="${id}"]`);
  if (pageTitle) {
    pageTitle.textContent = activeNav?.dataset.title || id.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
  document.querySelector('.app')?.classList.remove('mobile-nav-open');
  if (updateUrl && window.location.hash !== `#${encodeURIComponent(id)}`) {
    window.history.pushState({ page:id }, '', `#${encodeURIComponent(id)}`);
  }
}

function restorePageFromLocation() {
  showPage(pageFromLocationHash() || 'dashboard', { updateUrl:false });
}

window.addEventListener('hashchange', restorePageFromLocation);
window.addEventListener('popstate', restorePageFromLocation);
restorePageFromLocation();

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

document.querySelectorAll('[data-open-app]').forEach((button) => button.addEventListener('click', openApp));
document.querySelectorAll('[data-show-site]').forEach((button) => button.addEventListener('click', showSite));
document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.pageLink)));
document.querySelectorAll('[data-mobile-nav-toggle]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.app')?.classList.toggle('mobile-nav-open');
}));
document.querySelectorAll('[data-mobile-nav-close]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.app')?.classList.remove('mobile-nav-open');
}));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (notificationCenter?.classList.contains('open')) {
      setNotificationCenter(false);
      notificationsButton?.focus();
    }
    document.querySelector('.app')?.classList.remove('mobile-nav-open');
    setLandingMenu(false);
    publicNavDropdowns.forEach((dropdown) => {
      dropdown.open = false;
    });
  }
});
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
    const label = button.querySelector('span');
    if (label) label.textContent = show ? 'Hide' : 'Show';
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
  return `<article class="setup-step ${step.completed ? 'complete' : ''}"><span>${step.completed ? '✓' : '•'}</span><div><strong>${htmlEscape(step.title)}</strong><small>${htmlEscape(step.description)}</small></div><div class="setup-step-actions">${action}${manual}</div></article>`;
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
const contactForm = document.getElementById('contactForm');
if (addContactBtn && contactForm) {
  const contactDeleteDialog = document.getElementById('contactDeleteDialog');
  const contactDeleteMessage = document.getElementById('contactDeleteMessage');
  const contactSubmitButton = contactForm.querySelector('[type="submit"]');
  let pendingContactDeleteId = null;

  function contactRow(contact) {
    const optedIn = contact.optedIn !== false;
    return `<tr data-contact-id="${htmlEscape(contact.id)}"><td>${htmlEscape(contact.name)}</td><td>${htmlEscape(contact.phone)}</td><td>${htmlEscape(contact.segment || 'Imported')}</td><td>${optedIn ? 'Yes' : 'No'}</td><td>${htmlEscape(contact.lastSeen || 'Just now')}</td><td><div class="table-actions"><button class="link-button" data-contact-edit="${htmlEscape(contact.id)}" data-contact-name="${htmlEscape(contact.name)}" data-contact-phone="${htmlEscape(contact.phone)}" data-contact-segment="${htmlEscape(contact.segment || 'Imported')}" data-contact-opted-in="${optedIn}" type="button">Edit</button><button class="link-button danger-link" data-contact-delete="${htmlEscape(contact.id)}" data-contact-name="${htmlEscape(contact.name)}" type="button">Delete</button></div></td></tr>`;
  }

  function resetContactForm() {
    contactForm.reset();
    contactForm.elements.contactId.value = '';
    contactForm.elements.optedIn.checked = true;
    if (contactSubmitButton) contactSubmitButton.textContent = 'Add contact';
  }

  function openContactModal() {
    resetContactForm();
    openAppModal('contactForm', { title: 'Add contact', kicker: 'Contacts' });
  }

  function bindContactActions(scope = document) {
    scope.querySelectorAll('[data-contact-edit]').forEach((button) => {
      if (button.dataset.boundContactAction) return;
      button.dataset.boundContactAction = 'true';
      button.addEventListener('click', () => {
      contactForm.elements.contactId.value = button.dataset.contactEdit;
      contactForm.elements.name.value = button.dataset.contactName || '';
      contactForm.elements.phone.value = button.dataset.contactPhone || '';
      contactForm.elements.segment.value = button.dataset.contactSegment || 'Imported';
      contactForm.elements.optedIn.checked = button.dataset.contactOptedIn !== 'false';
      if (contactSubmitButton) contactSubmitButton.textContent = 'Save changes';
      openAppModal('contactForm', { title: 'Edit contact', kicker: 'Contacts' });
      });
    });
    scope.querySelectorAll('[data-contact-delete]').forEach((button) => {
      if (button.dataset.boundContactAction) return;
      button.dataset.boundContactAction = 'true';
      button.addEventListener('click', () => {
      pendingContactDeleteId = button.dataset.contactDelete;
      contactDeleteMessage.textContent = `Delete ${button.dataset.contactName || 'this contact'} from active contacts?`;
      contactDeleteDialog.showModal();
      });
    });
  }

  function closeContactDeleteDialog() {
    pendingContactDeleteId = null;
    if (contactDeleteDialog?.open) contactDeleteDialog.close();
  }

  addContactBtn.addEventListener('click', openContactModal);
  document.getElementById('crmAddContactButton')?.addEventListener('click', openContactModal);
  document.getElementById('closeContactDeleteDialog')?.addEventListener('click', closeContactDeleteDialog);
  document.getElementById('cancelContactDelete')?.addEventListener('click', closeContactDeleteDialog);
  document.getElementById('confirmContactDelete')?.addEventListener('click', async () => {
    if (!pendingContactDeleteId) return;
    const response = await fetch(`/api/contacts/${encodeURIComponent(pendingContactDeleteId)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Contact soft-deleted' : result.error || 'Contact could not be deleted');
    if (!response.ok) return;
    document.querySelector(`#contactTablePanel tr[data-contact-id="${pendingContactDeleteId}"]`)?.remove();
    document.querySelector(`#crmContactList article[data-contact-id="${pendingContactDeleteId}"]`)?.remove();
    const crmCount = document.getElementById('crmContactCount');
    if (crmCount) crmCount.textContent = String(Math.max(0, Number(crmCount.textContent || 0) - 1));
    closeContactDeleteDialog();
  });
  bindContactActions(document.getElementById('contactTablePanel'));

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(contactForm).entries());
    payload.optedIn = contactForm.elements.optedIn.checked;
    const contactId = payload.contactId;
    delete payload.contactId;
    const response = await fetch(contactId ? `/api/contacts/${encodeURIComponent(contactId)}` : '/api/contacts', {
      method: contactId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? (contactId ? 'Contact updated' : 'Contact added') : result.error || 'Contact could not be saved');
    if (!response.ok) return;
    const saved = { ...payload, ...result, id: result.id || contactId, optedIn: result.optedIn ?? payload.optedIn, lastSeen: result.lastSeen || 'Just now' };
    const tbody = document.querySelector('#contactTablePanel tbody');
    const existingRow = contactId && tbody?.querySelector(`tr[data-contact-id="${contactId}"]`);
    if (existingRow) {
      existingRow.outerHTML = contactRow(saved);
      bindContactActions(tbody);
    } else {
      tbody?.insertAdjacentHTML('afterbegin', contactRow(saved));
      bindContactActions(tbody);
      const crmCount = document.getElementById('crmContactCount');
      if (crmCount) crmCount.textContent = String(Number(crmCount.textContent || 0) + 1);
    }
    resetContactForm();
    closeAppModal();
    loadSetupWizard();
  });
}

const createTemplateButton = document.getElementById('createTemplateButton');
const templateForm = document.getElementById('templateForm');
if (createTemplateButton && templateForm) {
  createTemplateButton.addEventListener('click', () => openAppModal('templateForm', { title: 'Create template', kicker: 'Templates' }));
  templateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(templateForm).entries());
    const response = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Template created as a draft' : result.error || 'Template could not be created');
    if (!response.ok) return;
    document.getElementById('templateGrid')?.insertAdjacentHTML('afterbegin', `<article class="panel template"><small>${htmlEscape(payload.category)} · Draft</small><h3>${htmlEscape(result.name || payload.name)}</h3><p>${htmlEscape(payload.body)}</p><button class="button ghost" data-page-link="campaigns" type="button">Use template</button></article>`);
    templateForm.reset();
    closeAppModal();
  });
}

const replyForm = document.getElementById('replyForm');
if (replyForm) {
  const inboxConversation = document.getElementById('inboxConversation');
  const inboxList = document.getElementById('inboxList');
  const noteForm = document.getElementById('noteForm');
  const csatForm = document.getElementById('csatForm');
  const typingIndicator = document.getElementById('typingIndicator');
  const generateAiDraftButton = document.getElementById('generateInboxAiDraftButton');
  const aiDraftDrawer = document.getElementById('inboxAiDraftDrawer');
  const aiDraftBody = document.getElementById('inboxAiDraftBody');
  const aiDraftState = document.getElementById('inboxAiDraftState');
  const aiDraftMeta = document.getElementById('inboxAiDraftMeta');
  const useAiDraftButton = document.getElementById('useInboxAiDraftButton');
  const discardAiDraftButton = document.getElementById('discardInboxAiDraftButton');
  let assignmentForm = document.getElementById('assignmentForm');
  if (!assignmentForm) {
    assignmentForm = document.createElement('form');
    assignmentForm.id = 'assignmentForm';
    assignmentForm.className = 'assignment-form';
    assignmentForm.innerHTML = '<label>Assign conversation<select id="inboxAssignee" name="assignedUserId"><option value="">Unassigned</option></select></label><button class="button" type="submit">Assign</button>';
    inboxConversation.querySelector('.inbox-meta')?.after(assignmentForm);
  }
  const inboxAssignee = assignmentForm.querySelector('[name="assignedUserId"]');
  const replyInput = replyForm.querySelector('[name="body"]');
  if (replyInput?.tagName === 'INPUT') {
    const textarea = document.createElement('textarea');
    textarea.name = 'body'; textarea.rows = 1; textarea.placeholder = replyInput.placeholder;
    replyInput.replaceWith(textarea);
  }
  let activeConversationId = replyForm.dataset.conversationId;
  let typingTimer = null;
  let activeAiDraft = null;

  function setAiDraftDrawer(open) {
    aiDraftDrawer?.classList.toggle('open', open);
    aiDraftDrawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function resetAiDraft() {
    activeAiDraft = null;
    replyForm.dataset.aiDraftId = '';
    if (aiDraftBody) aiDraftBody.value = '';
    if (aiDraftState) aiDraftState.innerHTML = '<p class="muted-copy">Generate a draft from the active conversation.</p>';
    if (useAiDraftButton) useAiDraftButton.disabled = true;
  }

  async function loadInboxList() {
    const response = await fetch('/api/inbox/conversations');
    if (!response.ok) return;
    const result = await response.json();
    inboxList.innerHTML = result.conversations.map(renderInboxItem).join('');
    bindInboxItems();
    if (notificationCenter?.classList.contains('open')) loadNotifications();
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
    resetAiDraft();
    renderConversation(detail);
  }

  async function loadAssignees() {
    const response = await fetch('/api/users');
    const result = await response.json().catch(() => ({ users: [] }));
    if (!response.ok || !inboxAssignee) return;
    inboxAssignee.innerHTML = `<option value="">Unassigned</option>${(result.users || []).filter((user) => user.status !== 'disabled').map((user) => `<option value="${htmlEscape(user.id)}">${htmlEscape(user.name || user.email)}</option>`).join('')}`;
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
    if (inboxAssignee) inboxAssignee.value = conversation.assignedUserId || '';
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
  loadAssignees();
  if (activeConversationId) loadConversation(activeConversationId);

  generateAiDraftButton?.addEventListener('click', async () => {
    if (!activeConversationId) return showToast('Select a conversation first');
    resetAiDraft();
    setAiDraftDrawer(true);
    generateAiDraftButton.disabled = true;
    generateAiDraftButton.textContent = 'Drafting...';
    aiDraftState.innerHTML = '<p class="muted-copy">Preparing a reviewable reply...</p>';
    const response = await fetch(`/api/inbox/conversations/${encodeURIComponent(activeConversationId)}/ai-drafts`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'
    });
    const result = await response.json().catch(() => ({}));
    generateAiDraftButton.disabled = false;
    generateAiDraftButton.textContent = 'AI draft';
    if (!response.ok) {
      aiDraftState.innerHTML = `<p class="ai-draft-warning">${escapeHtml(result.error || 'AI draft could not be generated')}</p>`;
      return;
    }
    activeAiDraft = result.draft;
    aiDraftBody.value = activeAiDraft.body || '';
    const flags = (activeAiDraft.safetyFlags || []).map((flag) => flag.replaceAll('_', ' ')).join(', ');
    const sources = (activeAiDraft.knowledgeRefs || []).map((source) => `<span title="${escapeHtml(source.type || 'knowledge')}">${escapeHtml(source.title || source.ref)}</span>`).join('');
    aiDraftMeta.textContent = `${activeAiDraft.providerKey} · ${activeAiDraft.confidenceLabel} confidence`;
    aiDraftState.innerHTML = `${activeAiDraft.requiresHandoff ? '<p class="ai-draft-warning">Human handoff recommended.</p>' : ''}${flags ? `<p class="ai-draft-warning">Review: ${escapeHtml(flags)}</p>` : '<p class="ai-draft-ready">No automated safety flags.</p>'}${sources ? `<div class="ai-draft-sources"><strong>Grounded with</strong><div>${sources}</div></div>` : '<p class="muted-copy">No matching approved knowledge found.</p>'}`;
    useAiDraftButton.disabled = !activeAiDraft.canUse;
  });

  useAiDraftButton?.addEventListener('click', () => {
    if (!activeAiDraft?.canUse || !aiDraftBody.value.trim()) return;
    const input = replyForm.querySelector('[name="body"]');
    input.value = aiDraftBody.value.trim();
    replyForm.dataset.aiDraftId = String(activeAiDraft.id);
    setAiDraftDrawer(false);
    input.focus();
    showToast('Draft added for your review');
  });

  discardAiDraftButton?.addEventListener('click', async () => {
    if (activeAiDraft?.id) {
      await fetch(`/api/inbox/conversations/${encodeURIComponent(activeConversationId)}/ai-drafts/${encodeURIComponent(activeAiDraft.id)}/discard`, { method:'POST' }).catch(() => {});
    }
    resetAiDraft();
    setAiDraftDrawer(false);
  });

  document.getElementById('closeInboxAiDraftButton')?.addEventListener('click', () => setAiDraftDrawer(false));
  aiDraftDrawer?.addEventListener('click', (event) => { if (event.target === aiDraftDrawer) setAiDraftDrawer(false); });

  replyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = replyForm.querySelector('[name="body"]');
    if (!input.value.trim()) return;
    fetch(`/api/inbox/conversations/${activeConversationId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: input.value, aiDraftId: replyForm.dataset.aiDraftId || undefined })
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      showToast(response.ok ? 'Reply queued' : result.error || 'Reply failed');
      if (response.ok) {
        input.value = '';
        resetAiDraft();
        loadConversation(activeConversationId);
      }
    });
  });

  replyForm.querySelector('[name="body"]')?.addEventListener('input', (event) => {
    const composer = event.currentTarget;
    if (composer.tagName === 'TEXTAREA') {
      composer.style.height = 'auto';
      composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`;
      composer.style.overflowY = composer.scrollHeight > 160 ? 'auto' : 'hidden';
    }
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

  assignmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeConversationId) return;
    const response = await fetch(`/api/inbox/conversations/${encodeURIComponent(activeConversationId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedUserId: inboxAssignee.value || null })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Conversation assignment updated' : result.error || 'Assignment could not be updated');
    if (response.ok) refreshActiveConversation();
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

const knowledgeItemDrawer = document.getElementById('knowledgeItemDrawer');
const knowledgeItemForm = document.getElementById('knowledgeItemForm');
const knowledgeItemList = document.getElementById('knowledgeItemList');
const knowledgeItemsById = new Map();
const knowledgeSourcesById = new Map();

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
}

function setKnowledgeDrawer(open) {
  knowledgeItemDrawer?.classList.toggle('open', open);
  knowledgeItemDrawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function setIntelligenceView(view) {
  document.querySelectorAll('[data-intelligence-tab]').forEach((button) => button.classList.toggle('active', button.dataset.intelligenceTab === view));
  document.getElementById('intelligenceKnowledgeView')?.classList.toggle('active', view === 'knowledge');
  document.getElementById('intelligenceSourcesView')?.classList.toggle('active', view === 'sources');
  document.getElementById('intelligenceConnectorsView')?.classList.toggle('active', view === 'connectors');
  document.getElementById('intelligenceQualityView')?.classList.toggle('active', view === 'quality');
}

document.querySelectorAll('[data-intelligence-tab]').forEach((button) => button.addEventListener('click', () => setIntelligenceView(button.dataset.intelligenceTab)));

async function loadKnowledgeWorkspace() {
  if (!knowledgeItemList) return;
  const [knowledgeResponse, qualityResponse, operationsResponse] = await Promise.all([fetch('/api/knowledge/overview'), fetch('/api/ai/quality'), fetch('/api/knowledge/operations')]);
  const knowledge = await knowledgeResponse.json().catch(() => ({}));
  const quality = await qualityResponse.json().catch(() => ({}));
  const operations = await operationsResponse.json().catch(() => ({}));
  if (knowledgeResponse.ok) renderKnowledgeWorkspace(knowledge);
  else knowledgeItemList.innerHTML = `<p class="muted-copy">${htmlEscape(knowledge.error || 'Knowledge could not load')}</p>`;
  if (qualityResponse.ok) renderAiQuality(quality);
  if (operationsResponse.ok) renderKnowledgeOperations(operations);
}

function renderKnowledgeWorkspace(knowledge) {
  const summary = knowledge.summary || {};
  document.getElementById('knowledgeSummary').innerHTML = [
    ['Approved', summary.approved || 0, 'Available to retrieval'],
    ['Drafts', summary.drafts || 0, 'Awaiting approval'],
    ['Archived', summary.archived || 0, 'Excluded from retrieval'],
    ['Total', summary.total || 0, 'Tenant-owned sources']
  ].map(([label,value,note]) => `<article class="metric"><small>${label}</small><strong>${Number(value)}</strong><span>${note}</span></article>`).join('');
  document.getElementById('knowledgeStatus').textContent = `${Number(summary.approved || 0)} approved`;
  knowledgeItemsById.clear();
  (knowledge.items || []).forEach((item) => knowledgeItemsById.set(String(item.id), item));
  knowledgeItemList.innerHTML = (knowledge.items || []).length ? knowledge.items.map((item) => `
    <div class="knowledge-row">
      <div><span class="status ${item.status === 'approved' ? '' : 'warn'}">${htmlEscape(item.status)}</span><strong>${htmlEscape(item.title)}</strong><small>${htmlEscape(item.itemType)} · version ${Number(item.version || 1)}</small></div>
      <p>${htmlEscape(item.content)}</p>
      <button class="button ghost" type="button" data-knowledge-edit="${htmlEscape(item.id)}">Edit</button>
    </div>`).join('') : '<p class="muted-copy">Add an FAQ, policy, or agent instruction to begin.</p>';
  knowledgeItemList.querySelectorAll('[data-knowledge-edit]').forEach((button) => button.addEventListener('click', () => openKnowledgeItem(knowledgeItemsById.get(button.dataset.knowledgeEdit))));
}

function renderAiQuality(quality) {
  const summary = quality.summary || {};
  const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
  document.getElementById('aiQualitySummary').innerHTML = [
    ['Drafts', summary.totalDrafts || 0, 'Generated'],
    ['Acceptance', percent(summary.acceptanceRate), `${Number(summary.usedDrafts || 0)} used`],
    ['Edited', percent(summary.editRate), 'Used drafts changed'],
    ['Grounded', percent(summary.groundedRate), 'With retrieved sources'],
    ['Blocked', summary.blockedDrafts || 0, 'Safety intervention'],
    ['Confidence', percent(summary.averageConfidence), 'Average score']
  ].map(([label,value,note]) => `<article class="metric"><small>${label}</small><strong>${htmlEscape(value)}</strong><span>${htmlEscape(note)}</span></article>`).join('');
  document.getElementById('aiProviderQuality').innerHTML = (quality.providerBreakdown || []).length ? quality.providerBreakdown.map((provider) => `<div class="quality-row"><div><strong>${htmlEscape(provider.providerKey)}</strong><span>${Number(provider.drafts || 0)} drafts</span></div><em>${percent(provider.acceptanceRate)} accepted · ${percent(provider.averageConfidence)} confidence</em></div>`).join('') : '<p class="muted-copy">No provider data yet.</p>';
  document.getElementById('aiSafetySignals').innerHTML = (quality.safetyFlags || []).length ? quality.safetyFlags.map((item) => `<div class="quality-row"><strong>${htmlEscape(item.flag.replaceAll('_',' '))}</strong><em>${Number(item.count)}</em></div>`).join('') : '<p class="muted-copy">No safety flags recorded.</p>';
  document.getElementById('aiDraftOutcomes').innerHTML = (quality.recent || []).length ? quality.recent.map((draft) => `<div class="quality-row"><div><strong>${htmlEscape(draft.providerKey || 'provider')} · ${htmlEscape(draft.status)}</strong><span>${Number(draft.knowledgeSourceCount || 0)} sources${draft.wasEdited === true ? ' · edited' : ''}</span></div><em>${percent(draft.confidence)}</em></div>`).join('') : '<p class="muted-copy">No AI drafts recorded.</p>';
}

function renderKnowledgeOperations(operations) {
  const sources = operations.sources || [];
  renderConnectorOperations(operations.connectorOperations || {}, operations.googleDriveOAuth || {}, operations.connectorAlertCenter || {});
  knowledgeSourcesById.clear();
  sources.forEach((source) => knowledgeSourcesById.set(String(source.id), source));
  const cases = operations.evaluationCases || [];
  const latest = (operations.evaluationRuns || [])[0] || null;
  const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
  document.getElementById('knowledgeOpsSummary').innerHTML = [
    ['Sources', sources.length, 'Uploads and connectors'],
    ['Healthy', sources.filter((source) => source.status === 'ready').length, 'Ready for retrieval'],
    ['Eval cases', cases.length, 'Active quality checks'],
    ['Source recall', latest ? percent(latest.sourceRecall) : 'Not run', 'Latest evaluation']
  ].map(([label,value,note]) => `<article class="metric"><small>${htmlEscape(label)}</small><strong>${htmlEscape(value)}</strong><span>${htmlEscape(note)}</span></article>`).join('');
  document.getElementById('knowledgeSourceList').innerHTML = sources.length ? sources.map((source) => `<div class="quality-row knowledge-source-row"><div><strong>${htmlEscape(source.name)}</strong><span>${htmlEscape(source.sourceType.replaceAll('_',' '))} · ${htmlEscape(source.formatType)} · ${Number(source.itemCount || 0)} items${source.nextSyncAt ? ` · next ${htmlEscape(formatDateTime(source.nextSyncAt))}` : ''}</span></div><div class="source-row-actions"><em class="${source.status === 'error' ? 'quality-alert' : ''}">${htmlEscape(source.status)}${source.lastError ? ` · ${htmlEscape(source.lastError)}` : ''}</em><button class="button ghost" type="button" data-knowledge-source="${htmlEscape(source.id)}">Manage</button></div></div>`).join('') : '<p class="muted-copy">No file imports or API connectors yet.</p>';
  document.querySelectorAll('[data-knowledge-source]').forEach((button) => button.addEventListener('click', () => openKnowledgeSource(knowledgeSourcesById.get(button.dataset.knowledgeSource))));
  document.getElementById('knowledgeEvalCaseList').innerHTML = cases.length ? cases.map((item) => `<div class="quality-row"><div><strong>${htmlEscape(item.name)}</strong><span>${htmlEscape(item.queryText)}</span></div><em>${(item.expectedSourceRefs || []).length} expected · ${(item.forbiddenSourceRefs || []).length} forbidden</em></div>`).join('') : '<p class="muted-copy">Add a case to establish a repeatable quality baseline.</p>';
  const result = document.getElementById('knowledgeEvalResults');
  const status = document.getElementById('knowledgeEvalStatus');
  if (!latest) {
    status.textContent = 'Not run';
    result.innerHTML = '<p class="muted-copy">Run the suite after adding at least one evaluation case.</p>';
    return;
  }
  status.textContent = `${Number(latest.caseCount || 0)} cases`;
  result.innerHTML = [
    ['Citation precision', percent(latest.citationPrecision)],
    ['Source recall', percent(latest.sourceRecall)],
    ['Completeness', percent(latest.completeness)],
    ['Isolation', percent(latest.isolationPassRate)],
    ['Unsupported risk', percent(latest.unsupportedClaimRisk)]
  ].map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}

let connectorAlertPolicyState = null;
function renderConnectorOperations(connectorOperations, googleOAuth, alertCenter) {
  const summary = connectorOperations.summary || {};
  const duration = (value) => value === null || value === undefined
    ? 'No data'
    : `${(Number(value) / 1000).toFixed(Number(value) >= 10000 ? 0 : 1)}s`;
  document.getElementById('connectorOpsSummary').innerHTML = [
    ['Active', summary.active || 0, `${Number(summary.total || 0)} configured`],
    ['Healthy', summary.healthy || 0, 'Within freshness SLA'],
    ['Attention', summary.attention || 0, 'Stale or degraded'],
    ['Failed 24h', summary.failed24h || 0, 'Worker attempts'],
    ['Avg duration', duration(summary.averageDurationMs), 'Completed attempts']
  ].map(([label,value,note]) => `<article class="metric"><small>${htmlEscape(label)}</small><strong>${htmlEscape(value)}</strong><span>${htmlEscape(note)}</span></article>`).join('');
  connectorAlertPolicyState = alertCenter.policy || null;
  const storedAlerts = (alertCenter.alerts || []).filter((alert) => alert.status !== 'resolved');
  const alerts = storedAlerts.length ? storedAlerts : (connectorOperations.alerts || []);
  document.getElementById('connectorAlertStatus').textContent = alerts.length ? `${alerts.length} open` : 'Clear';
  document.getElementById('connectorAlertList').innerHTML = alerts.length ? alerts.map((alert) => `<div class="quality-row connector-alert ${htmlEscape(alert.severity)}"><div><strong>${htmlEscape(alert.title)}</strong><span>${htmlEscape(alert.detail)}</span>${alert.status ? `<small>${htmlEscape(alert.status)}${alert.escalatedAt ? ' · escalated' : ''}</small>` : ''}</div><div class="connector-alert-actions">${alert.id && alert.status === 'open' ? `<button class="button ghost" type="button" data-connector-alert-ack="${htmlEscape(alert.id)}">Acknowledge</button>` : ''}<button class="button ghost" type="button" data-connector-health-source="${htmlEscape(alert.sourceId)}">Manage</button></div></div>`).join('') : '<p class="muted-copy">All configured connectors are within their operating thresholds.</p>';
  const oauthStatus = document.getElementById('googleDriveOAuthStatus');
  oauthStatus.textContent = googleOAuth.configured ? 'Configured' : 'Setup required';
  document.getElementById('googleDriveOAuthReadiness').innerHTML = googleOAuth.configured
    ? `<div><strong>${googleOAuth.sandboxReady ? 'Sandbox ready' : 'Sandbox incomplete'}</strong><span>${Number(googleOAuth.testUserCount || 0)} test user(s) · ${htmlEscape(googleOAuth.redirectUri || '')}</span></div><div><strong>${googleOAuth.productionReady ? 'Production approved' : 'Production gated'}</strong><span>Verification ${htmlEscape(googleOAuth.verificationStatus || 'not_started')} · assessment ${htmlEscape(googleOAuth.securityAssessmentStatus || 'not_started')}</span></div><div><strong>${googleOAuth.restrictedScope ? 'Restricted scope' : 'Limited scope'}</strong><span>${htmlEscape((googleOAuth.scopes || []).join(', '))}</span></div>${googleOAuth.verificationRequired && !googleOAuth.productionReady ? '<p class="oauth-warning">Public connection remains gated until Google verification and the applicable security assessment are approved.</p>' : ''}`
    : '<p class="muted-copy">Set the Google Drive OAuth client ID, client secret, and registered callback URL on the platform.</p>';
  const sources = connectorOperations.sources || [];
  document.getElementById('connectorHealthList').innerHTML = sources.length ? sources.map((source) => `<div class="connector-health-row"><div><strong>${htmlEscape(source.name)}</strong><span>${htmlEscape(source.sourceType.replaceAll('_',' '))} · every ${Number(source.syncIntervalMinutes || 0)} min</span></div><span class="health-state ${htmlEscape(source.healthState)}">${htmlEscape(source.healthState.replaceAll('_',' '))}</span><div><small>Last success</small><strong>${htmlEscape(source.lastSuccessAt ? formatDateTime(source.lastSuccessAt) : 'Never')}</strong></div><div><small>Next run</small><strong>${htmlEscape(source.nextSyncAt ? formatDateTime(source.nextSyncAt) : 'Paused')}</strong></div><div><small>Success rate</small><strong>${source.successRate === null ? 'No data' : `${Math.round(source.successRate * 100)}%`}</strong></div><button class="button ghost" type="button" data-connector-health-source="${htmlEscape(source.id)}">Manage</button></div>`).join('') : '<p class="muted-copy">Add Shopify, WooCommerce, or Google Drive to begin monitoring.</p>';
  const runs = connectorOperations.recentRuns || [];
  document.getElementById('connectorRunList').innerHTML = runs.length ? runs.map((run) => `<div class="connector-run-row"><span class="health-state ${htmlEscape(run.status)}">${htmlEscape(run.status)}</span><div><strong>${htmlEscape(run.provider.replaceAll('_',' '))}</strong><span>${htmlEscape(run.triggerType)} · attempt ${Number(run.attempt || 1)}/${Number(run.maxAttempts || 1)}</span></div><div><small>Records</small><strong>${Number(run.fetchedCount || 0)} fetched · ${Number(run.createdCount || 0)} new · ${Number(run.updatedCount || 0)} updated</strong></div><div><small>Duration</small><strong>${htmlEscape(duration(run.durationMs))}</strong></div><div><small>Started</small><strong>${htmlEscape(formatDateTime(run.startedAt))}</strong></div>${run.errorMessage ? `<p>${htmlEscape(run.errorMessage)}</p>` : ''}</div>`).join('') : '<p class="muted-copy">Sync attempts will appear after the worker processes a connector job.</p>';
  const history = alertCenter.alerts || [];
  document.getElementById('connectorAlertHistory').innerHTML = history.length ? history.slice(0, 20).map((alert) => `<div class="connector-alert-history-row"><span class="health-state ${htmlEscape(alert.status)}">${htmlEscape(alert.status)}</span><div><strong>${htmlEscape(alert.title)}</strong><span>${htmlEscape(alert.severity)} · detected ${htmlEscape(formatDateTime(alert.firstDetectedAt))}</span></div><div><small>Notifications</small><strong>${Number(alert.notificationCount || 0)}</strong></div><div><small>Latest event</small><strong>${htmlEscape(alert.events?.[0] ? alert.events[0].eventType.replaceAll('_',' ') : 'opened')}</strong></div></div>`).join('') : '<p class="muted-copy">No connector alerts recorded.</p>';
  document.querySelectorAll('[data-connector-health-source]').forEach((button) => button.addEventListener('click', () => openKnowledgeSource(knowledgeSourcesById.get(button.dataset.connectorHealthSource))));
  document.querySelectorAll('[data-connector-alert-ack]').forEach((button) => button.addEventListener('click', async () => {
    const response = await fetch(`/api/knowledge/connectors/alerts/${encodeURIComponent(button.dataset.connectorAlertAck)}/acknowledge`, { method:'POST' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Alert acknowledged' : result.error || 'Alert could not be acknowledged');
    if (response.ok) await loadKnowledgeWorkspace();
  }));
}

function openKnowledgeItem(item = null) {
  knowledgeItemForm.reset();
  knowledgeItemForm.itemId.value = item?.id || '';
  knowledgeItemForm.itemType.value = item?.itemType || 'faq';
  knowledgeItemForm.title.value = item?.title || '';
  knowledgeItemForm.content.value = item?.content || '';
  knowledgeItemForm.keywords.value = (item?.keywords || []).join(', ');
  knowledgeItemForm.status.value = item?.status || 'draft';
  document.getElementById('knowledgeItemDrawerTitle').textContent = item ? 'Edit knowledge' : 'Add knowledge';
  setKnowledgeDrawer(true);
}

document.getElementById('addKnowledgeItemButton')?.addEventListener('click', () => openKnowledgeItem());
document.getElementById('closeKnowledgeItemDrawerButton')?.addEventListener('click', () => setKnowledgeDrawer(false));
knowledgeItemDrawer?.addEventListener('click', (event) => { if (event.target === knowledgeItemDrawer) setKnowledgeDrawer(false); });
knowledgeItemForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(knowledgeItemForm).entries());
  const itemId = payload.itemId;
  delete payload.itemId;
  const response = await fetch(itemId ? `/api/knowledge/items/${encodeURIComponent(itemId)}` : '/api/knowledge/items', {
    method:itemId ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Knowledge saved' : result.error || 'Knowledge could not be saved');
  if (response.ok) { setKnowledgeDrawer(false); await loadKnowledgeWorkspace(); }
});

const knowledgeImportDrawer = document.getElementById('knowledgeImportDrawer');
const knowledgeConnectorDrawer = document.getElementById('knowledgeConnectorDrawer');
const knowledgeEvalDrawer = document.getElementById('knowledgeEvalDrawer');
const knowledgeSourceDrawer = document.getElementById('knowledgeSourceDrawer');
const connectorAlertSettingsDrawer = document.getElementById('connectorAlertSettingsDrawer');
const knowledgeOpsDrawers = [knowledgeImportDrawer, knowledgeConnectorDrawer, knowledgeEvalDrawer, knowledgeSourceDrawer, connectorAlertSettingsDrawer].filter(Boolean);
function setKnowledgeOpsDrawer(drawer) {
  knowledgeOpsDrawers.forEach((item) => {
    const open = item === drawer;
    item.classList.toggle('open', open);
    item.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
}
document.getElementById('importKnowledgeButton')?.addEventListener('click', () => setKnowledgeOpsDrawer(knowledgeImportDrawer));
document.getElementById('addKnowledgeConnectorButton')?.addEventListener('click', () => { document.getElementById('knowledgeConnectorForm')?.reset(); updateConnectorFields(); setKnowledgeOpsDrawer(knowledgeConnectorDrawer); });
document.getElementById('addKnowledgeEvalButton')?.addEventListener('click', () => setKnowledgeOpsDrawer(knowledgeEvalDrawer));
document.getElementById('connectorAlertSettingsButton')?.addEventListener('click', () => {
  const form = document.getElementById('connectorAlertPolicyForm');
  const policy = connectorAlertPolicyState || {};
  form.reset();
  form.elements.emailEnabled.checked = policy.emailEnabled !== false;
  form.elements.minimumEmailSeverity.value = policy.minimumEmailSeverity || 'warning';
  form.querySelectorAll('input[name="notifyRoles"]').forEach((input) => { input.checked = (policy.notifyRoles || ['owner','admin']).includes(input.value); });
  form.elements.additionalEmails.value = (policy.additionalEmails || []).join(', ');
  form.elements.escalationMinutes.value = String(policy.escalationMinutes || 60);
  setKnowledgeOpsDrawer(connectorAlertSettingsDrawer);
});
document.querySelectorAll('[data-close-knowledge-ops]').forEach((button) => button.addEventListener('click', () => setKnowledgeOpsDrawer(null)));
knowledgeOpsDrawers.forEach((drawer) => drawer.addEventListener('click', (event) => { if (event.target === drawer) setKnowledgeOpsDrawer(null); }));

document.getElementById('connectorAlertPolicyForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const response = await fetch('/api/knowledge/connectors/alert-policy', {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      emailEnabled:form.elements.emailEnabled.checked,
      minimumEmailSeverity:form.elements.minimumEmailSeverity.value,
      notifyRoles:new FormData(form).getAll('notifyRoles'),
      additionalEmails:form.elements.additionalEmails.value,
      escalationMinutes:form.elements.escalationMinutes.value
    })
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Alert settings saved' : result.error || 'Alert settings could not be saved');
  if (response.ok) { setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

document.getElementById('knowledgeImportForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.elements.file.files[0];
  if (!file) return;
  const isDocument = /\.(pdf|docx)$/i.test(file.name);
  if (file.size > (isDocument ? 5 : 1) * 1024 * 1024) return showToast(isDocument ? 'PDF and DOCX imports are limited to 5 MB' : 'Text imports are limited to 1 MB');
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Importing...';
  const payload = { filename:file.name, mimeType:file.type, defaultStatus:form.elements.defaultStatus.value };
  if (isDocument) payload.contentBase64 = await fileToBase64(file);
  else payload.content = await file.text();
  const response = await fetch('/api/knowledge/imports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  submit.disabled = false;
  submit.textContent = 'Import knowledge';
  showToast(response.ok ? `${Number(result.created || 0)} created, ${Number(result.updated || 0)} updated` : result.error || 'Import failed');
  if (response.ok) { form.reset(); setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

document.getElementById('knowledgeConnectorForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const oauth = payload.provider === 'google_drive';
  const response = await fetch(oauth ? '/api/knowledge/connectors/google-drive/oauth/start' : '/api/knowledge/connectors', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (response.ok && oauth) { window.location.assign(result.authorizationUrl); return; }
  showToast(response.ok ? `Connector ${result.source.id} created` : result.error || 'Connector could not be created');
  if (response.ok) { form.reset(); setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

const knowledgeConnectorProvider = document.getElementById('knowledgeConnectorProvider');
knowledgeConnectorProvider?.addEventListener('change', updateConnectorFields);
function updateConnectorFields() {
  const provider = knowledgeConnectorProvider?.value || 'shopify';
  document.querySelectorAll('[data-connector-fields]').forEach((group) => {
    const active = group.dataset.connectorFields === provider;
    group.hidden = !active;
    group.querySelectorAll('input').forEach((input) => { input.disabled = !active; input.required = active && !['folderId', 'refreshToken', 'clientId', 'clientSecret'].includes(input.name); });
  });
  const live = provider !== 'api_push';
  document.querySelector('[data-live-connector-field]')?.toggleAttribute('hidden', !live);
  const note = document.getElementById('knowledgeConnectorNote');
  if (note) note.innerHTML = provider === 'google_drive' ? '<strong>Restricted scope notice</strong><span>Automatic folder sync uses Google Drive read-only access. Public production use requires Google verification and the applicable security assessment.</span>' : live ? '<strong>Initial sync</strong><span>The connector is queued immediately. Repeated provider references update existing knowledge records.</span>' : '<strong>Normalized contract</strong><span>Push records with an external reference, type, title, content, and keywords.</span>';
  const submit = document.querySelector('#knowledgeConnectorForm button[type="submit"]');
  if (submit) submit.textContent = provider === 'google_drive' ? 'Continue with Google' : 'Create connector';
}
updateConnectorFields();

function openKnowledgeSource(source) {
  if (!source || !knowledgeSourceDrawer) return;
  const form = document.getElementById('knowledgeSourceForm');
  form.reset();
  form.elements.sourceId.value = source.id;
  document.getElementById('knowledgeSourceDrawerTitle').textContent = source.name;
  document.getElementById('knowledgeSourceDrawerMeta').textContent = `${source.sourceType.replaceAll('_', ' ')} · ${Number(source.itemCount || 0)} items`;
  document.getElementById('knowledgeSourceHealth').innerHTML = `<div><span>Status</span><strong>${htmlEscape(source.status)}</strong></div><div><span>Last sync</span><strong>${htmlEscape(source.lastSyncedAt ? formatDateTime(source.lastSyncedAt) : 'Not yet')}</strong></div><div><span>Failures</span><strong>${Number(source.consecutiveFailures || 0)}</strong></div>`;
  const live = ['shopify', 'woocommerce', 'google_drive'].includes(source.sourceType);
  document.getElementById('knowledgeSourceLiveControls').hidden = !live;
  if (live) {
    form.elements.status.value = source.status === 'paused' ? 'paused' : 'ready';
    form.elements.syncIntervalMinutes.value = String(source.syncIntervalMinutes || 360);
    document.getElementById('knowledgeSourceCredentialFields').innerHTML = sourceCredentialFields(source);
  }
  setKnowledgeOpsDrawer(knowledgeSourceDrawer);
}

function sourceCredentialFields(source) {
  const masked = source.credentialsMasked || {};
  if (source.sourceType === 'shopify') return `<label>Rotate access token<input name="accessToken" type="password" placeholder="${htmlEscape(masked.accessToken || 'Leave blank to keep current')}"></label>`;
  if (source.sourceType === 'woocommerce') return `<label>Rotate consumer key<input name="consumerKey" placeholder="${htmlEscape(masked.consumerKey || 'Leave blank to keep current')}"></label><label>Rotate consumer secret<input name="consumerSecret" type="password" placeholder="${htmlEscape(masked.consumerSecret || 'Leave blank to keep current')}"></label>`;
  return '<div class="import-format-note"><strong>Managed Google authorization</strong><span>OAuth credentials are encrypted and managed by the platform. If Google access is revoked, delete this source and reconnect it through the Google consent flow.</span></div>';
}

document.getElementById('knowledgeSourceForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const sourceId = data.sourceId;
  const credentials = Object.fromEntries(['accessToken','consumerKey','consumerSecret','refreshToken','clientId','clientSecret'].filter((key) => data[key]).map((key) => [key, data[key]]));
  const response = await fetch(`/api/knowledge/sources/${encodeURIComponent(sourceId)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:data.status, syncIntervalMinutes:data.syncIntervalMinutes, credentials }) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Source settings saved' : result.error || 'Source settings could not be saved');
  if (response.ok) { setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

document.getElementById('syncKnowledgeSourceButton')?.addEventListener('click', async () => {
  const sourceId = document.getElementById('knowledgeSourceForm').elements.sourceId.value;
  const response = await fetch(`/api/knowledge/sources/${encodeURIComponent(sourceId)}/sync`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Source sync queued' : result.error || 'Source sync could not be queued');
  if (response.ok) { setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

document.getElementById('deleteKnowledgeSourceButton')?.addEventListener('click', async () => {
  const sourceId = document.getElementById('knowledgeSourceForm').elements.sourceId.value;
  const source = knowledgeSourcesById.get(String(sourceId));
  if (!window.confirm(`Delete ${source?.name || 'this source'} and archive its knowledge records?`)) return;
  const response = await fetch(`/api/knowledge/sources/${encodeURIComponent(sourceId)}`, { method:'DELETE' });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Source deleted and records archived' : result.error || 'Source could not be deleted');
  if (response.ok) { setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index=0; index<bytes.length; index+=0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

document.getElementById('knowledgeEvalForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const response = await fetch('/api/knowledge/evaluations/cases', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Evaluation saved' : result.error || 'Evaluation could not be saved');
  if (response.ok) { form.reset(); setKnowledgeOpsDrawer(null); await loadKnowledgeWorkspace(); }
});

document.getElementById('runKnowledgeEvalsButton')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Running...';
  const response = await fetch('/api/knowledge/evaluations/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
  const result = await response.json().catch(() => ({}));
  button.disabled = false;
  button.textContent = 'Run suite';
  showToast(response.ok ? `Evaluated ${Number(result.run?.caseCount || 0)} cases` : result.error || 'Evaluation run failed');
  if (response.ok) await loadKnowledgeWorkspace();
});

document.getElementById('refreshConnectorOpsButton')?.addEventListener('click', loadKnowledgeWorkspace);

const googleDriveResult = new URLSearchParams(window.location.search).get('googleDrive');
if (googleDriveResult) {
  setIntelligenceView('connectors');
  const message = new URLSearchParams(window.location.search).get('message');
  showToast(googleDriveResult === 'connected' ? 'Google Drive connected and initial sync queued' : message || 'Google Drive connection failed');
  window.history.replaceState({}, '', `${window.location.pathname}#intelligence`);
}

loadKnowledgeWorkspace();

const tenantCrmConnectDrawer = document.getElementById('tenantCrmConnectDrawer');
const tenantCrmManageDrawer = document.getElementById('tenantCrmManageDrawer');
const tenantCrmConnectForm = document.getElementById('tenantCrmConnectForm');
const tenantCrmManageForm = document.getElementById('tenantCrmManageForm');
let tenantCrmState = { providers:[], connections:[], runs:[], summary:{} };
let tenantCrmJobPoller = null;
let tenantCrmActiveJob = null;
let tenantCrmLatestJob = null;

function setTenantCrmDrawer(drawer) {
  [tenantCrmConnectDrawer, tenantCrmManageDrawer].filter(Boolean).forEach((item) => {
    const open = item === drawer;
    item.classList.toggle('open', open);
    item.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
}

function stopTenantCrmJobPolling() {
  if (tenantCrmJobPoller) window.clearInterval(tenantCrmJobPoller);
  tenantCrmJobPoller = null;
}

function updateTenantCrmJobLifecycle(job) {
  const status = job.status || 'queued';
  const lifecycle = tenantCrmLatestJob?.id === job.id ? tenantCrmLatestJob.lifecycle : [];
  if (status === 'processing' && !lifecycle.includes('queued')) lifecycle.push('queued');
  if (['succeeded','failed'].includes(status)) {
    if (!lifecycle.includes('queued')) lifecycle.push('queued');
    if (!lifecycle.includes('processing')) lifecycle.push('processing');
  }
  if (!lifecycle.includes(status)) lifecycle.push(status);
  tenantCrmLatestJob = { ...job, lifecycle };
}

function renderTenantCrmRuns(runs) {
  const lifecycleRun = tenantCrmLatestJob ? `<article><div><strong>Latest sync · ${htmlEscape(tenantCrmLatestJob.label || tenantCrmLatestJob.status)}</strong><span>${tenantCrmLatestJob.lifecycle.map((status) => htmlEscape(status.replace(/^./, (letter) => letter.toUpperCase()))).join(' → ')}</span></div><div><span>Sync lifecycle</span><small>${htmlEscape(tenantCrmLatestJob.lastError || 'Live status recorded')}</small></div></article>` : '';
  const activeRun = tenantCrmActiveJob ? `<article><div><strong>Current sync · ${htmlEscape(tenantCrmActiveJob.label || tenantCrmActiveJob.status)}</strong><span>${htmlEscape(tenantCrmActiveJob.status === 'queued' ? 'Waiting for worker' : 'Worker is processing')}</span></div><div><span>Attempt ${Number(tenantCrmActiveJob.attempts || 0)} of ${Number(tenantCrmActiveJob.maxAttempts || 0)}</span><small>${htmlEscape(tenantCrmActiveJob.lastError || 'Live status updates every 2 seconds')}</small></div></article>` : '';
  return lifecycleRun + activeRun + (runs.length ? runs.map((run) => `<article><div><strong>${htmlEscape(run.provider)} · ${htmlEscape(run.status)}</strong><span> · ${htmlEscape(run.triggerType)} · ${htmlEscape(formatDateTime(run.startedAt))}</span></div><div><span>${Number(run.succeededCount || 0)} synced</span><small> · ${Number(run.failedCount || 0)} failed · ${Number(run.durationMs || 0)} ms</small></div>${run.errorMessage ? `<p>${htmlEscape(run.errorMessage)}</p>` : ''}</article>`).join('') : (lifecycleRun || activeRun ? '' : '<p class="muted-copy">No CRM synchronisation attempts yet.</p>'));
}

function pollTenantCrmJob(jobId) {
  if (!jobId) return;
  stopTenantCrmJobPolling();
  const refresh = async () => {
    const response = await fetch(`/api/crm/jobs/${encodeURIComponent(jobId)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return stopTenantCrmJobPolling();
    const job = result.job || {};
    updateTenantCrmJobLifecycle(job);
    tenantCrmActiveJob = ['succeeded','failed'].includes(job.status) ? null : job;
    await loadTenantCrm();
    if (['succeeded','failed'].includes(job.status)) {
      showToast(`CRM synchronisation ${job.label || job.status}`);
      stopTenantCrmJobPolling();
    }
  };
  refresh();
  tenantCrmJobPoller = window.setInterval(refresh, 2000);
}

async function loadTenantCrm() {
  if (!document.getElementById('tenantCrmConnectionList')) return;
  const response = await fetch('/api/crm/operations');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'CRM integrations could not load');
  tenantCrmState = result;
  const summary = result.summary || {};
  document.getElementById('tenantCrmSummary').innerHTML = [
    ['Connected', summary.connected || 0, 'OAuth connections'],
    ['Needs attention', summary.attention || 0, 'Connection errors'],
    ['Successful 24h', summary.synced24h || 0, 'Worker runs'],
    ['Failed 24h', summary.failed24h || 0, 'Recovery queue']
  ].map(([label,value,note]) => `<article class="metric"><small>${htmlEscape(label)}</small><strong>${Number(value)}</strong><span>${htmlEscape(note)}</span></article>`).join('');
  document.getElementById('tenantCrmProviderStrip').innerHTML = result.providers.map((provider) => `<article><span class="provider-initial">${htmlEscape(provider.name.slice(0,1))}</span><div><strong>${htmlEscape(provider.name)}</strong><small>${provider.configured ? 'Ready to connect' : 'Platform setup required'}</small></div><span class="status ${provider.configured ? 'ready' : ''}">${provider.configured ? 'Ready' : 'Setup'}</span></article>`).join('');
  document.getElementById('tenantCrmConnectionList').innerHTML = result.connections.length ? result.connections.map((connection) => `<article class="tenant-crm-row"><div><strong>${htmlEscape(connection.provider.replace(/^./, (c) => c.toUpperCase()))}</strong><span>${htmlEscape(connection.accountName || connection.accountExternalId || 'Connected account')}</span></div><div><span class="status">${htmlEscape(connection.status)}</span><small>${htmlEscape(connection.lastHealthStatus || 'not checked')}</small></div><div><strong>${htmlEscape(connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt) : 'Not synced')}</strong><small>${Number(connection.consecutiveFailures || 0)} consecutive failures</small></div><button class="button ghost" data-tenant-crm-manage="${htmlEscape(connection.id)}" type="button">Manage</button></article>`).join('') : '<p class="muted-copy">No CRM connected yet. Choose Connect CRM to begin a secure OAuth flow.</p>';
  document.getElementById('tenantCrmRunList').innerHTML = renderTenantCrmRuns(result.runs);
  document.querySelectorAll('[data-tenant-crm-manage]').forEach((button) => button.addEventListener('click', () => openTenantCrmConnection(button.dataset.tenantCrmManage)));
}

function crmMappingFromForm(form) {
  return { name:form.elements.mapName.value.trim(), email:form.elements.mapEmail.value.trim(), phone:form.elements.mapPhone.value.trim(), segment:form.elements.mapSegment.value.trim(), optedIn:form.elements.mapOptedIn.value.trim() };
}

function crmMappingWithProviderDefaults(form, provider) {
  const defaults = tenantCrmState.providers.find((item) => item.provider === provider)?.defaultMapping || {};
  const mapping = crmMappingFromForm(form);
  for (const field of ['name','email','phone']) if (!mapping[field]) mapping[field] = defaults[field] || '';
  return mapping;
}

function applyTenantCrmDefaults(form, provider) {
  const mapping = tenantCrmState.providers.find((item) => item.provider === provider)?.defaultMapping || {};
  const pipedriveCoreFields = provider === 'pipedrive';
  form.elements.mapName.value = mapping.name || '';
  form.elements.mapEmail.value = mapping.email || '';
  form.elements.mapPhone.value = mapping.phone || '';
  form.elements.mapSegment.value = mapping.segment || '';
  form.elements.mapOptedIn.value = mapping.optedIn || '';
  for (const field of ['mapName','mapEmail','mapPhone']) form.elements[field].readOnly = pipedriveCoreFields;
}

function openTenantCrmConnection(id) {
  const connection = tenantCrmState.connections.find((item) => Number(item.id) === Number(id));
  if (!connection || !tenantCrmManageForm) return;
  tenantCrmManageForm.reset();
  tenantCrmManageForm.elements.connectionId.value = connection.id;
  tenantCrmManageForm.elements.status.value = connection.status === 'paused' ? 'paused' : 'connected';
  tenantCrmManageForm.elements.syncIntervalMinutes.value = String(connection.syncIntervalMinutes || 360);
  const mapping = connection.fieldMapping || {};
  tenantCrmManageForm.elements.mapName.value = mapping.name || '';
  tenantCrmManageForm.elements.mapEmail.value = mapping.email || '';
  tenantCrmManageForm.elements.mapPhone.value = mapping.phone || '';
  tenantCrmManageForm.elements.mapSegment.value = mapping.segment || '';
  tenantCrmManageForm.elements.mapOptedIn.value = mapping.optedIn || '';
  document.getElementById('tenantCrmManageTitle').textContent = connection.provider.replace(/^./, (c) => c.toUpperCase());
  document.getElementById('tenantCrmManageMeta').textContent = connection.accountName || connection.apiBaseUrl || 'Connected CRM account';
  document.getElementById('tenantCrmHealth').innerHTML = `<div><span>Status</span><strong>${htmlEscape(connection.status)}</strong></div><div><span>Health</span><strong>${htmlEscape(connection.lastHealthStatus || 'not checked')}</strong></div><div><span>Last sync</span><strong>${htmlEscape(connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt) : 'Not yet')}</strong></div>`;
  setTenantCrmDrawer(tenantCrmManageDrawer);
}

document.getElementById('connectTenantCrmButton')?.addEventListener('click', () => { tenantCrmConnectForm?.reset(); if (tenantCrmConnectForm) applyTenantCrmDefaults(tenantCrmConnectForm, tenantCrmConnectForm.elements.provider.value); setTenantCrmDrawer(tenantCrmConnectDrawer); });
document.getElementById('tenantCrmProvider')?.addEventListener('change', (event) => applyTenantCrmDefaults(tenantCrmConnectForm, event.target.value));
document.getElementById('refreshTenantCrmButton')?.addEventListener('click', loadTenantCrm);
document.querySelectorAll('[data-close-tenant-crm]').forEach((button) => button.addEventListener('click', () => setTenantCrmDrawer(null)));
[tenantCrmConnectDrawer, tenantCrmManageDrawer].filter(Boolean).forEach((drawer) => drawer.addEventListener('click', (event) => { if (event.target === drawer) setTenantCrmDrawer(null); }));

tenantCrmConnectForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const provider = form.elements.provider.value;
  const readiness = tenantCrmState.providers.find((item) => item.provider === provider);
  if (!readiness?.configured) return showToast(`${readiness?.name || provider} OAuth needs platform configuration first`);
  const response = await fetch(`/api/crm/oauth/${encodeURIComponent(provider)}/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ syncIntervalMinutes:form.elements.syncIntervalMinutes.value, fieldMapping:crmMappingWithProviderDefaults(form, provider) }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'CRM authorization could not start');
  window.location.assign(result.authorizationUrl);
});

tenantCrmManageForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.connectionId.value;
  const response = await fetch(`/api/crm/connections/${encodeURIComponent(id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:form.elements.status.value, syncIntervalMinutes:form.elements.syncIntervalMinutes.value, fieldMapping:crmMappingFromForm(form) }) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'CRM settings saved' : result.error || 'CRM settings could not be saved');
  if (response.ok) { setTenantCrmDrawer(null); await loadTenantCrm(); }
});

document.getElementById('testTenantCrmButton')?.addEventListener('click', async () => {
  const id = tenantCrmManageForm.elements.connectionId.value;
  const response = await fetch(`/api/crm/connections/${encodeURIComponent(id)}/test`, { method:'POST' });
  const result = await response.json().catch(() => ({}));
  showToast(result.health ? `${result.health.status}: ${result.health.message}` : result.error || 'Connection test failed');
  await loadTenantCrm(); if (response.ok) openTenantCrmConnection(id);
});

document.getElementById('syncTenantCrmButton')?.addEventListener('click', async () => {
  const id = tenantCrmManageForm.elements.connectionId.value;
  const response = await fetch(`/api/crm/connections/${encodeURIComponent(id)}/sync`, { method:'POST' });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'CRM synchronisation queued' : result.error || 'CRM sync could not be queued');
  if (response.ok) {
    updateTenantCrmJobLifecycle({ id:result.job?.jobId, status:'queued', label:'Queued' });
    tenantCrmActiveJob = tenantCrmLatestJob;
    setTenantCrmDrawer(null);
    await loadTenantCrm();
    pollTenantCrmJob(result.job?.jobId);
  }
});

document.getElementById('disconnectTenantCrmButton')?.addEventListener('click', async () => {
  if (!window.confirm('Disconnect this CRM and remove its stored OAuth credentials?')) return;
  const id = tenantCrmManageForm.elements.connectionId.value;
  const response = await fetch(`/api/crm/connections/${encodeURIComponent(id)}`, { method:'DELETE' });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'CRM disconnected' : result.error || 'CRM could not be disconnected');
  if (response.ok) { setTenantCrmDrawer(null); await loadTenantCrm(); }
});

const tenantCrmResult = new URLSearchParams(window.location.search).get('result');
if (tenantCrmResult) {
  showPage('integrations');
  const provider = new URLSearchParams(window.location.search).get('crm') || 'CRM';
  const message = new URLSearchParams(window.location.search).get('message');
  showToast(tenantCrmResult === 'connected' ? `${provider} connected and initial sync queued` : message || `${provider} connection failed`);
  window.history.replaceState({}, '', `${window.location.pathname}#integrations`);
}
loadTenantCrm();

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

function loadFacebookSdk(appId, graphVersion) {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.FB), { once:true });
      existing.addEventListener('error', () => reject(new Error('Meta SDK could not load')), { once:true });
      return;
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie:true, xfbml:false, version:graphVersion });
      resolve(window.FB);
    };
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.addEventListener('error', () => reject(new Error('Meta SDK could not load')), { once:true });
    document.head.appendChild(script);
  });
}

function captureEmbeddedSignupAssets(payload) {
  const data = payload?.data || payload || {};
  if (!metaEmbeddedSignupForm) return;
  if (data.waba_id) metaEmbeddedSignupForm.elements.wabaId.value = data.waba_id;
  if (data.phone_number_id) metaEmbeddedSignupForm.elements.phoneNumberId.value = data.phone_number_id;
}

window.addEventListener('message', (event) => {
  if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;
  let payload = event.data;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return; }
  }
  if (payload?.type === 'WA_EMBEDDED_SIGNUP') captureEmbeddedSignupAssets(payload);
});

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
    try {
      const facebook = await loadFacebookSdk(config.appId, config.graphVersion);
      facebook.login((response) => {
        const code = response?.authResponse?.code;
        if (!code) return showToast('Embedded Signup was cancelled or did not return an authorization code');
        if (metaEmbeddedSignupForm) metaEmbeddedSignupForm.elements.code.value = code;
        showToast('Embedded Signup returned an authorization code. Complete the saved asset details below.');
      }, {
        config_id:config.configId,
        response_type:config.launchParams.response_type,
        override_default_response_type:config.launchParams.override_default_response_type,
        extras:config.launchParams.extras
      });
    } catch (error) {
      showToast(error.message || 'Embedded Signup could not start');
    }
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
  const commerceAutomationReadiness = document.getElementById('commerceAutomationReadiness');
  const commerceAutomationRecommendationList = document.getElementById('commerceAutomationRecommendationList');
  const commerceAutomationActivityList = document.getElementById('commerceAutomationActivityList');
  const commerceAutomationPreviewPanel = document.getElementById('commerceAutomationPreviewPanel');
  const syncCommerceAutomationTemplatesBtn = document.getElementById('syncCommerceAutomationTemplatesBtn');
  const inventoryAlertList = document.getElementById('inventoryAlertList');
  const inventoryAlertCount = document.getElementById('inventoryAlertCount');
  const productSubmitBtn = document.getElementById('productSubmitBtn');
  const cancelProductEditBtn = document.getElementById('cancelProductEditBtn');
  const commerceMetrics = document.getElementById('commerceMetrics');
  const orderDetail = document.getElementById('orderDetail');
  let currentProducts = [];
  let currentAutomationPreviewRuleKey = '';

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
      renderMetric('Catalog issues', summary.catalogIssues || 0, 'WhatsApp items needing product links'),
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
    const readiness = product.catalogReadiness || {};
    const readinessClass = readiness.ready ? 'ready' : 'needs-attention';
    const readinessText = readiness.ready ? 'Catalog ready' : `${Number(readiness.score || 0)}/${Number(readiness.total || 4)} ready`;
    const missing = readiness.missing?.length ? `<p class="muted-copy">Missing ${htmlEscape(readiness.missing.join(', '))}</p>` : '';
    const activateAction = product.status === 'draft' ? `<button class="link-button" data-product-activate="${htmlEscape(product.id)}" type="button">Activate</button>` : '';
    return `<article class="product-card" data-product-id="${htmlEscape(product.id)}"><div class="product-thumb">${image}</div><div><small>#${htmlEscape(product.id)} · ${htmlEscape(product.sku || product.metaProductRetailerId || 'SKU')}</small><h4>${htmlEscape(product.name)}</h4><p>${htmlEscape(product.description || 'Ready to share in WhatsApp.')}</p><p class="muted-copy">Stock ${Number(product.inventoryCount || 0)} · Retailer ${htmlEscape(product.metaProductRetailerId || product.sku || 'not set')}</p><span class="product-readiness ${readinessClass}">${htmlEscape(readinessText)}</span>${missing}<div class="commerce-row-actions"><button class="link-button" data-product-edit="${htmlEscape(product.id)}" type="button">Edit</button>${activateAction}<button class="link-button" data-product-archive="${htmlEscape(product.id)}" type="button">Archive</button></div></div><strong>R ${htmlEscape(product.price)}</strong><span class="status">${htmlEscape(product.status)}</span></article>`;
  }

  function bindProductActions() {
    document.querySelectorAll('[data-product-edit]').forEach((button) => {
      button.addEventListener('click', () => fillProductForm(button.dataset.productEdit));
    });
    document.querySelectorAll('[data-product-archive]').forEach((button) => {
      button.addEventListener('click', () => archiveProductFromCard(button.dataset.productArchive));
    });
    document.querySelectorAll('[data-product-activate]').forEach((button) => {
      button.addEventListener('click', () => activateProductFromCard(button.dataset.productActivate));
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
    openAppModal('productForm', { title: `Edit product #${product.id}`, kicker: 'Commerce' });
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

  async function activateProductFromCard(productId) {
    const product = currentProducts.find((item) => String(item.id) === String(productId));
    if (!product) return;
    const response = await fetch(`/api/commerce/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...product, status: 'active' })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Product activated' : result.error || 'Product could not be activated');
    if (response.ok) loadCommerce();
  }

  function renderOrderTable(orders) {
    if (!orders.length) return '<p class="muted-copy">WhatsApp catalogue orders will appear here.</p>';
    const rows = orders.map((order) => {
      const catalogIssueCount = Number(order.catalogIssueCount || order.metadata?.unmatchedItems?.length || 0);
      const catalogBadge = catalogIssueCount ? `<span class="order-issue-badge">${catalogIssueCount} catalog fix</span>` : '';
      return `<tr class="${catalogIssueCount ? 'order-row-needs-attention' : ''}"><td>${htmlEscape(order.customerName)}<br><small>${htmlEscape(order.customerPhone)}</small>${catalogBadge}</td><td><span class="status">${htmlEscape(order.status)}</span></td><td>${Number(order.itemCount || 0)}</td><td>R ${htmlEscape(order.total)}${order.discountCode ? `<br><small>${htmlEscape(order.discountCode)} saved R ${htmlEscape(order.discount || '0.00')}</small>` : ''}</td><td>${htmlEscape(order.source)}</td><td><div class="commerce-row-actions"><button class="link-button" data-commerce-order="${htmlEscape(order.id)}" type="button">View</button><button class="link-button" data-commerce-pay="${htmlEscape(order.id)}" type="button">Pay link</button><button class="link-button" data-commerce-status="${htmlEscape(order.id)}" type="button">Update</button><button class="link-button" data-commerce-fulfil="${htmlEscape(order.id)}" type="button">Fulfil</button><button class="link-button" data-commerce-coupon="${htmlEscape(order.id)}" type="button">Coupon</button><button class="link-button" data-commerce-recover="${htmlEscape(order.id)}" type="button">Recover</button><button class="link-button" data-commerce-reconcile="${htmlEscape(order.id)}" type="button">Reconcile</button><button class="link-button" data-commerce-return="${htmlEscape(order.id)}" type="button">Return</button><button class="link-button" data-commerce-post-purchase="${htmlEscape(order.id)}" type="button">Post-sale</button><button class="link-button" data-commerce-schedule-post-purchase="${htmlEscape(order.id)}" type="button">Schedule</button></div></td></tr>`;
    }).join('');
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
      commerceAutomationInsightStrip.innerHTML = `<span>Scheduled ${Number(summary.scheduled || 0)}</span><span>Sent ${Number(summary.sent || 0)}</span><span>Suppressed ${Number(summary.suppressed || 0)}</span><span>Revenue R ${htmlEscape(summary.attributedRevenue || '0.00')}</span><span>Cost R ${htmlEscape(summary.estimatedCost || '0.00')}</span><span>ROI ${htmlEscape(roi)}</span><span>Rate ${Number(summary.sendRate || 0)}%</span>`;
    }
    renderAutomationReadiness(rules);
    if (commerceAutomationRecommendationList) {
      const recommendations = insights?.recommendations || [];
      renderAutomationRecommendations(recommendations);
    }
    if (commerceAutomationActivityList) {
      renderAutomationActivity(insights?.recent || []);
    }
    if (!commerceAutomationRuleList) return;
    commerceAutomationRuleList.innerHTML = rules.length
      ? rules.map((rule) => {
        const metrics = metricsByRule.get(rule.ruleKey) || {};
        const roi = metrics.roi === null || metrics.roi === undefined ? '--' : `${Number(metrics.roi).toFixed(2)}x`;
        const template = rule.templateReadiness || {};
        const templateClass = template.ready ? 'ready' : 'missing';
        const templateLabel = template.ready ? 'Template ready' : 'Template needed';
        const templateAction = renderAutomationTemplateAction(rule.ruleKey, template, 'link-button');
        return `<article><div><strong>${htmlEscape(rule.name)}</strong><span>${htmlEscape(rule.triggerStatus)} · ${htmlEscape(rule.promptType)}</span><small>${htmlEscape(rule.description || '')}</small><small>${Number(rule.delayValue || 0)} ${htmlEscape(rule.delayUnit || 'hours')} delay · ${rule.enabled ? 'enabled' : 'paused'}</small><small><span class="automation-template-pill ${templateClass}">${htmlEscape(templateLabel)}</span> ${htmlEscape(template.templateName || '')} · ${htmlEscape(template.status || 'Missing')} · ${htmlEscape(template.category || '')}</small><small>${Number(metrics.scheduled || 0)} scheduled · ${Number(metrics.sent || 0)} sent · ${Number(metrics.suppressed || 0)} suppressed · ${Number(metrics.attributedOrders || 0)} order(s)</small><small>R ${htmlEscape(metrics.attributedRevenue || '0.00')} revenue · R ${htmlEscape(metrics.estimatedCost || '0.00')} cost · ROI ${htmlEscape(roi)}</small><small>${htmlEscape(rule.recommendation?.action || 'Monitor')}: ${htmlEscape(rule.recommendation?.message || 'Let this automation gather more activity.')}</small></div><div class="commerce-row-actions"><button class="link-button" data-automation-preview="${htmlEscape(rule.ruleKey)}" type="button">Preview</button><button class="link-button" data-automation-apply-ready="${htmlEscape(rule.ruleKey)}" type="button">Review apply</button>${templateAction}<button class="link-button" data-automation-toggle="${htmlEscape(rule.ruleKey)}" data-enabled="${rule.enabled ? 'true' : 'false'}" type="button">${rule.enabled ? 'Pause' : 'Enable'}</button><button class="link-button" data-automation-delay="${htmlEscape(rule.ruleKey)}" data-delay-value="${htmlEscape(rule.delayValue)}" data-delay-unit="${htmlEscape(rule.delayUnit)}" type="button">Tune</button></div></article>`;
      }).join('')
      : '<p class="muted-copy">Post-purchase automation rules will appear here.</p>';
    commerceAutomationRuleList.querySelectorAll('[data-automation-preview]').forEach((button) => {
      button.addEventListener('click', () => previewAutomationRule(button.dataset.automationPreview));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-apply-ready]').forEach((button) => {
      button.addEventListener('click', () => previewAutomationRule(button.dataset.automationApplyReady));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-template]').forEach((button) => {
      button.addEventListener('click', () => installAutomationTemplate(button.dataset.automationTemplate, { button }));
    });
    commerceAutomationRuleList.querySelectorAll('[data-automation-template-submit]').forEach((button) => {
      button.addEventListener('click', () => submitAutomationTemplate(button.dataset.automationTemplateSubmit, { button }));
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

  function renderAutomationRecommendations(recommendations) {
    if (!commerceAutomationRecommendationList) return;
    commerceAutomationRecommendationList.innerHTML = recommendations.length
      ? recommendations.map((item) => `<article><div><strong>${htmlEscape(item.action)}</strong><span>${htmlEscape(item.priority || 'low')}</span><small>${htmlEscape(item.message || '')}</small></div>${automationRecommendationAction(item)}</article>`).join('')
      : '<p class="muted-copy">Automation recommendations will appear after activity.</p>';
    commerceAutomationRecommendationList.querySelectorAll('[data-recommendation-template]').forEach((button) => {
      button.addEventListener('click', () => installAutomationTemplate(button.dataset.recommendationTemplate, { button }));
    });
    commerceAutomationRecommendationList.querySelectorAll('[data-recommendation-submit]').forEach((button) => {
      button.addEventListener('click', () => submitAutomationTemplate(button.dataset.recommendationSubmit, { button }));
    });
    commerceAutomationRecommendationList.querySelectorAll('[data-recommendation-sync]').forEach((button) => {
      button.addEventListener('click', () => syncAutomationTemplates({ button }));
    });
    commerceAutomationRecommendationList.querySelectorAll('[data-recommendation-preview]').forEach((button) => {
      button.addEventListener('click', () => previewAutomationRule(button.dataset.recommendationPreview));
    });
  }

  function automationRecommendationAction(item) {
    const ruleKey = htmlEscape(item.ruleKey || '');
    if (!ruleKey && item.action !== 'Sync approval') return '';
    if (item.action === 'Create template') {
      return `<button class="link-button" data-recommendation-template="${ruleKey}" type="button">Create</button>`;
    }
    if (item.action === 'Submit template') {
      return `<button class="link-button" data-recommendation-submit="${ruleKey}" type="button">Submit</button>`;
    }
    if (item.action === 'Sync approval') {
      return '<button class="link-button" data-recommendation-sync type="button">Sync</button>';
    }
    return `<button class="link-button" data-recommendation-preview="${ruleKey}" type="button">Review</button>`;
  }

  function renderAutomationReadiness(rules) {
    if (!commerceAutomationReadiness) return;
    const counts = rules.reduce((acc, rule) => {
      const template = rule.templateReadiness || {};
      if (template.ready) acc.ready += 1;
      else if (template.status === 'Submitted') acc.pending += 1;
      else if (template.status === 'Draft') acc.draft += 1;
      else acc.missing += 1;
      return acc;
    }, { ready: 0, pending: 0, draft: 0, missing: 0 });
    const total = rules.length;
    const nextRule = rules.find((rule) => !rule.templateReadiness?.ready) || null;
    const next = automationReadinessNextAction(nextRule);
    commerceAutomationReadiness.innerHTML = `
      <article class="${counts.ready === total && total ? 'ready' : 'attention'}">
        <small>Template readiness</small>
        <strong>${Number(counts.ready)} / ${Number(total)}</strong>
        <span>${counts.ready === total && total ? 'Ready for live automation' : 'Needs template work before live automation'}</span>
      </article>
      <article><small>Awaiting Meta</small><strong>${Number(counts.pending)}</strong><span>Submitted templates</span></article>
      <article><small>Drafts</small><strong>${Number(counts.draft)}</strong><span>Ready to submit</span></article>
      <article><small>Missing</small><strong>${Number(counts.missing)}</strong><span>Need a template</span></article>
      <article class="automation-readiness-next"><small>Next action</small><strong>${htmlEscape(next.label)}</strong><span>${htmlEscape(next.detail)}</span>${next.button}</article>
    `;
    commerceAutomationReadiness.querySelector('[data-readiness-template]')?.addEventListener('click', (event) => {
      installAutomationTemplate(event.currentTarget.dataset.readinessTemplate, { button: event.currentTarget });
    });
    commerceAutomationReadiness.querySelector('[data-readiness-submit]')?.addEventListener('click', (event) => {
      submitAutomationTemplate(event.currentTarget.dataset.readinessSubmit, { button: event.currentTarget });
    });
    commerceAutomationReadiness.querySelector('[data-readiness-sync]')?.addEventListener('click', (event) => {
      syncAutomationTemplates({ button: event.currentTarget });
    });
    commerceAutomationReadiness.querySelector('[data-readiness-preview]')?.addEventListener('click', (event) => {
      previewAutomationRule(event.currentTarget.dataset.readinessPreview);
    });
  }

  function automationReadinessNextAction(rule) {
    if (!rule) {
      return {
        label: 'All templates ready',
        detail: 'Approved templates are available for every automation.',
        button: '<button class="link-button" data-readiness-sync type="button">Sync templates</button>'
      };
    }
    const template = rule.templateReadiness || {};
    const ruleKey = htmlEscape(rule.ruleKey || '');
    if (template.status === 'Missing') {
      return {
        label: 'Create template',
        detail: `${rule.name || 'Automation'} needs an approved template.`,
        button: `<button class="link-button" data-readiness-template="${ruleKey}" type="button">Create</button>`
      };
    }
    if (template.status === 'Draft') {
      return {
        label: 'Submit to Meta',
        detail: `${template.templateLabel || template.templateName || 'Template'} is still a draft.`,
        button: `<button class="link-button" data-readiness-submit="${ruleKey}" type="button">Submit</button>`
      };
    }
    if (template.status === 'Submitted') {
      return {
        label: 'Sync approval',
        detail: `${template.templateLabel || template.templateName || 'Template'} is awaiting review.`,
        button: '<button class="link-button" data-readiness-sync type="button">Sync</button>'
      };
    }
    return {
      label: 'Review template',
      detail: template.message || `${rule.name || 'Automation'} is not ready for live sends.`,
      button: `<button class="link-button" data-readiness-preview="${ruleKey}" type="button">Preview</button>`
    };
  }

  function renderAutomationTemplateAction(ruleKey, template, buttonClass = 'button') {
    if (template?.ready) return '';
    if (template?.templateId && template.status !== 'Submitted') {
      return `<button class="${buttonClass}" data-automation-template-submit="${htmlEscape(ruleKey)}" type="button">Submit template</button>`;
    }
    if (!template?.templateId) {
      return `<button class="${buttonClass}" data-automation-template="${htmlEscape(ruleKey)}" type="button">Create template</button>`;
    }
    return '';
  }

  function automationActivityLabel(event) {
    if (event.type === 'attributed_order') return `Attributed order #${event.orderId}`;
    if (event.type === 'suppressed') return `${event.promptType || 'Prompt'} suppressed`;
    if (event.type === 'sent') return `${event.promptType || 'Prompt'} sent`;
    if (event.type === 'scheduled') return `${event.promptType || 'Prompt'} scheduled`;
    return event.type || 'Automation event';
  }

  function automationActivityDetail(event) {
    const parts = [
      event.occurredAt ? formatShortDate(event.occurredAt) : '',
      event.revenue ? `R ${event.revenue}` : '',
      event.deduped ? 'deduped' : '',
      event.reason ? event.reason.replace(/_/g, ' ') : '',
      event.retryAt ? `retry ${formatShortDate(event.retryAt)}` : '',
      event.mode ? event.mode : ''
    ].filter(Boolean);
    return parts.join(' · ') || `Order #${event.orderId || '-'}`;
  }

  async function previewAutomationRule(ruleKey) {
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/preview`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || 'Automation preview could not load');
    renderAutomationPreview(result);
  }

  function renderAutomationPreview(result) {
    if (!commerceAutomationPreviewPanel) return;
    const summary = result.summary || {};
    const orders = result.orders || [];
    const sendableToSchedule = summary.sendableToSchedule ?? summary.readyToSchedule ?? 0;
    const template = result.rule?.templateReadiness || {};
    const applyDisabled = Number(sendableToSchedule) < 1 ? ' disabled' : '';
    const ruleKey = result.rule?.ruleKey || result.rule?.id || '';
    const templateAction = renderAutomationTemplateAction(ruleKey, template, 'button');
    currentAutomationPreviewRuleKey = ruleKey;
    commerceAutomationPreviewPanel.classList.remove('hidden');
    commerceAutomationPreviewPanel.innerHTML = `
      <header>
        <div>
          <h4>${htmlEscape(result.rule?.name || 'Automation preview')}</h4>
          <p>${htmlEscape(result.rule?.description || 'Review which WhatsApp commerce prompts can be safely scheduled now.')}</p>
          <p><span class="automation-template-pill ${template.ready ? 'ready' : 'missing'}">${htmlEscape(template.ready ? 'Template ready' : 'Template needed')}</span> ${htmlEscape(template.templateName || '')} · ${htmlEscape(template.status || 'Missing')} · ${htmlEscape(template.message || '')}</p>
        </div>
        <div class="commerce-row-actions">
          <button class="button primary" data-preview-apply="${htmlEscape(result.rule?.ruleKey || result.rule?.id || '')}" type="button"${applyDisabled}>Apply ${Number(sendableToSchedule)}</button>
          ${templateAction}
          <button class="button" data-preview-close type="button">Close</button>
        </div>
      </header>
      <div class="automation-apply-result hidden" data-preview-result></div>
      <div class="automation-preview-metrics">
        <span><strong>${Number(sendableToSchedule)}</strong> sendable now</span>
        <span><strong>${Number(summary.readyToSchedule || 0)}</strong> matching unscheduled</span>
        <span><strong>${Number(summary.alreadyScheduled || 0)}</strong> already scheduled</span>
        <span><strong>${Number(summary.suppressedByConsent || 0)}</strong> opted out</span>
        <span><strong>${Number(summary.suppressedByCooldown || 0)}</strong> in cooldown</span>
        <span><strong>${Number(summary.suppressedByTemplate || 0)}</strong> template hold</span>
      </div>
      <div class="automation-preview-orders">
        ${orders.length ? orders.slice(0, 8).map(renderAutomationPreviewOrder).join('') : '<p class="muted-copy">No matching orders for this rule yet.</p>'}
      </div>
    `;
    commerceAutomationPreviewPanel.querySelector('[data-preview-close]')?.addEventListener('click', () => {
      commerceAutomationPreviewPanel.classList.add('hidden');
      currentAutomationPreviewRuleKey = '';
    });
    commerceAutomationPreviewPanel.querySelector('[data-preview-apply]')?.addEventListener('click', (event) => {
      const ruleKey = event.currentTarget.dataset.previewApply;
      if (ruleKey) applyReadyAutomationRule(ruleKey, { source: 'preview', button: event.currentTarget });
    });
    commerceAutomationPreviewPanel.querySelector('[data-preview-template]')?.addEventListener('click', (event) => {
      const ruleKey = event.currentTarget.dataset.previewTemplate;
      if (ruleKey) installAutomationTemplate(ruleKey, { button: event.currentTarget });
    });
    commerceAutomationPreviewPanel.querySelector('[data-automation-template]')?.addEventListener('click', (event) => {
      const ruleKey = event.currentTarget.dataset.automationTemplate;
      if (ruleKey) installAutomationTemplate(ruleKey, { button: event.currentTarget });
    });
    commerceAutomationPreviewPanel.querySelector('[data-automation-template-submit]')?.addEventListener('click', (event) => {
      const ruleKey = event.currentTarget.dataset.automationTemplateSubmit;
      if (ruleKey) submitAutomationTemplate(ruleKey, { button: event.currentTarget });
    });
  }

  function renderAutomationPreviewOrder(order) {
    const state = order.sendable ? 'sendable' : order.suppressionLabel || (order.alreadyScheduled ? 'already scheduled' : 'not sendable');
    const cls = order.sendable ? 'ready' : order.suppressionReason === 'customer_opted_out' ? 'blocked' : 'held';
    const extra = order.previousSentAt ? `Previous send ${formatShortDate(order.previousSentAt)}` : order.previousOrderId ? `Previous order #${order.previousOrderId}` : '';
    return `<article class="${htmlEscape(cls)}"><div><strong>#${htmlEscape(order.id)} ${htmlEscape(order.customerName || 'WhatsApp customer')}</strong><span>${htmlEscape(order.customerPhone || '')}</span><small>R ${htmlEscape(order.total || '0.00')} · ${htmlEscape(order.status || '')}${extra ? ` · ${htmlEscape(extra)}` : ''}</small></div><em>${htmlEscape(state)}</em></article>`;
  }

  async function applyReadyAutomationRule(ruleKey, options = {}) {
    const button = options.button || null;
    if (button) {
      button.disabled = true;
      button.textContent = 'Applying...';
    }
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/apply-ready`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    if (options.source === 'preview') {
      renderAutomationApplyResult(result, response.ok);
    }
    showToast(response.ok ? `${Number(result.summary?.scheduled || 0)} automation prompt(s) scheduled` : result.error || 'Automation could not be applied');
    if (response.ok) {
      await loadCommerce();
    } else if (button) {
      button.disabled = false;
      button.textContent = 'Apply';
    }
  }

  async function installAutomationTemplate(ruleKey, options = {}) {
    const resetButton = setAutomationActionBusy(options.button, 'Creating...');
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/template`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok
      ? `${result.created ? 'Created' : 'Found'} ${result.template?.name || 'automation template'}`
      : result.error || 'Automation template could not be created');
    if (response.ok) {
      await loadCommerce();
      await refreshAutomationPreviewIfOpen(ruleKey);
    } else {
      resetButton();
    }
  }

  async function submitAutomationTemplate(ruleKey, options = {}) {
    const resetButton = setAutomationActionBusy(options.button, 'Submitting...');
    const response = await fetch(`/api/commerce/automation-rules/${encodeURIComponent(ruleKey)}/template/submit`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok
      ? `${result.template?.name || 'Automation template'} submitted to Meta`
      : result.error || 'Automation template could not be submitted');
    if (response.ok) {
      await loadCommerce();
      await refreshAutomationPreviewIfOpen(ruleKey);
    } else {
      resetButton();
    }
  }

  async function syncAutomationTemplates(options = {}) {
    const resetButton = setAutomationActionBusy(options.button, 'Syncing...');
    const response = await fetch('/api/commerce/automation-templates/sync', { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    const changed = Number(result.sync?.synced || 0);
    showToast(response.ok
      ? `Template status sync complete${changed ? ` · ${changed} update(s)` : ''}`
      : result.error || 'Template status sync failed');
    if (response.ok) {
      await loadCommerce();
      await refreshAutomationPreviewIfOpen();
    } else {
      resetButton();
    }
  }

  function setAutomationActionBusy(button, label) {
    if (!button) return () => {};
    const text = button.textContent;
    button.disabled = true;
    button.textContent = label;
    return () => {
      button.disabled = false;
      button.textContent = text;
    };
  }

  async function refreshAutomationPreviewIfOpen(ruleKey = '') {
    const openRuleKey = currentAutomationPreviewRuleKey;
    if (!openRuleKey || commerceAutomationPreviewPanel?.classList.contains('hidden')) return;
    if (ruleKey && String(ruleKey) !== String(openRuleKey)) return;
    await previewAutomationRule(openRuleKey);
  }

  function renderAutomationApplyResult(result, ok) {
    const target = commerceAutomationPreviewPanel?.querySelector('[data-preview-result]');
    if (!target) return;
    const summary = result.summary || {};
    const skipped = result.skipped || [];
    const skippedReasons = skipped.reduce((acc, item) => {
      const label = item.reasonLabel || item.reason || 'Not sendable';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const reasonList = Object.entries(skippedReasons)
      .map(([label, count]) => `<li>${htmlEscape(label)} <strong>${Number(count)}</strong></li>`)
      .join('');
    target.className = `automation-apply-result ${ok ? 'success' : 'error'}`;
    target.innerHTML = ok
      ? `<strong>${Number(summary.scheduled || 0)} prompt(s) scheduled</strong><span>${Number(summary.skipped || 0)} skipped because they were already scheduled, opted out, or in cooldown.</span>${reasonList ? `<ul>${reasonList}</ul>` : ''}`
      : `<strong>Automation could not be applied</strong><span>${htmlEscape(result.error || 'Please try again after checking this rule.')}</span>`;
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
    bindOrderDetailActions(detail);
  }

  function renderOrderDetail(order) {
    const metadata = order.metadata || {};
    const unmatchedItems = Array.isArray(metadata.unmatchedItems) ? metadata.unmatchedItems : [];
    const diagnostics = renderOrderDiagnostics(order, metadata, unmatchedItems);
    const items = (order.items || []).map((item) => {
      const retailerId = item.metaProductRetailerId || item.sku || '';
      const unmatched = !item.productId || unmatchedItems.some((entry) => entry.productRetailerId === retailerId);
      const action = unmatched ? `<button class="link-button" data-order-item-link="${htmlEscape(item.id || '')}" data-order-item-retailer="${htmlEscape(retailerId)}" type="button">Link product</button>` : '';
      return `<li class="${unmatched ? 'order-item-unmatched' : ''}"><span>${Number(item.quantity || 1)} x ${htmlEscape(item.productName || item.sku)} · R ${htmlEscape(item.unitPrice || '0.00')}</span><small>${retailerId ? `Retailer ID ${htmlEscape(retailerId)}` : 'No retailer ID'}${unmatched ? ' · needs catalogue match' : ''}</small>${action}</li>`;
    }).join('');
    const events = (order.events || []).slice(0, 6).map((event) => `<li>${htmlEscape(event.eventType)} ${event.status ? `· ${htmlEscape(event.status)}` : ''}<small>${htmlEscape(event.note || '')}</small></li>`).join('');
    const fulfilment = order.trackingNumber || order.fulfilmentProvider || order.trackingUrl
      ? `<p>${htmlEscape(order.fulfilmentProvider || 'Fulfilment')} ${order.trackingNumber ? `· ${htmlEscape(order.trackingNumber)}` : ''} ${order.trackingUrl ? `· ${htmlEscape(order.trackingUrl)}` : ''}</p>`
      : '';
    const discount = order.discountCode ? `<p>Coupon ${htmlEscape(order.discountCode)} saved R ${htmlEscape(order.discount || '0.00')} from subtotal R ${htmlEscape(order.subtotal || order.total)}</p>` : '';
    return `<article><header><h4>Order #${htmlEscape(order.id)}</h4><span class="status">${htmlEscape(order.status)}</span></header><p>${htmlEscape(order.customerName)} · ${htmlEscape(order.customerPhone)}</p><p><strong>R ${htmlEscape(order.total)}</strong> ${order.paymentReady ? '· payment link ready' : '· no payment link yet'}</p>${diagnostics}${discount}${fulfilment}<ul class="order-line-items">${items || '<li>No line items found.</li>'}</ul><h4>Timeline</h4><ul>${events || '<li>No events yet.</li>'}</ul></article>`;
  }

  function renderOrderDiagnostics(order, metadata, unmatchedItems) {
    const isWhatsAppCatalog = order.source === 'whatsapp_catalog' || metadata.catalogId || metadata.messageId || unmatchedItems.length;
    if (!isWhatsAppCatalog) return '';
    const statusClass = unmatchedItems.length ? 'needs-attention' : 'ready';
    const statusText = unmatchedItems.length ? `${unmatchedItems.length} catalogue match needed` : 'Catalog matched';
    const unmatched = unmatchedItems.length
      ? `<ul>${unmatchedItems.map((item) => `<li><strong>${htmlEscape(item.productRetailerId || 'unknown')}</strong><small>${Number(item.quantity || 1)} x ${htmlEscape(item.currency || order.currency || 'ZAR')} ${htmlEscape(centsFromMetadata(item.itemPriceCents))}</small></li>`).join('')}</ul>`
      : '<p class="muted-copy">Every WhatsApp retailer ID matched a local product.</p>';
    return `<section class="order-diagnostics ${statusClass}"><header><h4>WhatsApp catalog diagnostics</h4><span>${htmlEscape(statusText)}</span></header><div><p><strong>Catalog</strong> ${htmlEscape(metadata.catalogId || 'Not supplied')}</p><p><strong>Message</strong> ${htmlEscape(metadata.messageId || order.paymentReference || 'Not supplied')}</p>${metadata.text ? `<p><strong>Buyer note</strong> ${htmlEscape(metadata.text)}</p>` : ''}</div>${unmatched}</section>`;
  }

  function centsFromMetadata(value) {
    return (Number(value || 0) / 100).toFixed(2);
  }

  function bindOrderDetailActions(order) {
    orderDetail.querySelectorAll('[data-order-item-link]').forEach((button) => {
      button.addEventListener('click', () => openOrderItemProductPicker({
        orderId: order.id,
        itemId: button.dataset.orderItemLink,
        retailerId: button.dataset.orderItemRetailer
      }));
    });
  }

  async function openOrderItemProductPicker({ orderId, itemId, retailerId }) {
    const products = await ensureCommerceProducts();
    const existing = orderDetail.querySelector('.order-product-picker');
    if (existing) existing.remove();
    const panel = document.createElement('section');
    panel.className = 'order-product-picker';
    panel.innerHTML = `
      <header>
        <div><h4>Link catalog item</h4><p>Choose the local product for retailer ID ${htmlEscape(retailerId || 'unknown')}.</p></div>
        <button class="link-button" data-product-picker-close type="button">Close</button>
      </header>
      <div class="commerce-row-actions"><button class="button" data-product-picker-create type="button">Create draft product</button></div>
      <input type="search" placeholder="Search products by name, SKU, or retailer ID" data-product-picker-search>
      <div class="order-product-picker-list">${renderOrderProductPickerList(products, { orderId, itemId, retailerId })}</div>
    `;
    const anchor = orderDetail.querySelector('.order-diagnostics') || orderDetail.querySelector('article');
    anchor.insertAdjacentElement(anchor.classList.contains('order-diagnostics') ? 'afterend' : 'beforeend', panel);
    bindOrderProductPicker(panel, products, { orderId, itemId, retailerId });
  }

  async function ensureCommerceProducts() {
    if (currentProducts.length) return currentProducts;
    const response = await fetch('/api/commerce/products');
    const result = await response.json().catch(() => ({ products: [] }));
    if (response.ok) currentProducts = result.products || [];
    return currentProducts;
  }

  function renderOrderProductPickerList(products, context) {
    const active = products.filter((product) => product.status !== 'archived');
    if (!active.length) return '<p class="muted-copy">Add products before linking WhatsApp catalog items.</p>';
    return active.map((product) => `
      <button type="button" data-product-picker-choice="${htmlEscape(product.id)}" data-search-text="${htmlEscape(`${product.name || ''} ${product.sku || ''} ${product.metaProductRetailerId || ''}`.toLowerCase())}">
        <span><strong>${htmlEscape(product.name)}</strong><small>${htmlEscape(product.sku || 'No SKU')} · Retailer ${htmlEscape(product.metaProductRetailerId || product.sku || 'not set')}</small></span>
        <em>R ${htmlEscape(product.price || '0.00')}</em>
      </button>
    `).join('');
  }

  function bindOrderProductPicker(panel, products, context) {
    panel.querySelector('[data-product-picker-close]')?.addEventListener('click', () => panel.remove());
    panel.querySelector('[data-product-picker-create]')?.addEventListener('click', () => createProductFromOrderItem(context));
    panel.querySelector('[data-product-picker-search]')?.addEventListener('input', (event) => {
      const term = event.target.value.trim().toLowerCase();
      panel.querySelectorAll('[data-product-picker-choice]').forEach((button) => {
        button.hidden = term && !button.dataset.searchText.includes(term);
      });
    });
    panel.querySelectorAll('[data-product-picker-choice]').forEach((button) => {
      button.addEventListener('click', () => linkOrderItemToProduct({ ...context, productId: button.dataset.productPickerChoice }));
    });
  }

  async function linkOrderItemToProduct({ orderId, itemId, retailerId, productId }) {
    const response = await fetch(`/api/commerce/orders/${encodeURIComponent(orderId)}/items/link-product`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId || null, retailerId, productId })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Catalog item linked' : result.error || 'Catalog item could not be linked');
    if (response.ok) {
      orderDetail.innerHTML = renderOrderDetail(result);
      bindOrderDetailActions(result);
      loadCommerce();
    }
  }

  async function createProductFromOrderItem({ orderId, itemId, retailerId }) {
    const response = await fetch(`/api/commerce/orders/${encodeURIComponent(orderId)}/items/create-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId || null, retailerId })
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Draft product created and linked' : result.error || 'Draft product could not be created');
    if (response.ok) {
      orderDetail.innerHTML = renderOrderDetail(result.order || result);
      bindOrderDetailActions(result.order || result);
      loadCommerce();
    }
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
    if (commit) {
      closeAppModal();
      loadCommerce();
    }
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
      closeAppModal();
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
    if (response.ok) closeAppModal();
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
    if (response.ok) {
      variantForm.reset();
      closeAppModal();
    }
  });

  previewCatalogSyncBtn?.addEventListener('click', loadCatalogSyncPreview);
  syncCommerceAutomationTemplatesBtn?.addEventListener('click', (event) => {
    syncAutomationTemplates({ button: event.currentTarget });
  });

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
      closeAppModal();
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
      closeAppModal();
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
    const totals = campaigns.reduce((acc, campaign) => {
      acc.sent += Number(campaign.sent || 0); acc.delivered += Number(campaign.delivered || 0); acc.read += Number(campaign.read || 0); acc.replies += Number(campaign.replies || 0);
      return acc;
    }, { sent: 0, delivered: 0, read: 0, replies: 0 });
    const deliveryRate = totals.sent ? Math.round((totals.delivered / totals.sent) * 100) : 0;
    const readRate = totals.delivered ? Math.round((totals.read / totals.delivered) * 100) : 0;
    const replyRate = totals.read ? Math.round((totals.replies / totals.read) * 100) : 0;
    const maxSent = Math.max(...campaigns.map((campaign) => Number(campaign.sent || 0)), 1);
    const rows = campaigns.slice(0, 6).map((campaign) => {
      const sent = Number(campaign.sent || 0); const delivered = Number(campaign.delivered || 0); const read = Number(campaign.read || 0); const replies = Number(campaign.replies || 0);
      return `<div class="insight-series" title="${htmlEscape(campaign.name)}"><div><strong>${htmlEscape(String(campaign.name || 'Campaign').slice(0, 18))}</strong><small>${sent.toLocaleString()} sent</small></div><span class="insight-series-track"><i style="width:${Math.max(3, Math.round((sent / maxSent) * 100))}%"></i><b style="width:${Math.max(0, Math.round((delivered / Math.max(sent, 1)) * 100))}%"></b><em style="width:${Math.max(0, Math.round((read / Math.max(sent, 1)) * 100))}%"></em></span><small>${replies} replies</small></div>`;
    }).join('');
    insightChart.innerHTML = `<div class="insight-donut" style="--delivery:${deliveryRate}%;--read:${Math.min(deliveryRate, Math.round((totals.read / Math.max(totals.sent, 1)) * 100))}%;"><strong>${deliveryRate}%</strong><small>delivery</small></div><div class="insight-funnel"><div class="insight-rate-row"><span>Delivered</span><strong>${deliveryRate}%</strong></div><div class="insight-rate-row"><span>Read</span><strong>${readRate}%</strong></div><div class="insight-rate-row"><span>Replied</span><strong>${replyRate}%</strong></div><div class="insight-series-list">${rows}</div><div class="insight-legend"><span><i></i> Sent</span><span><i></i> Delivered</span><span><i></i> Read</span></div></div>`;
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

async function executeRecaptcha(action) {
  const siteKey = document.querySelector('meta[name="recaptcha-site-key"]')?.content;
  if (!siteKey) return null;
  if (!window.grecaptcha?.execute) throw new Error('Security verification is still loading. Please try again.');
  await new Promise((resolve) => window.grecaptcha.ready(resolve));
  const token = await window.grecaptcha.execute(siteKey, { action });
  if (!token) throw new Error('Security verification could not complete. Please try again.');
  return token;
}

async function protectedFormPayload(form, action = form.dataset.recaptchaAction) {
  const payload = Object.fromEntries(new FormData(form).entries());
  const recaptchaToken = await executeRecaptcha(action);
  if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
  return payload;
}

const publicLeadForm = document.getElementById('publicLeadForm');
if (publicLeadForm) {
  const statusEl = document.getElementById('publicLeadStatus');
  const submitButton = publicLeadForm.querySelector('button[type="submit"]');
  publicLeadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    statusEl.textContent = 'Sending your enquiry...';
    try {
      const payload = await protectedFormPayload(publicLeadForm);
      const params = new URLSearchParams(window.location.search);
      payload.sourcePath = `${window.location.pathname}${window.location.search}`.slice(0, 300);
      payload.referrer = document.referrer;
      ['source', 'medium', 'campaign', 'content', 'term'].forEach((key) => {
        const value = params.get(`utm_${key}`);
        if (value) payload[`utm${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
      });
      const response = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your enquiry could not be sent.');
      publicLeadForm.reset();
      statusEl.innerHTML = `Enquiry received. Your reference is <strong>${htmlEscape(result.reference || '')}</strong>.`;
      submitButton.textContent = 'Enquiry sent';
      window.chatClanAnalytics?.track('public_lead_submitted', { type: payload.leadType, source: window.location.pathname });
    } catch (error) {
      statusEl.textContent = error.message || 'Your enquiry could not be sent.';
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
}

const publicConsentBanner = document.getElementById('publicConsentBanner');
if (publicConsentBanner) {
  const consentKey = 'chatclan_public_consent_v1';
  let consent = '';
  try { consent = window.localStorage.getItem(consentKey) || ''; } catch { consent = ''; }
  publicConsentBanner.hidden = Boolean(consent);
  window.chatClanAnalytics = {
    track(eventName, properties = {}) {
      let choice = '';
      try { choice = window.localStorage.getItem(consentKey) || ''; } catch { choice = ''; }
      if (choice !== 'analytics') return false;
      window.dispatchEvent(new CustomEvent('chatclan:analytics', { detail: { event: eventName, properties, occurredAt: new Date().toISOString() } }));
      return true;
    }
  };
  publicConsentBanner.querySelectorAll('[data-consent-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.consentChoice === 'analytics' ? 'analytics' : 'essential';
      try { window.localStorage.setItem(consentKey, choice); } catch { /* Preferences remain session-only when storage is unavailable. */ }
      publicConsentBanner.hidden = true;
      window.dispatchEvent(new CustomEvent('chatclan:consent', { detail: { analytics: choice === 'analytics' } }));
    });
  });
  document.querySelectorAll('[data-analytics-event]').forEach((element) => {
    element.addEventListener('click', () => window.chatClanAnalytics.track(element.dataset.analyticsEvent, { path: window.location.pathname }));
  });
}

const platformLeadDrawer = document.getElementById('platformLeadDrawer');
const platformLeadUpdateForm = document.getElementById('platformLeadUpdateForm');
const platformLeadNoteForm = document.getElementById('platformLeadNoteForm');
const platformLeadCrmRetry = document.getElementById('platformLeadCrmRetry');

function setPlatformLeadDrawer(open) {
  platformLeadDrawer?.classList.toggle('open', open);
  platformLeadDrawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function localDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function renderPlatformLeadRowsClient(leads) {
  if (!leads.length) return '<tr><td colspan="6"><p class="muted-copy">No public enquiries yet.</p></td></tr>';
  return leads.map((lead) => `<tr data-platform-lead-row="${htmlEscape(lead.id)}">
    <td><strong>${htmlEscape(lead.name)}</strong><small>${htmlEscape(lead.company)} · ${htmlEscape(lead.email)}</small></td>
    <td><span class="status ${lead.priority === 'high' ? 'warn' : ''}">${htmlEscape(lead.leadType)}</span><small>${htmlEscape(lead.useCase || 'General')} · ${htmlEscape(lead.teamSize || 'Team not supplied')}</small></td>
    <td>${htmlEscape(lead.routeKey)}<small>${htmlEscape(lead.reference)}</small></td>
    <td><span class="status ${['breached','at_risk'].includes(lead.slaStatus) ? 'warn' : ''}">${htmlEscape(lead.slaStatus.replaceAll('_', ' '))}</span><small>${lead.followUpStatus === 'overdue' ? 'Follow-up overdue' : htmlEscape(lead.followUpStatus)}</small></td>
    <td><span class="status" data-lead-status>${htmlEscape(lead.status)}</span><small>${htmlEscape(lead.ownerName || 'Unassigned')}</small></td>
    <td><button class="button ghost platform-lead-manage" type="button" data-lead-id="${htmlEscape(lead.id)}">Manage</button></td>
  </tr>`).join('');
}

function bindPlatformLeadManageButtons() {
  document.querySelectorAll('.platform-lead-manage').forEach((button) => button.addEventListener('click', () => openPlatformLead(button.dataset.leadId)));
}

async function refreshPlatformLeadQueue() {
  const response = await fetch('/api/platform/leads?limit=250');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'Lead queue could not be refreshed');
  const rows = document.getElementById('platformLeadRows');
  if (rows) {
    rows.innerHTML = renderPlatformLeadRowsClient(result.leads || []);
    bindPlatformLeadManageButtons();
  }
  const summary = result.summary || {};
  document.querySelectorAll('[data-lead-summary]').forEach((element) => {
    const key = element.dataset.leadSummary;
    const value = summary[key];
    element.textContent = key === 'conversionRate' ? `${value || 0}%` : key === 'averageResponseMinutes' ? (value === null || value === undefined ? '-' : `${value}m`) : value || 0;
  });
  const badge = document.getElementById('platformLeadNewBadge');
  if (badge) badge.textContent = `${summary.new || 0} new`;
}

async function openPlatformLead(leadId) {
  const response = await fetch(`/api/platform/leads/${encodeURIComponent(leadId)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'Lead details could not be loaded');
  const { lead, events = [], crm = {} } = result;
  platformLeadUpdateForm.reset();
  platformLeadUpdateForm.elements.leadId.value = lead.id;
  platformLeadUpdateForm.elements.status.value = lead.status;
  platformLeadUpdateForm.elements.ownerPlatformUserId.value = lead.ownerPlatformUserId || '';
  platformLeadUpdateForm.elements.nextFollowUpAt.value = localDateTimeInput(lead.nextFollowUpAt);
  platformLeadUpdateForm.elements.disqualificationReason.value = lead.disqualificationReason || '';
  platformLeadNoteForm.reset();
  platformLeadNoteForm.elements.leadId.value = lead.id;
  platformLeadCrmRetry.dataset.leadId = lead.id;
  platformLeadCrmRetry.disabled = !crm.configured;
  document.getElementById('platformLeadDrawerReference').textContent = lead.reference;
  document.getElementById('platformLeadDrawerTitle').textContent = `${lead.name} · ${lead.company}`;
  document.getElementById('platformLeadDrawerMeta').textContent = `${lead.leadType} · ${lead.priority} priority · ${lead.routeKey}`;
  document.getElementById('platformLeadDrawerSla').textContent = lead.slaStatus.replaceAll('_', ' ');
  document.getElementById('platformLeadDrawerDue').textContent = lead.responseDueAt ? formatDateTime(lead.responseDueAt) : 'not set';
  document.getElementById('platformLeadDrawerCrm').textContent = crm.configured ? `${crm.destination} · ${lead.crmDeliveryStatus.replaceAll('_', ' ')}` : `${crm.provider || 'CRM'} · not configured`;
  document.getElementById('platformLeadContactCard').innerHTML = `<h3>Enquiry</h3><p>${htmlEscape(lead.message)}</p><dl><dt>Email</dt><dd>${htmlEscape(lead.email)}</dd><dt>Phone</dt><dd>${htmlEscape(lead.phone || 'Not supplied')}</dd><dt>Preference</dt><dd>${htmlEscape(lead.preferredContact)}</dd><dt>Use case</dt><dd>${htmlEscape(lead.useCase || 'General')}</dd><dt>Consent</dt><dd>Response allowed · marketing ${lead.marketingOptIn ? 'allowed' : 'not allowed'}</dd></dl>`;
  document.getElementById('platformLeadTimeline').innerHTML = events.length
    ? events.map((event) => `<article><span></span><div><strong>${htmlEscape(event.eventType.replaceAll('_', ' '))}</strong><p>${htmlEscape(event.note)}</p><small>${htmlEscape(event.platformUserName || event.platformUserEmail || 'ChatClan system')} · ${htmlEscape(formatDateTime(event.createdAt))}</small></div></article>`).join('')
    : '<p class="muted-copy">No activity recorded yet.</p>';
  setPlatformLeadDrawer(true);
}

bindPlatformLeadManageButtons();
document.querySelector('[data-close-lead-drawer]')?.addEventListener('click', () => setPlatformLeadDrawer(false));
platformLeadDrawer?.addEventListener('click', (event) => { if (event.target === platformLeadDrawer) setPlatformLeadDrawer(false); });

platformLeadUpdateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const leadId = form.elements.leadId.value;
  const response = await fetch(`/api/platform/leads/${encodeURIComponent(leadId)}`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ status:form.elements.status.value, ownerPlatformUserId:form.elements.ownerPlatformUserId.value, nextFollowUpAt:form.elements.nextFollowUpAt.value || null, disqualificationReason:form.elements.disqualificationReason.value })
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Lead updated' : result.error || 'Lead could not be updated');
  if (response.ok) {
    await Promise.all([openPlatformLead(leadId), refreshPlatformLeadQueue()]);
  }
});

platformLeadNoteForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const leadId = form.elements.leadId.value;
  const response = await fetch(`/api/platform/leads/${encodeURIComponent(leadId)}/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ note:form.elements.note.value }) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Activity added' : result.error || 'Activity could not be added');
  if (response.ok) await openPlatformLead(leadId);
});

platformLeadCrmRetry?.addEventListener('click', async () => {
  const leadId = platformLeadCrmRetry.dataset.leadId;
  platformLeadCrmRetry.disabled = true;
  const response = await fetch(`/api/platform/leads/${encodeURIComponent(leadId)}/crm-deliver`, { method:'POST' });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'CRM delivery queued' : result.error || result.reason || 'CRM delivery could not be queued');
  await openPlatformLead(leadId);
});

const crmConfigurationDrawer = document.getElementById('crmConfigurationDrawer');
const crmConfigurationForm = document.getElementById('crmConfigurationForm');
const crmProviderSelect = crmConfigurationForm?.elements.providerKey;
const crmHealthStatus = document.getElementById('crmHealthStatus');
const testCrmConnection = document.getElementById('testCrmConnection');

function setCrmConfigurationDrawer(open) {
  crmConfigurationDrawer?.classList.toggle('open', open);
  crmConfigurationDrawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showCrmProviderFields() {
  document.querySelectorAll('[data-crm-provider]').forEach((section) => { section.hidden = section.dataset.crmProvider !== crmProviderSelect?.value; });
  if (testCrmConnection) testCrmConnection.disabled = crmProviderSelect?.value !== 'hubspot';
}

document.getElementById('openCrmConfiguration')?.addEventListener('click', async () => {
  const response = await fetch('/api/platform/crm/configuration');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'CRM configuration could not load');
  const config = result.configuration;
  crmConfigurationForm.reset();
  crmConfigurationForm.elements.enabled.checked = config.enabled;
  crmConfigurationForm.elements.providerKey.value = config.providerKey;
  crmConfigurationForm.elements.hubspotDeliveryMode.value = config.hubspotDeliveryMode || 'contacts_only';
  crmConfigurationForm.elements.webhookUrl.value = config.webhookUrl || '';
  crmConfigurationForm.elements.timeoutMs.value = config.timeoutMs || 10000;
  document.getElementById('crmTokenStatus').textContent = config.accessTokenMasked ? `Saved key ${config.accessTokenMasked}` : 'No key saved';
  crmHealthStatus.textContent = config.lastCheckedAt ? `${config.lastHealthStatus} · ${config.lastHealthMessage || ''} · ${formatDateTime(config.lastCheckedAt)}` : 'Save and enable HubSpot before testing.';
  showCrmProviderFields();
  setCrmConfigurationDrawer(true);
});

crmProviderSelect?.addEventListener('change', showCrmProviderFields);
document.querySelector('[data-close-crm-drawer]')?.addEventListener('click', () => setCrmConfigurationDrawer(false));
crmConfigurationDrawer?.addEventListener('click', (event) => { if (event.target === crmConfigurationDrawer) setCrmConfigurationDrawer(false); });

crmConfigurationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(crmConfigurationForm).entries());
  payload.enabled = crmConfigurationForm.elements.enabled.checked;
  const response = await fetch('/api/platform/crm/configuration', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'CRM configuration saved' : result.error || 'CRM configuration could not be saved');
  if (response.ok) {
    document.getElementById('crmTokenStatus').textContent = result.configuration.accessTokenMasked ? `Saved key ${result.configuration.accessTokenMasked}` : 'No key saved';
    crmHealthStatus.textContent = 'Configuration changed. Run a connection test.';
  }
});

testCrmConnection?.addEventListener('click', async () => {
  testCrmConnection.disabled = true;
  crmHealthStatus.textContent = 'Contacting HubSpot...';
  const response = await fetch('/api/platform/crm/configuration/test', { method:'POST' });
  const result = await response.json().catch(() => ({}));
  crmHealthStatus.textContent = result.health ? `${result.health.status} · ${result.health.message} · ${result.health.latencyMs} ms` : result.error || 'Connection test failed';
  showToast(response.ok ? 'HubSpot connection verified' : 'HubSpot connection failed');
  testCrmConnection.disabled = false;
});

document.querySelectorAll('[data-social-start]').forEach((button) => {
  button.addEventListener('click', async () => {
    const originalTitle = button.title;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const purpose = button.dataset.purpose === 'signin' ? 'signin' : 'signup';
      const recaptchaToken = await executeRecaptcha(purpose === 'signin' ? 'social_signin' : 'social_signup');
      const response = await fetch(`/api/auth/social/${encodeURIComponent(button.dataset.provider)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, plan: button.dataset.plan, recaptchaToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || 'Social sign in could not start.');
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      showToast(error.message || 'Social sign in could not start.');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.title = originalTitle;
    }
  });
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = await protectedFormPayload(loginForm);
    } catch (error) {
      showToast(error.message);
      return;
    }
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

const platformLoginForm = document.getElementById('platformLoginForm');
if (platformLoginForm) {
  const statusEl = document.getElementById('platformLoginStatus');
  platformLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = await protectedFormPayload(platformLoginForm);
    } catch (error) {
      statusEl.textContent = error.message;
      showToast(error.message);
      return;
    }
    statusEl.textContent = 'Signing in...';
    const response = await fetch('/api/platform/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      statusEl.textContent = result.error || 'Platform sign in failed';
      showToast(result.error || 'Platform sign in failed');
      return;
    }
    statusEl.textContent = `Signed in as ${result.user?.email || 'platform user'}.`;
    showToast('Platform signed in');
    window.setTimeout(() => {
      window.location.href = '/platform';
    }, 450);
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  const statusEl = document.getElementById('signupStatus');
  const planSelect = signupForm.querySelector('select[name="planCode"]');
  const planOptions = [...signupForm.querySelectorAll('.signup-plan-option[data-plan-code]')];

  function syncSignupPlan() {
    if (!planSelect) return;
    planOptions.forEach((option) => {
      const selected = option.dataset.planCode === planSelect.value;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    signupForm.querySelectorAll('.social-auth-button[data-plan]').forEach((button) => {
      button.dataset.plan = planSelect.value;
    });
  }

  planSelect?.addEventListener('change', syncSignupPlan);
  planOptions.forEach((option) => {
    option.addEventListener('click', () => {
      if (!planSelect || !option.dataset.planCode) return;
      planSelect.value = option.dataset.planCode;
      planSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  syncSignupPlan();

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = await protectedFormPayload(signupForm);
    } catch (error) {
      statusEl.textContent = error.message;
      showToast(error.message);
      return;
    }
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
    let payload;
    try {
      payload = await protectedFormPayload(socialSignupCompletionForm);
    } catch (error) {
      statusEl.textContent = error.message;
      showToast(error.message);
      return;
    }
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

const platformLogoutBtn = document.getElementById('platformLogoutBtn');
if (platformLogoutBtn) {
  platformLogoutBtn.addEventListener('click', async () => {
    await fetch('/api/platform/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/platform/login';
  });
}

document.querySelectorAll('.platform-tenant-action').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const tenantId = form.dataset.tenantId || formData.get('tenantId');
    const payload = Object.fromEntries(formData.entries());
    delete payload.tenantId;
    if (!tenantId) return showToast('Select a tenant first');
    const response = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Tenant status updated' : result.error || 'Tenant status could not be updated');
    if (response.ok) window.setTimeout(() => window.location.reload(), 450);
  });
});

document.querySelectorAll('.platform-tenant-note').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const tenantId = form.dataset.tenantId || formData.get('tenantId');
    const payload = Object.fromEntries(formData.entries());
    delete payload.tenantId;
    if (!tenantId) return showToast('Select a tenant first');
    const response = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Tenant note saved' : result.error || 'Tenant note could not be saved');
    if (response.ok) form.querySelector('[name="note"]').value = '';
  });
});

const platformTenantDrawer = document.getElementById('platformTenantDrawer');
const platformTenantStatusForm = document.getElementById('platformTenantStatusForm');
const platformTenantNoteForm = document.getElementById('platformTenantNoteForm');
if (platformTenantDrawer && platformTenantStatusForm && platformTenantNoteForm) {
  function setDrawerOpen(open) {
    platformTenantDrawer.classList.toggle('open', open);
    platformTenantDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  document.querySelectorAll('.platform-tenant-manage').forEach((button) => {
    button.addEventListener('click', () => {
      const tenant = JSON.parse(button.dataset.tenant || '{}');
      platformTenantStatusForm.tenantId.value = tenant.id || '';
      platformTenantStatusForm.status.value = tenant.platformStatus || 'active';
      platformTenantStatusForm.reason.value = tenant.platformReason || tenant.health || '';
      platformTenantNoteForm.tenantId.value = tenant.id || '';
      const aiPolicyButton = document.getElementById('platformTenantAiPolicyButton');
      if (aiPolicyButton) {
        aiPolicyButton.dataset.businessId = tenant.id || '';
        aiPolicyButton.dataset.businessName = tenant.name || 'Tenant';
      }
      platformTenantNoteForm.note.value = '';
      document.getElementById('platformTenantDrawerTitle').textContent = tenant.name || 'Tenant details';
      document.getElementById('platformTenantDrawerMeta').textContent = `${tenant.owner || 'Owner unavailable'} · ${tenant.plan || 'Plan unavailable'}`;
      document.getElementById('platformTenantBilling').textContent = `${tenant.billingStatus || '-'} · ${tenant.billingAmount || '-'}`;
      document.getElementById('platformTenantMeta').textContent = tenant.metaStatus || '-';
      document.getElementById('platformTenantHealth').textContent = tenant.health || '-';
      setDrawerOpen(true);
    });
  });

  document.querySelectorAll('[data-close-platform-drawer]').forEach((button) => {
    button.addEventListener('click', () => setDrawerOpen(false));
  });
  platformTenantDrawer.addEventListener('click', (event) => {
    if (event.target === platformTenantDrawer) setDrawerOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setDrawerOpen(false);
  });
}

document.querySelectorAll('.guardrail-card').forEach((form) => {
  const checkbox = form.querySelector('input[name="enabled"]');
  const label = form.querySelector('.toggle-row span');
  checkbox?.addEventListener('change', () => {
    if (label) label.textContent = checkbox.checked ? 'Paused' : 'Available';
    form.classList.toggle('active', checkbox.checked);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = form.dataset.guardrailKey;
    const formData = new FormData(form);
    const payload = {
      enabled: checkbox?.checked || false,
      reason: formData.get('reason') || ''
    };
    const response = await fetch(`/api/platform/guardrails/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    showToast(response.ok ? 'Guardrail updated' : result.error || 'Guardrail could not be updated');
    if (response.ok) window.setTimeout(() => window.location.reload(), 450);
  });
});

const incidentCreateDrawer = document.getElementById('platformIncidentCreateDrawer');
const incidentDetailDrawer = document.getElementById('platformIncidentDetailDrawer');
const incidentCreateForm = document.getElementById('platformIncidentCreateForm');
const incidentUpdateForm = document.getElementById('platformIncidentUpdateForm');
const incidentEventForm = document.getElementById('platformIncidentEventForm');

function setIncidentDrawer(drawer, open) {
  if (!drawer) return;
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
}

document.querySelectorAll('[data-open-incident-create]').forEach((button) => {
  button.addEventListener('click', () => setIncidentDrawer(incidentCreateDrawer, true));
});
document.querySelectorAll('[data-close-incident-drawer]').forEach((button) => {
  button.addEventListener('click', () => setIncidentDrawer(button.closest('.drawer-backdrop'), false));
});
[incidentCreateDrawer, incidentDetailDrawer].filter(Boolean).forEach((drawer) => {
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) setIncidentDrawer(drawer, false);
  });
});

incidentCreateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(incidentCreateForm).entries());
  const response = await fetch('/api/platform/incidents', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Incident opened' : result.error || 'Incident could not be opened');
  if (response.ok) window.setTimeout(() => window.location.reload(), 450);
});

async function openPlatformIncident(incidentId) {
    const response = await fetch(`/api/platform/incidents/${encodeURIComponent(incidentId)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || 'Incident could not load');
    const incident = result.incident;
    incidentUpdateForm.incidentId.value = incident.id;
    incidentUpdateForm.status.value = incident.status;
    incidentUpdateForm.severity.value = incident.severity;
    incidentUpdateForm.linkedGuardrailKey.value = incident.linkedGuardrailKey || '';
    incidentUpdateForm.providerKey.value = incident.providerKey || '';
    incidentUpdateForm.resolutionNote.value = incident.resolutionNote || '';
    incidentEventForm.incidentId.value = incident.id;
    document.getElementById('incidentDetailTitle').textContent = incident.title;
    document.getElementById('incidentDetailSeverity').textContent = `${incident.severity.toUpperCase()} · ${incident.status}`;
    document.getElementById('incidentDetailImpact').textContent = incident.customerImpact;
    const timeline = document.getElementById('incidentTimeline');
    timeline.innerHTML = incident.events.length
      ? incident.events.map((item) => `<article><span></span><div><strong>${escapeHtml(item.eventType.replaceAll('_', ' '))}</strong><p>${escapeHtml(item.note)}</p><small>${escapeHtml(item.platformUserEmail || 'system')} · ${escapeHtml(item.createdAt || '')}</small></div></article>`).join('')
      : '<p class="muted-copy">No timeline updates yet.</p>';
    setIncidentDrawer(incidentDetailDrawer, true);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.platform-incident-manage');
  if (button) openPlatformIncident(button.dataset.incidentId);
});

incidentUpdateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(incidentUpdateForm).entries());
  const incidentId = payload.incidentId;
  delete payload.incidentId;
  const response = await fetch(`/api/platform/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Incident updated' : result.error || 'Incident could not be updated');
  if (response.ok) window.setTimeout(() => window.location.reload(), 450);
});

incidentEventForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(incidentEventForm).entries());
  const incidentId = payload.incidentId;
  delete payload.incidentId;
  const response = await fetch(`/api/platform/incidents/${encodeURIComponent(incidentId)}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Timeline updated' : result.error || 'Update could not be added');
  if (response.ok) window.setTimeout(() => window.location.reload(), 450);
});

const reliabilityRefresh = document.getElementById('platformReliabilityRefresh');
const retryDrawer = document.getElementById('deadLetterRetryDrawer');
const retryForm = document.getElementById('deadLetterRetryForm');
const platformAlertPolicyDrawer = document.getElementById('platformAlertPolicyDrawer');
const platformAlertDetailDrawer = document.getElementById('platformAlertDetailDrawer');
const platformAlertPolicyForm = document.getElementById('platformAlertPolicyForm');
const platformAlertActionForm = document.getElementById('platformAlertActionForm');
const platformAlertIncidentForm = document.getElementById('platformAlertIncidentForm');

document.querySelectorAll('[data-reliability-view]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-reliability-view]').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('[data-reliability-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.reliabilityPanel === button.dataset.reliabilityView));
  });
});

document.addEventListener('click', (event) => {
  const providerButton = event.target.closest('.provider-incident-declare');
  if (providerButton && incidentCreateForm) {
    incidentCreateForm.reset();
    incidentCreateForm.providerKey.value = providerButton.dataset.provider || '';
    incidentCreateForm.severity.value = 'sev2';
    incidentCreateForm.title.value = `${providerButton.dataset.providerLabel} connector degradation`;
    incidentCreateForm.summary.value = `${providerButton.dataset.failedRuns || 0} failed sync runs were correlated across ${providerButton.dataset.affectedTenants || 0} tenants in the last 24 hours.`;
    incidentCreateForm.customerImpact.value = `${providerButton.dataset.affectedTenants || 0} tenant workspaces may have stale or unavailable knowledge data.`;
    setIncidentDrawer(incidentCreateDrawer, true);
  }

  const retryButton = event.target.closest('.dead-letter-retry');
  if (retryButton && retryForm && retryDrawer) {
    retryForm.reset();
    retryForm.jobId.value = retryButton.dataset.jobId;
    document.getElementById('deadLetterRetryTitle').textContent = `Resolve job #${retryButton.dataset.jobId}`;
    document.getElementById('deadLetterRetryMeta').textContent = `${retryButton.dataset.jobType}. Retry valid work or discard an invalid payload while preserving the failure evidence.`;
    document.getElementById('deadLetterPayload').textContent = JSON.stringify(JSON.parse(retryButton.dataset.jobPayload || '{}'), null, 2);
    setIncidentDrawer(retryDrawer, true);
  }

  const alertButton = event.target.closest('.platform-alert-manage');
  if (alertButton && platformAlertDetailDrawer) {
    const alert = JSON.parse(alertButton.dataset.alert || '{}');
    platformAlertActionForm.alertId.value = alert.id || '';
    platformAlertActionForm.ownerPlatformUserId.value = alert.ownerPlatformUserId || platformAlertActionForm.ownerPlatformUserId.value;
    platformAlertIncidentForm.alertId.value = alert.id || '';
    platformAlertIncidentForm.incidentId.value = alert.incidentId || '';
    document.getElementById('platformAlertDetailTitle').textContent = alert.title || 'Alert details';
    document.getElementById('platformAlertDetailSeverity').textContent = `${String(alert.severity||'warning').toUpperCase()} · ${String(alert.signalType||'signal').replaceAll('_',' ')}`;
    document.getElementById('platformAlertDetailText').textContent = alert.detail || '';
    document.getElementById('platformAlertDetailStatus').textContent = alert.status || '-';
    document.getElementById('platformAlertDetailOwner').textContent = alert.ownerEmail || alert.ownerName || 'Unassigned';
    document.getElementById('platformAlertDetailNotifications').textContent = alert.notificationCount || 0;
    document.getElementById('platformAlertTimeline').innerHTML = (alert.events||[]).length ? alert.events.map((item)=>`<article><span></span><div><strong>${htmlEscape(String(item.eventType||'event').replaceAll('_',' '))}</strong><p>${htmlEscape(item.detail||'')}</p><small>${htmlEscape(item.recipient||'platform')} · ${htmlEscape(item.createdAt||'')}</small></div></article>`).join('') : '<p class="muted-copy">No alert events yet.</p>';
    setIncidentDrawer(platformAlertDetailDrawer,true);
  }
});

document.querySelectorAll('[data-close-retry-drawer]').forEach((button) => button.addEventListener('click', () => setIncidentDrawer(retryDrawer, false)));
retryDrawer?.addEventListener('click', (event) => { if (event.target === retryDrawer) setIncidentDrawer(retryDrawer, false); });
document.getElementById('platformAlertPolicyButton')?.addEventListener('click',()=>{
  if (platformAlertPolicyForm) platformAlertPolicyForm.minimumEmailSeverity.value = platformAlertPolicyForm.dataset.minimumSeverity || platformAlertPolicyForm.minimumEmailSeverity.value || 'warning';
  setIncidentDrawer(platformAlertPolicyDrawer,true);
});
document.querySelectorAll('[data-close-platform-alert-drawer]').forEach((button)=>button.addEventListener('click',()=>setIncidentDrawer(button.closest('.drawer-backdrop'),false)));
[platformAlertPolicyDrawer,platformAlertDetailDrawer].filter(Boolean).forEach((drawer)=>drawer.addEventListener('click',(event)=>{if(event.target===drawer)setIncidentDrawer(drawer,false);}));

document.getElementById('evaluatePlatformAlerts')?.addEventListener('click',async()=>{
  const response=await fetch('/api/platform/reliability/evaluate',{method:'POST'});const result=await response.json().catch(()=>({}));
  showToast(response.ok?`Evaluated ${result.signals||0} reliability signals`:result.error||'Alert evaluation failed');
  if(response.ok)await refreshPlatformReliability();
});

platformAlertPolicyForm?.addEventListener('submit',async(event)=>{
  event.preventDefault();const payload=Object.fromEntries(new FormData(platformAlertPolicyForm).entries());
  payload.emailEnabled=platformAlertPolicyForm.emailEnabled.checked;payload.inAppEnabled=platformAlertPolicyForm.inAppEnabled.checked;
  const response=await fetch('/api/platform/reliability/alert-policy',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));
  showToast(response.ok?'Alert settings saved':result.error||'Alert settings could not be saved');if(response.ok){setIncidentDrawer(platformAlertPolicyDrawer,false);await refreshPlatformReliability();}
});

platformAlertActionForm?.addEventListener('submit',async(event)=>{
  event.preventDefault();const submitter=event.submitter;const payload=Object.fromEntries(new FormData(platformAlertActionForm).entries());const alertId=payload.alertId;delete payload.alertId;
  const assigning=submitter?.value==='assign';const response=await fetch(`/api/platform/reliability/alerts/${encodeURIComponent(alertId)}/${assigning?'assignment':'acknowledge'}`,{method:assigning?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));
  showToast(response.ok?(assigning?'Alert assignment updated':'Alert acknowledged'):result.error||'Alert action failed');if(response.ok){setIncidentDrawer(platformAlertDetailDrawer,false);await refreshPlatformReliability();}
});

platformAlertIncidentForm?.addEventListener('submit',async(event)=>{
  event.preventDefault();const payload=Object.fromEntries(new FormData(platformAlertIncidentForm).entries());const alertId=payload.alertId;delete payload.alertId;
  if(!payload.incidentId)return showToast('Select an active incident');
  const response=await fetch(`/api/platform/reliability/alerts/${encodeURIComponent(alertId)}/incident`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));
  showToast(response.ok?'Alert linked to incident':result.error||'Incident link failed');if(response.ok){setIncidentDrawer(platformAlertDetailDrawer,false);await refreshPlatformReliability();}
});

retryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(retryForm).entries());
  const jobId = payload.jobId;
  delete payload.jobId;
  delete payload.action;
  const action = event.submitter?.value === 'discard' ? 'discard' : 'retry';
  const response = await fetch(`/api/platform/reliability/jobs/${encodeURIComponent(jobId)}/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || `Job could not be ${action === 'discard' ? 'discarded' : 'retried'}`);
  setIncidentDrawer(retryDrawer, false);
  showToast(action === 'discard' ? `Job #${jobId} discarded with audit evidence` : `Linked retry #${result.recovery.recoveryJobId} queued`);
  await refreshPlatformReliability();
});

reliabilityRefresh?.addEventListener('click', refreshPlatformReliability);

async function refreshPlatformReliability() {
  if (!reliabilityRefresh) return;
  reliabilityRefresh.disabled = true;
  reliabilityRefresh.textContent = 'Refreshing...';
  try {
    const response = await fetch('/api/platform/reliability');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(data.error || 'Reliability data could not load');
    renderPlatformReliability(data);
    showToast('Reliability refreshed');
  } finally {
    reliabilityRefresh.disabled = false;
    reliabilityRefresh.textContent = 'Refresh';
  }
}

function renderPlatformReliability(data) {
  const summary = data.summary || {};
  document.getElementById('reliabilitySummary').innerHTML = [
    ['Workers healthy', `${summary.healthyWorkers || 0}/${summary.workers || 0}`],
    ['Queue exceptions', Number(summary.stuckJobs || 0) + Number(summary.deadLetters || 0)],
    ['Connector alerts', summary.openConnectorAlerts || 0],
    ['Incident signals', summary.correlatedProviders || 0]
  ].map(([label, value]) => `<article><small>${htmlEscape(label)}</small><strong>${htmlEscape(value)}</strong></article>`).join('');
  document.getElementById('reliabilityProviderList').innerHTML = data.providers.map(renderReliabilityProviderCardClient).join('');
  document.getElementById('reliabilityProviderRows').innerHTML = data.providers.map(renderReliabilityProviderRowClient).join('');
  document.getElementById('reliabilityWorkerRows').innerHTML = data.workers.length ? data.workers.map((worker) => `<tr><td><strong>${htmlEscape(worker.workerId)}</strong><small>${htmlEscape(worker.role)} · ${htmlEscape(worker.version)}</small></td><td><span class="status ${worker.health === 'healthy' ? '' : 'warn'}">${htmlEscape(worker.health)}</span><small>${htmlEscape(worker.status)}</small></td><td>${htmlEscape(worker.secondsSinceSeen)}s ago</td><td>${htmlEscape(worker.jobsProcessed)}</td><td>${worker.currentJobId ? `#${htmlEscape(worker.currentJobId)}` : 'Idle'}</td></tr>`).join('') : '<tr><td colspan="5"><p class="muted-copy">No worker heartbeat has been recorded. Start the background worker to establish liveness.</p></td></tr>';
  document.getElementById('reliabilityDeadLetterRows').innerHTML = data.deadLetters.length ? data.deadLetters.map((job) => `<tr><td><strong>#${htmlEscape(job.id)} · ${htmlEscape(job.type)}</strong><small>${htmlEscape(job.failedAt || job.updatedAt || '')}</small></td><td>${htmlEscape(job.attempts)}/${htmlEscape(job.maxAttempts)}</td><td><small class="reliability-error">${htmlEscape(job.lastError || 'No failure detail')}</small></td><td><button class="button ghost dead-letter-retry" type="button" data-job-id="${htmlEscape(job.id)}" data-job-type="${htmlEscape(job.type)}" data-job-payload="${htmlEscape(JSON.stringify(job.payload||{}))}">Resolve</button></td></tr>`).join('') : '<tr><td colspan="4"><p class="muted-copy">No dead-letter jobs. Automatic processing has no exhausted failures.</p></td></tr>';
  const queueActions=[...(data.recoveryEvents||[]).map((item)=>({...item,kind:'retry'})),...(data.resolutionEvents||[]).map((item)=>({...item,kind:'discard'}))].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  document.getElementById('reliabilityRecoveryEvents').innerHTML = queueActions.length ? queueActions.map((item) => `<article class="request-item"><strong>${item.kind==='retry'?`#${htmlEscape(item.originalJobId)} → #${htmlEscape(item.recoveryJobId)}`:`#${htmlEscape(item.jobId)} discarded`}</strong><span>${htmlEscape(item.reason)}</span><small>${htmlEscape(item.platformUserEmail || 'system')} · ${htmlEscape(item.createdAt || '')}</small></article>`).join('') : '<p class="muted-copy">No manual queue actions recorded.</p>';
  const alertCenter=data.alertCenter||{summary:{},alerts:[]};
  document.getElementById('platformAlertSummary').innerHTML=[['Open',alertCenter.summary.open||0],['Acknowledged',alertCenter.summary.acknowledged||0],['Critical',alertCenter.summary.critical||0],['Escalated',alertCenter.summary.escalated||0]].map(([label,value])=>`<article><small>${label}</small><strong>${htmlEscape(value)}</strong></article>`).join('');
  document.getElementById('platformAlertList').innerHTML=renderPlatformAlertListClient(alertCenter.alerts||[]);
  const alertsTab=document.getElementById('reliabilityAlertsTab');
  if(alertsTab)alertsTab.textContent=`Alerts${alertCenter.summary.open?` (${alertCenter.summary.open})`:''}`;
  const reliabilityCount=Number(summary.stuckJobs||0)+Number(summary.deadLetters||0)+Number(alertCenter.summary.open||0);
  const reliabilityNav=document.getElementById('platformReliabilityNav');
  if(reliabilityNav){const badge=reliabilityNav.querySelector('em');if(reliabilityCount){if(badge)badge.textContent=reliabilityCount;else reliabilityNav.insertAdjacentHTML('beforeend',`<em>${htmlEscape(reliabilityCount)}</em>`);}else badge?.remove();}
}

function renderPlatformAlertListClient(alerts){return alerts.length?alerts.map((alert)=>`<article class="platform-alert-row ${htmlEscape(alert.severity)}"><div><span class="status ${alert.severity==='critical'?'warn':''}">${htmlEscape(alert.severity)}</span><strong>${htmlEscape(alert.title)}</strong><p>${htmlEscape(alert.detail)}</p><small>${htmlEscape(alert.ownerEmail||alert.ownerName||'Unassigned')} · ${htmlEscape(alert.lastDetectedAt||'')}</small></div><div><span class="status">${htmlEscape(alert.status)}</span><button class="button ghost platform-alert-manage" type="button" data-alert="${htmlEscape(JSON.stringify(alert))}">Manage</button></div></article>`).join(''):'<p class="muted-copy">No reliability alerts. Worker, queue, and provider signals are within their configured thresholds.</p>';}

function renderReliabilityProviderCardClient(provider) {
  const action = provider.activeIncident ? `<small>Incident #${htmlEscape(provider.activeIncident.id)} active</small>` : provider.incidentCandidate ? providerIncidentButton(provider, 'link-button', 'Declare incident') : '<small>No correlated incident signal</small>';
  return `<article class="reliability-provider-card"><div><span class="status ${provider.health === 'healthy' ? '' : 'warn'}">${htmlEscape(provider.health)}</span><h4>${htmlEscape(provider.label)}</h4><small>${htmlEscape(provider.sources)} sources · ${htmlEscape(provider.affectedTenants)} affected tenants</small></div><strong>${provider.successRate === null ? 'No runs' : `${htmlEscape(provider.successRate)}% success`}</strong>${action}</article>`;
}

function renderReliabilityProviderRowClient(provider) {
  const action = provider.activeIncident ? `<button class="button ghost platform-incident-manage" data-incident-id="${htmlEscape(provider.activeIncident.id)}" type="button">Incident #${htmlEscape(provider.activeIncident.id)}</button>` : provider.incidentCandidate ? providerIncidentButton(provider, 'button ghost', 'Declare') : '';
  return `<tr><td><strong>${htmlEscape(provider.label)}</strong><small><span class="status ${provider.health === 'healthy' ? '' : 'warn'}">${htmlEscape(provider.health)}</span></small></td><td>${htmlEscape(provider.activeSources)}/${htmlEscape(provider.sources)}</td><td>${provider.successRate === null ? 'No runs' : `${htmlEscape(provider.successRate)}%`}<small>${htmlEscape(provider.failedRuns)} failed</small></td><td>${htmlEscape(provider.affectedTenants)}</td><td>${htmlEscape(provider.openAlerts)}<small>${htmlEscape(provider.criticalAlerts)} critical</small></td><td>${action}</td></tr>`;
}

function providerIncidentButton(provider, className, label) {
  return `<button class="${className} provider-incident-declare" type="button" data-provider="${htmlEscape(provider.key)}" data-provider-label="${htmlEscape(provider.label)}" data-affected-tenants="${htmlEscape(provider.affectedTenants)}" data-failed-runs="${htmlEscape(provider.failedRuns)}">${label}</button>`;
}

const aiProviderDrawer = document.getElementById('aiProviderDrawer');
const aiProviderForm = document.getElementById('aiProviderForm');
const tenantAiPolicyDrawer = document.getElementById('tenantAiPolicyDrawer');
const tenantAiPolicyForm = document.getElementById('tenantAiPolicyForm');
const aiProviderHealthButton = document.getElementById('aiProviderHealthButton');
const aiProviderHealthStatus = document.getElementById('aiProviderHealthStatus');

function setAiDrawer(drawer, open) {
  if (!drawer) return;
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
}

document.querySelectorAll('.ai-provider-manage').forEach((button) => {
  button.addEventListener('click', () => {
    const provider = JSON.parse(button.dataset.provider || '{}');
    aiProviderForm.providerKey.value = provider.key || '';
    aiProviderForm.enabled.checked = Boolean(provider.enabled);
    aiProviderForm.apiKey.value = '';
    aiProviderForm.baseUrl.value = provider.baseUrl || '';
    aiProviderForm.defaultModel.value = provider.defaultModel || '';
    aiProviderForm.timeoutMs.value = provider.timeoutMs || 30000;
    aiProviderHealthButton.disabled = !provider.enabled;
    aiProviderHealthStatus.textContent = provider.lastCheckedAt
      ? `${provider.lastHealthStatus || 'unknown'} · ${provider.lastHealthMessage || ''} · ${formatDateTime(provider.lastCheckedAt)}`
      : 'Save and enable the provider before testing.';
    document.getElementById('aiProviderDrawerTitle').textContent = provider.label || 'Provider configuration';
    document.getElementById('aiProviderDrawerMeta').textContent = `${provider.protocol || ''} · ${provider.apiKeyMasked || 'No key saved'}`;
    setAiDrawer(aiProviderDrawer, true);
  });
});

aiProviderHealthButton?.addEventListener('click', async () => {
  const providerKey = aiProviderForm.providerKey.value;
  if (!providerKey) return;
  const originalText = aiProviderHealthButton.textContent;
  aiProviderHealthButton.disabled = true;
  aiProviderHealthButton.textContent = 'Testing...';
  aiProviderHealthStatus.textContent = 'Contacting provider...';
  const response = await fetch(`/api/platform/ai/providers/${encodeURIComponent(providerKey)}/health`, { method:'POST' });
  const result = await response.json().catch(() => ({}));
  const health = result.health;
  aiProviderHealthStatus.textContent = response.ok
    ? `${health.status} · ${health.message} · ${Number(health.latencyMs || 0)} ms`
    : result.error || 'Provider connection check failed';
  showToast(response.ok ? 'Provider connection verified' : result.error || 'Provider connection check failed');
  aiProviderHealthButton.disabled = false;
  aiProviderHealthButton.textContent = originalText;
});

aiProviderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(aiProviderForm).entries());
  const providerKey = payload.providerKey;
  delete payload.providerKey;
  payload.enabled = aiProviderForm.enabled.checked;
  const response = await fetch(`/api/platform/ai/providers/${encodeURIComponent(providerKey)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'AI provider saved' : result.error || 'Provider could not be saved');
  if (response.ok) window.setTimeout(() => window.location.reload(), 450);
});

document.getElementById('platformTenantAiPolicyButton')?.addEventListener('click', async (event) => {
  const businessId = event.currentTarget.dataset.businessId;
  if (!businessId) return showToast('Select a tenant first');
  const response = await fetch(`/api/platform/tenants/${encodeURIComponent(businessId)}/ai-policy`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(result.error || 'AI policy could not load');
  const policy = result.policy;
  tenantAiPolicyForm.businessId.value = businessId;
  tenantAiPolicyForm.enabled.checked = policy.enabled;
  tenantAiPolicyForm.autonomyMode.value = policy.autonomyMode;
  tenantAiPolicyForm.providerChain.value = policy.providerChain.join(', ');
  tenantAiPolicyForm.monthlyBudgetCents.value = policy.monthlyBudgetCents;
  tenantAiPolicyForm.monthlyTokenLimit.value = policy.monthlyTokenLimit;
  tenantAiPolicyForm.maxResponseTokens.value = policy.maxResponseTokens;
  tenantAiPolicyForm.humanHandoffEnabled.checked = policy.humanHandoffEnabled;
  document.getElementById('tenantAiPolicyTitle').textContent = `${event.currentTarget.dataset.businessName} AI policy`;
  platformTenantDrawer?.classList.remove('open');
  platformTenantDrawer?.setAttribute('aria-hidden', 'true');
  setAiDrawer(tenantAiPolicyDrawer, true);
});

tenantAiPolicyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(tenantAiPolicyForm).entries());
  const businessId = payload.businessId;
  delete payload.businessId;
  payload.enabled = tenantAiPolicyForm.enabled.checked;
  payload.humanHandoffEnabled = tenantAiPolicyForm.humanHandoffEnabled.checked;
  const response = await fetch(`/api/platform/tenants/${encodeURIComponent(businessId)}/ai-policy`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  showToast(response.ok ? 'Tenant AI policy saved' : result.error || 'AI policy could not be saved');
  if (response.ok) window.setTimeout(() => window.location.reload(), 450);
});

document.querySelectorAll('[data-close-ai-drawer]').forEach((button) => button.addEventListener('click', () => setAiDrawer(button.closest('.drawer-backdrop'), false)));
[aiProviderDrawer, tenantAiPolicyDrawer].filter(Boolean).forEach((drawer) => drawer.addEventListener('click', (event) => { if (event.target === drawer) setAiDrawer(drawer, false); }));

const passwordResetRequestForm = document.getElementById('passwordResetRequestForm');
if (passwordResetRequestForm) {
  const statusEl = document.getElementById('passwordResetStatus');

  passwordResetRequestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = await protectedFormPayload(passwordResetRequestForm);
    } catch (error) {
      statusEl.textContent = error.message;
      showToast(error.message);
      return;
    }
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
