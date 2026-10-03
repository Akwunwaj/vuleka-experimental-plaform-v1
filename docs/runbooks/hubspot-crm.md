# HubSpot CRM Lead Delivery

ChatClan supports HubSpot as a native lead destination while retaining the signed generic webhook adapter.

## HubSpot setup

1. Create an organisation-owned HubSpot Service Key under **Development > Service Keys**. HubSpot currently labels Service Keys as beta, so record an owner and six-month rotation date.
2. For contacts-only delivery, grant `crm.objects.contacts.read` and `crm.objects.contacts.write`.
3. For Contacts + Leads delivery, also grant `crm.objects.leads.read` and `crm.objects.leads.write`, then confirm that the Leads object is enabled for the account. A visible scope alone does not make the Leads object available in every account type.
4. Install these deployment secrets:

```text
CRM_LEAD_PROVIDER=hubspot
CRM_HUBSPOT_ACCESS_TOKEN=<service-key>
CRM_HUBSPOT_DELIVERY_MODE=contacts_only
CRM_HUBSPOT_TIMEOUT_MS=10000
```

Choose `contacts_only` unless the account passes a live Leads API test. Use `contacts_and_leads` only for accounts with working Leads access. Optional account-specific values may be supplied through `CRM_HUBSPOT_LEAD_TYPE` and `CRM_HUBSPOT_LEAD_LABEL`. ChatClan omits them by default because HubSpot allows those dropdown values to be customised.

## Delivery behaviour

- The contact is always upserted by email.
- In contacts-only mode, the contact synchronisation completes delivery without calling the optional Leads API.
- In Contacts + Leads mode, ChatClan searches `hs_lead_name` for `ChatClan <reference>` before creating a Lead, preventing duplicate records after retries.
- A new Lead is associated with the contact through HubSpot-defined association type `578`.
- Only consented lead and qualification fields are sent. IP hashes, browser data, platform audit records, and credentials are excluded.
- HTTP 408, 423, 429, and 5xx responses are retried through the durable job queue. Other 4xx responses require configuration correction.
- Provider delivery results are recorded in the lead activity timeline.

## SLA notifications

Every new lead schedules a reminder before its response deadline and an escalation at breach. Notifications route to the assigned Platform Owner, then `SALES_EMAIL`, then the configured support address. Jobs stop without notification once the lead is contacted, qualified, converted, or disqualified.

Configure the reminder window with `LEAD_SLA_REMINDER_MINUTES_BEFORE` (default: 30 minutes).
