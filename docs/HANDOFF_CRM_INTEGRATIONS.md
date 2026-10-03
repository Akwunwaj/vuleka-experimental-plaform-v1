# ChatClan CRM Integrations Handoff

## Current status

- Local ChatClan is running at `http://127.0.0.1:3000` and was also exposed temporarily through a Dev Tunnel.
- HubSpot organisation OAuth and sandbox contact delivery were completed earlier.
- Pipedrive private OAuth app `ChatClan CRM` was created in the `joey-sandbox` Pipedrive developer account.
- A Pipedrive tenant connection was successfully completed through the ChatClan Integrations UI.
- The first manual Pipedrive contact sync completed successfully after running the worker once.
- Node can reach Pipedrive's token endpoint. A credential-free POST returned HTTP `400`, which is the expected response for a malformed OAuth token request and confirms outbound connectivity.

## Important security context

- Do not expose or read OAuth client secrets in chat, terminal output, commits, or screenshots.
- The Pipedrive client secret was rotated during setup. The current secret is stored only in the local ignored `.env` file.
- Pipedrive browser automation is blocked by policy. Ask the user to perform provider-console steps manually when needed.
- The Pipedrive OAuth callback currently uses the temporary Dev Tunnel URL. Do not use this for production.

## Local Pipedrive configuration

The local `.env` contains these non-secret settings:

```dotenv
CRM_PIPEDRIVE_OAUTH_CLIENT_ID=611a5e68f4d5ad96
CRM_PIPEDRIVE_OAUTH_REDIRECT_URI=https://lrrsvq3d-3000.inc1.devtunnels.ms/auth/crm/pipedrive/callback
```

It also contains `CRM_PIPEDRIVE_OAUTH_CLIENT_SECRET`, which must remain private.

Before production, replace the temporary callback in both Pipedrive and deployment configuration with:

```text
https://chatclan.tfpdigital.co.za/auth/crm/pipedrive/callback
```

## How CRM integrations work today

1. Platform Owner configures provider OAuth credentials once.
2. Each tenant authorises its own CRM account through the provider's OAuth consent page.
3. Tokens are encrypted and stored against that tenant's connection.
4. The tenant can select a schedule, test the connection, queue a sync, pause, edit mappings, or disconnect.
5. Background workers process queued CRM sync jobs.
6. Current direction is ChatClan contacts to external CRM.
7. Pipedrive sync uses exact email/phone matching before creation. It updates one confirmed match, creates no-match records, and rejects ambiguous matches to prevent duplicates.

This is deliberately not yet two-way sync. The next phase should introduce external CRM imports behind tenant controls, consent rules, conflict handling, and a review queue.

## Relevant files changed recently

- `src/services/tenantCrm.js`
  - Pipedrive OAuth token network failures now produce a useful safe error instead of raw `fetch failed`.
  - Pipedrive core mappings are fixed to provider-safe defaults: `name`, `emails`, and `phones`.
  - Exact identity matching and duplicate prevention are implemented.
- `public/js/app.js`
  - Pipedrive core mapping inputs are read-only.
  - Dashboard hash routing now restores the active page after refresh and supports Back/Forward navigation.
- `src/server.js`
  - Raw server stack traces were removed from normal log output.
- `test/services.test.js`
  - Added coverage for Pipedrive field mapping and safe OAuth network errors.

## Worker operations

The web server queues sync work. A separate worker processes it.

```powershell
cd C:\Users\akwun\Jobs\Wazify-saas-platform
npm start
```

In a second terminal:

```powershell
npm run worker
```

For a single immediate local run:

```powershell
npm run worker:once
```

The continuous worker polls for jobs every 2 seconds by default. A manual **Sync now** action correctly reports `CRM synchronisation queued`; completion appears in Integrations after the worker processes the job.

## Verification completed

```text
npm test       160 / 160 passing
npm run check  passing
```

## Recommended next work

1. Improve the Integrations UX: live job status/progress polling so queued jobs visibly move through `Queued`, `Processing`, `Succeeded`, or `Failed` without a manual refresh.
2. Run a repeated Pipedrive sync using a known contact and verify no duplicate Pipedrive person is created.
3. Move the Pipedrive callback from the temporary Dev Tunnel to `chatclan.tfpdigital.co.za`, update deployment secrets, and repeat OAuth consent in a production-like sandbox.
4. Design controlled two-way CRM sync: imports, field-level ownership, conflict policies, consent safeguards, deletion behavior, and a review queue.

## Workspace cautions

- The git worktree has many unrelated existing changes. Do not revert or clean broadly.
- The user wants localhost UX and functionality corrected before production deployment.
- After each completed task, propose the next concrete move.
