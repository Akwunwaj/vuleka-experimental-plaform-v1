#!/usr/bin/env node

require('dotenv').config({ quiet:true });
const { getGoogleDriveOAuthStatus } = require('../src/services/googleDriveOAuth');

const status = getGoogleDriveOAuthStatus();
const labels = {
  clientId:'OAuth client ID configured', clientIdFormat:'OAuth client ID has Google web-client format',
  clientSecret:'OAuth client secret configured', clientSecretSafety:'OAuth client secret is not a placeholder',
  redirectUri:'Redirect URI is HTTPS or local development', callbackPath:'Redirect URI uses the ChatClan callback path',
  redirectMatchesAppUrl:'Redirect URI exactly matches APP_URL and the ChatClan callback path',
  scopes:'Full-folder sync uses only the Drive read-only scope', testUsers:'Sandbox test users are configured as valid email addresses',
  verification:'Google OAuth verification approved', securityAssessment:'Restricted-scope security assessment approved'
};

console.log('ChatClan Google Drive OAuth preflight');
console.log(`Callback: ${status.redirectUri || 'not configured'}`);
console.log(`Expected callback: ${status.expectedRedirectUri}`);
console.log(`Scopes: ${status.scopes.join(', ') || 'none'}`);
for (const [key, label] of Object.entries(labels)) console.log(`[${status.checks[key] ? 'pass' : 'fail'}] ${label}`);
console.log(`Sandbox ready: ${status.sandboxReady ? 'yes' : 'no'}`);
console.log(`Production ready: ${status.productionReady ? 'yes' : 'no'}`);

const required = String(process.env.GOOGLE_DRIVE_OAUTH_REQUIRED || '').toLowerCase() === 'true';
if ((required && !status.productionReady) || (!required && !status.sandboxReady)) process.exitCode = 1;
