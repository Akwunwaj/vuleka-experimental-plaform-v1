const nodemailer = require('nodemailer');
const { brand } = require('../config/app');

let transporter;
const mockOutbox = [];

function mailMode() {
  return String(process.env.MAIL_MODE || 'mock').trim().toLowerCase();
}

function createTransporter() {
  if (mailMode() === 'smtp') {
    if (!process.env.SMTP_HOST) {
      const error = new Error('SMTP_HOST is required when MAIL_MODE=smtp');
      error.status = 500;
      throw error;
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: smtpAuth()
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
}

async function sendMail(message) {
  const mode = mailMode();
  transporter = transporter || createTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `${brand.name} <no-reply@chatclan.co.za>`,
    ...message
  });

  const delivery = {
    mode,
    messageId: info.messageId,
    envelope: info.envelope,
    accepted: info.accepted || [],
    rejected: info.rejected || []
  };

  if (mode !== 'smtp') {
    mockOutbox.push({ ...delivery, message: parseMockMessage(info.message) });
  }

  return delivery;
}

async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${appUrl()}/login?resetToken=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: `Reset your ${brand.name} password`,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `We received a request to reset your ${brand.name} password.`,
      `Open this link to continue: ${resetUrl}`,
      '',
      'This link expires in 1 hour. If you did not request it, you can ignore this email.',
      '',
      `${brand.name} Support`
    ].join('\n'),
    html: emailShell({
      title: `Reset your ${brand.name} password`,
      intro: `Hi ${escapeHtml(firstName(name))}, we received a request to reset your password.`,
      actionText: 'Reset password',
      actionUrl: resetUrl,
      footer: 'This link expires in 1 hour. If you did not request it, you can ignore this email.'
    })
  });
}

