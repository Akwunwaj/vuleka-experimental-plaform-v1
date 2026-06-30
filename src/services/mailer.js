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
  sendMail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  verifyMailer
};
