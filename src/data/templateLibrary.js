const templateLibrary = [
  industry('retail', 'Retail & Fashion', 'MARKETING', 'Flash Sale', 'Hi {{1}}, our {{2}} sale is live. Use code {{3}} before midnight. Reply STOP to opt out.'),
  industry('restaurant', 'Restaurants', 'MARKETING', 'Weekly Special', 'Hi {{1}}, this week at {{2}}: {{3}}. Reply BOOK to reserve a table or STOP to opt out.'),
  industry('beauty', 'Beauty & Salons', 'UTILITY', 'Appointment Reminder', 'Hi {{1}}, your {{2}} appointment is confirmed for {{3}}. Reply RESCHEDULE if you need another time.'),
  industry('healthcare', 'Healthcare', 'UTILITY', 'Visit Reminder', 'Hi {{1}}, this is a reminder for your appointment at {{2}} on {{3}}. Reply HELP for assistance.'),
  industry('fitness', 'Fitness & Gyms', 'MARKETING', 'Class Promo', 'Hi {{1}}, {{2}} has new classes this week. Book your spot for {{3}}. Reply STOP to opt out.'),
  industry('education', 'Education', 'UTILITY', 'Class Update', 'Hi {{1}}, {{2}} has an update for {{3}}: {{4}}. Reply HELP if you have questions.'),
  industry('real_estate', 'Real Estate', 'MARKETING', 'Viewing Invite', 'Hi {{1}}, {{2}} has a new property viewing available at {{3}}. Reply VIEW for details or STOP to opt out.'),
  industry('automotive', 'Automotive', 'UTILITY', 'Service Reminder', 'Hi {{1}}, your vehicle service at {{2}} is due on {{3}}. Reply BOOK to schedule.'),
  industry('logistics', 'Logistics', 'UTILITY', 'Delivery Update', 'Hi {{1}}, your delivery {{2}} is {{3}}. Track it here: {{4}}.'),
  industry('ecommerce', 'E-commerce', 'UTILITY', 'Order Update', 'Hi {{1}}, your order {{2}} is {{3}}. Reply SUPPORT if you need help.'),
  industry('hospitality', 'Hotels & Guesthouses', 'UTILITY', 'Booking Confirmation', 'Hi {{1}}, your booking at {{2}} is confirmed for {{3}}. Reply INFO for check-in details.'),
  industry('events', 'Events', 'MARKETING', 'Event Reminder', 'Hi {{1}}, {{2}} is happening on {{3}}. Reply TICKETS for details or STOP to opt out.'),
  industry('finance', 'Financial Services', 'UTILITY', 'Account Notice', 'Hi {{1}}, {{2}} has an account update: {{3}}. Reply HELP to speak to our team.'),
  industry('legal', 'Legal Services', 'UTILITY', 'Consultation Reminder', 'Hi {{1}}, your consultation with {{2}} is booked for {{3}}. Reply CONFIRM to confirm.'),
  industry('home_services', 'Home Services', 'UTILITY', 'Job Booking', 'Hi {{1}}, your {{2}} booking is scheduled for {{3}}. Reply RESCHEDULE for another time.'),
  industry('ngo', 'NGO & Nonprofit', 'MARKETING', 'Campaign Update', 'Hi {{1}}, {{2}} is running {{3}}. Reply DONATE to support or STOP to opt out.'),
  industry('agriculture', 'Agriculture', 'UTILITY', 'Market Alert', 'Hi {{1}}, {{2}} market update for {{3}}: {{4}}.'),
  industry('media', 'Media & News', 'MARKETING', 'News Alert', 'Hi {{1}}, top update from {{2}}: {{3}}. Reply READ for more or STOP to opt out.'),
  industry('professional_services', 'Professional Services', 'UTILITY', 'Client Update', 'Hi {{1}}, {{2}} has an update for your request: {{3}}. Reply HELP if needed.')
];

function industry(industryId, industryName, category, name, body) {
  return {
    id: `${industryId}_${slugify(name)}`,
    industryId,
    industryName,
    name,
    category,
    language: 'en_ZA',
    body,
    footer: category === 'MARKETING' ? 'Reply STOP to opt out.' : '',
    status: 'Library'
  };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = { templateLibrary, slugify };
