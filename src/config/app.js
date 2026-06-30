const brand = {
  name: 'ChatClan',
  legalName: 'ChatClan (Pty) Ltd',
  mark: 'C',
  domain: process.env.APP_URL || 'https://app.chatclan.co.za',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@chatclan.co.za'
};

module.exports = { brand };
