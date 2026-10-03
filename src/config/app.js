const brand = {
  name: process.env.APP_NAME || 'ChatClan',
  legalName: process.env.COMPANY_LEGAL_NAME || 'ChatClan (Pty) Ltd',
  mark: 'C',
  domain: process.env.APP_URL || 'https://app.chatclan.co.za',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@chatclan.co.za',
  billingEmail: process.env.BILLING_EMAIL || process.env.SUPPORT_EMAIL || 'support@chatclan.co.za',
  privacyEmail: process.env.PRIVACY_EMAIL || process.env.SUPPORT_EMAIL || 'support@chatclan.co.za',
  securityEmail: process.env.SECURITY_EMAIL || process.env.SUPPORT_EMAIL || 'support@chatclan.co.za',
  legalEmail: process.env.LEGAL_EMAIL || process.env.SUPPORT_EMAIL || 'support@chatclan.co.za',
  registrationNumber: process.env.COMPANY_REGISTRATION_NUMBER || 'Not yet configured',
  physicalAddress: process.env.COMPANY_PHYSICAL_ADDRESS || 'Not yet configured',
  telephone: process.env.COMPANY_TELEPHONE || 'Not yet configured',
  placeOfRegistration: process.env.COMPANY_PLACE_OF_REGISTRATION || 'Not yet configured',
  officeBearers: process.env.COMPANY_OFFICE_BEARERS || 'Not yet configured',
  informationOfficerName: process.env.INFORMATION_OFFICER_NAME || 'Not yet configured',
  informationOfficerEmail: process.env.INFORMATION_OFFICER_EMAIL || process.env.PRIVACY_EMAIL || process.env.SUPPORT_EMAIL || 'support@chatclan.co.za'
};

module.exports = { brand };
