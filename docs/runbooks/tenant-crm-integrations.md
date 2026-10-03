# Tenant CRM Integrations Runbook

ChatClan supports tenant-owned contact synchronisation to HubSpot, Salesforce, Zoho CRM, and Pipedrive. This is separate from the Platform Owner HubSpot Service Key used for ChatClan's own public sales leads.

## Security model

- ChatClan owns one organisation-controlled OAuth application per provider; each tenant authorises its own CRM account.
- OAuth state is random, hashed at rest, valid for ten minutes, single use, and bound to the initiating workspace and user.
- Access and refresh tokens are encrypted with `APP_ENCRYPTION_KEY`; browser and API responses contain masked values only.
- Provider access is limited to contacts. Optional tenant fields are not sent until explicitly mapped.
- Disconnect clears stored credentials, cancels scheduled jobs, and attempts provider revocation where supported. HubSpot and Salesforce may also require uninstalling/revoking the app in the provider account.

## Registered callbacks

Use the exact deployed `APP_URL` origin:

```text
https://app.chatclan.co.za/auth/crm/hubspot/callback
https://app.chatclan.co.za/auth/crm/salesforce/callback
https://app.chatclan.co.za/auth/crm/zoho/callback
https://app.chatclan.co.za/auth/crm/pipedrive/callback
```

For the current pre-production subdomain, replace the origin with `https://chatclan.tfpdigital.co.za`. Local provider testing needs an HTTPS tunnel; providers will not accept `127.0.0.1` as a production callback.

## Environment secrets

Install each client ID and secret through the deployment secret manager, never source control. The complete variable list and defaults are in `.env.example`. Restart both the app and worker after changing credentials.

Salesforce defaults to REST API `v67.0` for Summer 2026 and can be pinned with `CRM_SALESFORCE_API_VERSION`. Use a Salesforce External Client App with `api` and `refresh_token` access. Zoho URLs must match the app's data centre by overriding `CRM_ZOHO_OAUTH_AUTHORIZE_URL` and `CRM_ZOHO_OAUTH_TOKEN_URL`. Pipedrive permissions are selected in its Marketplace app configuration.

## Sandbox acceptance test

1. Apply and verify the local schema with `npm run db:schema` and `npm run db:verify`.
2. Configure one provider's OAuth application and exact callback.
3. Add an organisation-controlled sandbox user and CRM account.
4. Open **Workspace > Integrations**, select **Connect CRM**, review mappings, and complete provider consent.
5. Confirm the connection is masked, the initial job is queued, and the worker records a completed sync run.
6. Confirm one consented ChatClan contact exists once in the remote CRM and a repeated run does not create a duplicate.
7. Change one mapped contact field and confirm the linked remote contact is updated.
8. Exercise **Test connection**, **Pause**, **Resume**, **Sync now**, and **Disconnect**. Confirm obsolete scheduled jobs are cancelled and no token appears in logs or responses.

### HubSpot contact identity

- Use HubSpot batch upsert only when the ChatClan contact has an email address; HubSpot accepts `email` or a custom unique property as the contact upsert identifier.
- Do not use the standard `phone` property as `idProperty`. It is not unique and HubSpot rejects that request.
- For phone-only WhatsApp contacts, search the mapped phone property for an exact match. Update a single match, create when there is no match, and stop with a non-retryable conflict when multiple records match.
- Persist HubSpot's returned contact ID in `business_crm_record_links`. Repeat synchronisation must update through that ID and skip unchanged payload hashes.

### HubSpot acceptance evidence - 2026-07-27

- Organisation project: `ChatClan CRM`, HubSpot platform `2026.03`, OAuth, Marketplace distribution, app ID `47112348`.
- Required scopes: `oauth`, `crm.objects.contacts.read`, and `crm.objects.contacts.write`.
- Sandbox: `ChatClan CRM Sandbox` (`148976564`), free developer test tiers.
- OAuth consent, state callback, encrypted credential storage, masked UI, and provider health check passed.
- Two consecutive live sync runs each completed `12 attempted / 12 succeeded / 0 failed`.
- Provider reconciliation found all 12 stored external IDs in HubSpot. The repeat run retained 12 distinct linked IDs and created no duplicate ChatClan contacts.
- The temporary ngrok callback was removed after testing. Deployed build `#3` contains only the pre-production and future production callbacks.

## Operational recovery

- `partial`: inspect failed record evidence, correct field permissions or mapping, then use **Sync now**.
- `error` with HTTP 401/403: test the connection, re-authorise if consent or credentials were revoked, and verify scopes in the provider app.
- HTTP 429/5xx: allow the durable queue to retry; repeated provider-wide failures belong in the Platform Owner reliability and incident workflow.
- Mapping error: use actual writable Contact property API names. Required name/email/phone mappings cannot be blank; Segment and Opt-in are intentionally optional.
- Disconnect is the containment action for suspected compromise. Rotate the provider client secret and `APP_ENCRYPTION_KEY` under the security rotation procedure if platform credentials may be exposed.

## Current documentation references

- [HubSpot OAuth](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth)
- [HubSpot Contacts API](https://developers.hubspot.com/docs/api-reference/latest/crm/objects/contacts/guide)
- [Salesforce OAuth endpoints](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_endpoints.htm&type=5)
- [Zoho CRM OAuth](https://www.zoho.com/crm/developer/docs/api/v8/oauth-overview.html)
- [Pipedrive OAuth](https://pipedrive.readme.io/docs/marketplace-oauth-authorization)

HubSpot live sandbox acceptance is complete. Salesforce, Zoho CRM, and Pipedrive remain incomplete until their app registrations, secrets, consent flows, and sandbox contact writes have been evidenced independently.