async function sendTeamInviteEmail({ to, name, role, temporaryPassword }) {
  const loginUrl = `${appUrl()}/login`;
  return sendMail({
    to,
    subject: `You have been invited to ${brand.name}`,
    text: [
      `Hi ${firstName(name)},`,
      '',
      `You have been added to a ${brand.name} workspace as ${role}.`,
      `Sign in here: ${loginUrl}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      'Please change this password after signing in.',
      '',
      `${brand.name} Support`
    ].join('\n'),
    html: emailShell({
      title: `You have been invited to ${brand.name}`,
      intro: `Hi ${escapeHtml(firstName(name))}, you have been added as <strong>${escapeHtml(role)}</strong>.`,
      actionText: 'Sign in',
      actionUrl: loginUrl,
      footer: `Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong><br>Please change this password after signing in.`
    })
  });
}

async function sendConnectorAlertEmail({ to, alert, escalated = false }) {
  const actionUrl = `${appUrl()}/dashboard#intelligence`;
  const prefix = escalated ? 'Escalated: ' : '';
  const subject = `${prefix}${brand.name} connector alert: ${alert.title}`;
  return sendMail({
    to,
    subject,
    text:[
      subject, '', alert.detail, '',
      `Severity: ${String(alert.severity || 'warning').toUpperCase()}`,
      `Status: ${alert.status || 'open'}`,
      `Open connector operations: ${actionUrl}`, '',
      'Acknowledge the alert in ChatClan after an owner has taken responsibility.'
    ].join('\n'),
    html:emailShell({
      title:subject,
      intro:`${escapeHtml(alert.detail)}<br><br><strong>Severity:</strong> ${escapeHtml(String(alert.severity || 'warning').toUpperCase())}`,
      actionText:'Open connector operations',
      actionUrl,
      footer:'Acknowledge the alert in ChatClan after an owner has taken responsibility. Recovery is recorded automatically.'
    })
  });
}

async function sendPlatformReliabilityAlertEmail({ to, alert, escalated = false }) {
  const actionUrl = `${appUrl()}/platform`;
  const prefix = escalated ? 'Escalated: ' : '';
  const subject = `${prefix}${brand.name} platform alert: ${alert.title}`;
  return sendMail({
    to,
    subject,
    text:[subject,'',alert.detail,'',`Severity: ${String(alert.severity||'warning').toUpperCase()}`,`Status: ${alert.status||'open'}`,`Open reliability center: ${actionUrl}`,'','Acknowledge the alert after taking operational ownership.'].join('\n'),
    html:emailShell({
      title:subject,
      intro:`${escapeHtml(alert.detail)}<br><br><strong>Severity:</strong> ${escapeHtml(String(alert.severity||'warning').toUpperCase())}`,
      actionText:'Open reliability center',
      actionUrl,
      footer:'Acknowledge the alert after taking operational ownership. Escalations and incident links are retained in the audit trail.'
    })
  });
}

async function sendPublicLeadEmails({ lead }) {
  const salesTo = process.env.SALES_EMAIL || brand.supportEmail;
  const actionUrl = `${appUrl()}/platform`;
  const subject = `${lead.priority === 'high' ? 'High-intent ' : ''}${brand.name} ${lead.leadType} enquiry: ${lead.company}`;
  const internal = await sendMail({
    to: salesTo,
    replyTo: lead.email,
    subject,
    text: [
      subject, '', `Reference: ${lead.reference}`, `Name: ${lead.name}`, `Company: ${lead.company}`,
      `Email: ${lead.email}`, `Phone: ${lead.phone || 'Not provided'}`, `Route: ${lead.routeKey}`,
      `Team size: ${lead.teamSize || 'Not provided'}`, `Monthly conversations: ${lead.monthlyConversations || 'Not provided'}`,
      `Use case: ${lead.useCase || 'Not provided'}`, `Preferred contact: ${lead.preferredContact}`, '', lead.message, '',
      `Manage enquiries: ${actionUrl}`
    ].join('\n')
  });
  const acknowledgement = await sendMail({
    to: lead.email,
    subject: `We received your ${brand.name} enquiry (${lead.reference})`,
    text: [
      `Hi ${firstName(lead.name)},`, '', 'Thank you for contacting ChatClan. Our team has received your enquiry.',
      `Reference: ${lead.reference}`, `Preferred contact: ${lead.preferredContact}`, '',
      'We will use the details you supplied to respond to this enquiry. Marketing updates are controlled separately.', '',
      `${brand.name} Team`
    ].join('\n'),
    html: emailShell({
      title: 'Your enquiry is in the right queue',
      intro: `Hi ${escapeHtml(firstName(lead.name))}, we received your enquiry for <strong>${escapeHtml(lead.company)}</strong>. Your reference is <strong>${escapeHtml(lead.reference)}</strong>.`,
      actionText: 'Visit ChatClan',
      actionUrl: appUrl(),
      footer: 'We will use the details you supplied to respond to this enquiry. Marketing updates are controlled separately.'
    })
  });
  return { internal, acknowledgement };
}

async function sendPublicLeadSlaEmail({ lead, escalated = false }) {
  const to = lead.ownerEmail || process.env.SALES_EMAIL || brand.supportEmail;
  const actionUrl = `${appUrl()}/platform`;
  const subject = escalated ? `${brand.name} lead SLA breached: ${lead.company}` : `${brand.name} lead response due soon: ${lead.company}`;
  const detail = escalated ? `The response target for ${lead.name} (${lead.reference}) has passed.` : `The response target for ${lead.name} (${lead.reference}) is approaching.`;
  return sendMail({
    to, replyTo:lead.email, subject,
    text:[subject, '', detail, `Priority: ${lead.priority}`, `Preferred contact: ${lead.preferredContact}`, `Owner: ${lead.ownerName || 'Unassigned'}`, '', `Open lead operations: ${actionUrl}`].join('\n'),
    html:emailShell({ title:subject, intro:`${escapeHtml(detail)}<br><br><strong>Priority:</strong> ${escapeHtml(lead.priority)}`, actionText:'Open lead operations', actionUrl, footer:'Assign an owner and record the first customer response in ChatClan.' })
  });
}

async function verifyMailer() {
  transporter = transporter || createTransporter();
  if (mailMode() !== 'smtp') return { mode: mailMode(), ok: true };
  await transporter.verify();
  return { mode: 'smtp', ok: true };
}

function smtpAuth() {
  if (!process.env.SMTP_USER && !process.env.SMTP_PASSWORD) return undefined;
  return {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  };
}

function getMockOutbox() {
  return mockOutbox;
}

function clearMockOutbox() {
  mockOutbox.length = 0;
}

function resetMailerForTests() {
  transporter = null;
  clearMockOutbox();
}

function emailShell({ title, intro, actionText, actionUrl, footer }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#07110d;color:#f4fbf6;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07110d;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111c17;border:1px solid #26382f;border-radius:12px;padding:28px">
            <tr><td style="font-size:14px;color:#22c55e;font-weight:700">${escapeHtml(brand.name)}</td></tr>
            <tr><td><h1 style="margin:18px 0 12px;font-size:26px;line-height:1.2;color:#f4fbf6">${escapeHtml(title)}</h1></td></tr>
            <tr><td style="font-size:16px;line-height:1.6;color:#cfe5d6">${intro}</td></tr>
            <tr><td style="padding:24px 0"><a href="${escapeAttribute(actionUrl)}" style="display:inline-block;background:#22c55e;color:#07110d;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:8px">${escapeHtml(actionText)}</a></td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#9fb6a8">${footer}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function firstName(name) {
  return String(name || 'there').trim().split(/\s+/)[0] || 'there';
}

function appUrl() {
  return String(process.env.APP_URL || brand.domain || 'http://localhost:3000').replace(/\/+$/, '');
}

function parseMockMessage(message) {
  if (!message) return {};
  try {
    return JSON.parse(String(message));
  } catch {
    return { raw: String(message) };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

module.exports = {
  clearMockOutbox,
  getMockOutbox,
  resetMailerForTests,
  sendConnectorAlertEmail,
  sendPlatformReliabilityAlertEmail,
  sendPublicLeadEmails,
  sendPublicLeadSlaEmail,
  sendMail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  verifyMailer
};
