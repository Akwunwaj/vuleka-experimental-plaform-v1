const { slugify, templateLibrary } = require('./templateLibrary');

const useCases = {
  retail: ['Product discovery', 'Stock enquiry', 'Return request'],
  restaurant: ['Table booking', 'Order delivery', 'Daily special'],
  beauty: ['Appointment booking', 'Reschedule visit', 'Service menu'],
  healthcare: ['Appointment booking', 'Symptom triage', 'Medication reminder'],
  fitness: ['Class booking', 'Membership query', 'Trainer handoff'],
  education: ['Course enquiry', 'Student support', 'Fee reminder'],
  real_estate: ['Viewing booking', 'Property enquiry', 'Agent handoff'],
  automotive: ['Service booking', 'Test drive', 'Roadside handoff'],
  logistics: ['Track shipment', 'Reschedule delivery', 'Proof of delivery'],
  ecommerce: ['Product discovery', 'Order tracking', 'Return request'],
  hospitality: ['Booking info', 'Check-in help', 'Guest services'],
  events: ['Ticket enquiry', 'Event reminder', 'Venue info'],
  finance: ['Account help', 'Payment reminder', 'Advisor handoff'],
  legal: ['Consultation booking', 'Case update', 'Document checklist'],
  home_services: ['Job booking', 'Quote request', 'Technician handoff'],
  ngo: ['Donation flow', 'Volunteer signup', 'Beneficiary support'],
  agriculture: ['Market alert', 'Weather advisory', 'Input order'],
  media: ['News briefing', 'Subscription help', 'Reader poll'],
  professional_services: ['Consultation booking', 'Client update', 'Team handoff']
};

const chatbotFlowLibrary = templateLibrary.map((template) => {
  const industryUseCases = useCases[template.industryId] || ['Welcome flow', 'Support handoff', 'FAQ'];
  const primaryUseCase = industryUseCases[0];
  return {
    id: `${template.industryId}_starter_flow`,
    industryId: template.industryId,
    industryName: template.industryName,
    name: `${template.industryName} Starter Bot`,
    description: `A WhatsApp starter automation for ${primaryUseCase.toLowerCase()} with quick replies, escalation, and confirmation.`,
    useCases: industryUseCases,
    definition: buildDefinition(template, primaryUseCase, industryUseCases)
  };
});

function buildDefinition(template, primaryUseCase, industryUseCases) {
  const optionA = industryUseCases[0] || 'Start';
  const optionB = industryUseCases[1] || 'Support';
  return {
    version: 1,
    locale: 'en_ZA',
    startNodeId: 'trigger_inbound',
    nodes: [
      {
        id: 'trigger_inbound',
        type: 'trigger',
        name: 'Inbound keyword',
        config: {
          keywords: [keywordFor(optionA), 'hi', 'hello']
        }
      },
      {
        id: 'welcome_message',
        type: 'message',
        name: 'Welcome menu',
        config: {
          body: `Hi {{first_name}}, welcome to ${template.industryName}. How can we help today?`,
          buttons: [optionA, optionB, 'Talk to agent']
        }
      },
      {
        id: 'intent_branch',
        type: 'condition',
        name: 'Customer choice',
        config: {
          branches: [
            { label: optionA, match: optionA, targetNodeId: 'primary_response' },
            { label: optionB, match: optionB, targetNodeId: 'secondary_response' },
            { label: 'Talk to agent', match: 'agent', targetNodeId: 'handoff_agent' }
          ],
          fallbackNodeId: 'fallback_message'
        }
      },
      {
        id: 'primary_response',
        type: 'message',
        name: `${primaryUseCase} response`,
        config: {
          body: template.body.replace(/\{\{\d+\}\}/g, '{{first_name}}'),
          buttons: ['Confirm', 'More info', 'Talk to agent']
        }
      },
      {
        id: 'secondary_response',
        type: 'message',
        name: `${optionB} response`,
        config: {
          body: `Thanks. Please share a little more about your ${optionB.toLowerCase()} request and our team will guide you.`,
          buttons: ['Confirm', 'Talk to agent']
        }
      },
      {
        id: 'fallback_message',
        type: 'message',
        name: 'Fallback',
        config: {
          body: 'I did not catch that. Please choose one of the options below.',
          buttons: [optionA, optionB, 'Talk to agent']
        }
      },
      {
        id: 'handoff_agent',
        type: 'action',
        name: 'Escalate to human',
        config: {
          action: 'assign_to_agent',
          note: 'Bot escalation'
        }
      },
      {
        id: 'end_success',
        type: 'end',
        name: 'End flow',
        config: {
          outcome: 'resolved'
        }
      }
    ],
    edges: [
      { from: 'trigger_inbound', to: 'welcome_message' },
      { from: 'welcome_message', to: 'intent_branch' },
      { from: 'primary_response', to: 'end_success' },
      { from: 'secondary_response', to: 'end_success' },
      { from: 'fallback_message', to: 'intent_branch' },
      { from: 'handoff_agent', to: 'end_success' }
    ],
    layout: {
      trigger_inbound: { x: 80, y: 80 },
      welcome_message: { x: 280, y: 80 },
      intent_branch: { x: 500, y: 80 },
      primary_response: { x: 720, y: 20 },
      secondary_response: { x: 720, y: 150 },
      handoff_agent: { x: 720, y: 280 },
      end_success: { x: 960, y: 150 }
    }
  };
}

function keywordFor(value) {
  return slugify(value).split('_')[0] || 'start';
}

module.exports = { chatbotFlowLibrary };
