# Google Drive OAuth rollout runbook

## Purpose

Use this runbook to move ChatClan Google Drive synchronisation from local configuration to an approved production OAuth application. Never place the client secret, access tokens, refresh tokens, or test-user addresses in source control.

## Google Cloud setup

1. Create or select a dedicated production Google Cloud project owned by the ChatClan organisation.
2. Enable the Google Drive API.
3. Configure the OAuth consent screen with the public ChatClan product name, support address, verified application domains, privacy policy, and terms links.
4. Create an OAuth 2.0 Web application client.
5. Register the exact callback URI: `${APP_URL}/auth/google-drive/callback`. Production must use HTTPS; path, scheme, host, port, and trailing slash must match exactly.
6. Add internal QA accounts as OAuth test users while the application remains in testing.
7. Declare only the scopes requested by ChatClan. Automatic background folder synchronisation currently requires `https://www.googleapis.com/auth/drive.readonly`.
8. Copy the generated web client ID and secret directly to the deployment secret manager. Do not use the project number, API key, or a desktop client credential.

## Platform configuration

Set these values in the deployment secret manager, not in committed files:

```text
GOOGLE_DRIVE_OAUTH_CLIENT_ID=
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=
GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://app.example.com/auth/google-drive/callback
GOOGLE_DRIVE_OAUTH_SCOPES=https://www.googleapis.com/auth/drive.readonly
GOOGLE_DRIVE_OAUTH_TEST_USERS=qa@example.com
GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS=in_progress
GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS=in_progress
GOOGLE_DRIVE_OAUTH_REQUIRED=false
```

Run `npm run ops:google-oauth`. Sandbox rollout requires valid credentials, callback, scopes, and at least one test user. Set `GOOGLE_DRIVE_OAUTH_REQUIRED=true` in production so release checks require approved verification and security assessment states.

### DirectAdmin deployment

1. Open the production domain in DirectAdmin and locate the Node.js application environment-variable settings.
2. Add the nine `GOOGLE_DRIVE_OAUTH_*` values above. Keep `GOOGLE_DRIVE_OAUTH_REQUIRED=false` during the test-user sandbox phase.
3. Confirm `APP_URL` is the public HTTPS origin with no trailing slash. The preflight derives the only accepted callback as `${APP_URL}/auth/google-drive/callback`.
4. Restart the Node.js application and worker so both processes receive the new environment.
5. Run `npm run ops:google-oauth` in the deployed application directory. Do not continue to consent testing unless every sandbox check passes.

The preflight deliberately prints no client ID, client secret, or test-user address. A callback on another host, a malformed Google web-client ID, placeholder credentials, extra Drive scopes, or invalid test-user addresses fails closed.

## Sandbox verification

1. Sign in to a ChatClan QA workspace as an owner or administrator.
2. Open Knowledge & AI, Sources & evals, Add connector, and select Google Drive.
3. Enter a dedicated QA folder ID and continue to Google.
4. Confirm the consent screen shows the expected ChatClan identity and Drive read-only scope.
5. Complete consent and confirm ChatClan returns to Connector operations.
6. Run the worker and confirm the first sync succeeds, supported documents appear as draft knowledge, and no token appears in API responses, logs, or job payloads.
7. Run Sync now, then pause, resume, and delete the source. Confirm deletion attempts Google token revocation.
8. Revoke ChatClan from the Google Account security page and confirm the next sync creates an actionable connector alert.

Record the test date, Google Cloud project ID, OAuth client name, tester, callback URI, connector source ID, first-sync result, and revocation result in the release evidence. Never record tokens or the client secret.

## Production approval

Submit Google OAuth verification before public rollout. Because `drive.readonly` is a restricted scope, complete the applicable independent security assessment and set both readiness statuses to `approved` only after evidence is retained by the platform owner. Re-run the preflight and release checks before enabling customer access.

Google recommends `drive.file` with Google Picker for user-selected files because it is non-sensitive and offers a simpler verification path. ChatClan must not claim that mode supports automatic whole-folder synchronisation until a live Google sandbox proves access to existing and newly added child files. Treat a future selected-file connector as a separate least-privilege product mode, not as an untested scope substitution.

## Rollback

Set `GOOGLE_DRIVE_OAUTH_REQUIRED=false`, remove the OAuth client secret from the deployment, and pause existing Google Drive sources. Do not delete alert or sync history. Revoke the affected OAuth client or individual grants in Google Cloud when credential exposure is suspected.
