const { enqueueJob } = require('./jobQueue');
const { addPublicLeadEvent, getPublicLead, listPublicLeadEvents } = require('./publicLeads');
const { sendPublicLeadSlaEmail } = require('./mailer');

async function queuePublicLeadSlaChecks(lead) {
  if (!lead?.id || !lead.responseDueAt) return { queued:false, reason:'no_deadline' };
  const dueAt = new Date(lead.responseDueAt);
  const reminderAt = new Date(Math.max(Date.now(), dueAt.getTime() - reminderMinutes() * 60_000));
  const [reminder, escalation] = await Promise.all([
    enqueueJob({ type:'public.lead.sla_reminder', payload:{ leadId:lead.id }, runAt:reminderAt, maxAttempts:3, dedupeKey:`public-lead-sla-reminder:${lead.id}` }),
    enqueueJob({ type:'public.lead.sla_escalation', payload:{ leadId:lead.id }, runAt:dueAt, maxAttempts:3, dedupeKey:`public-lead-sla-escalation:${lead.id}` })
  ]);
  return { queued:true, reminder, escalation };
}

async function processPublicLeadSla({ leadId }, { escalated = false } = {}) {
  const lead = await getPublicLead(leadId);
  if (lead.firstContactedAt || ['contacted','qualified','converted','disqualified'].includes(lead.status)) return { notified:false, reason:'already_handled' };
  const eventType = escalated ? 'sla_escalated' : 'sla_reminder';
  const events = await listPublicLeadEvents(lead.id);
  if (events.some((event) => event.eventType === eventType)) return { notified:false, reason:'already_notified' };
  if (!escalated && new Date(lead.responseDueAt).getTime() <= Date.now()) return { notified:false, reason:'deadline_reached' };
  await sendPublicLeadSlaEmail({ lead, escalated });
  await addPublicLeadEvent({ leadId:lead.id, eventType, note:escalated ? 'Response SLA breached. Escalation notification sent.' : 'Response SLA reminder notification sent.', metadata:{ recipient:lead.ownerEmail || process.env.SALES_EMAIL || 'support' } });
  return { notified:true, escalated };
}

function reminderMinutes() {
  const parsed = Number(process.env.LEAD_SLA_REMINDER_MINUTES_BEFORE || 30);
  return Number.isFinite(parsed) ? Math.min(240, Math.max(5, parsed)) : 30;
}

module.exports = { processPublicLeadSla, queuePublicLeadSlaChecks };
