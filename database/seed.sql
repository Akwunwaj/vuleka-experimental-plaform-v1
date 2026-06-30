insert into businesses (id, name, plan, meta_waba_id, meta_phone_number_id)
values (1, 'ChatClan Demo Store', 'Growth', null, null)
on duplicate key update name = values(name), plan = values(plan);

insert into users (id, name, email, password_hash, status)
values
(1, 'Admin User', 'admin@chatclan.co.za', 'scrypt:c00174b877af4d4053fba0560a1d21dc:b873d38a3787a468d1930c165ef32f9a4bb5b0ee4fa86ed90881ac90a2a2cfa49d33be887c8bce3890d010396ff806afd528e224772da631159500ce6e6fc7ae', 'active')
on duplicate key update name = values(name), password_hash = values(password_hash), status = values(status);

insert into business_memberships (business_id, user_id, role)
values (1, 1, 'owner')
on duplicate key update role = values(role);

insert into contacts (business_id, name, phone, segment, opted_in, last_seen) values
(1, 'Nomsa Mkhize', '+27 82 123 4567', 'VIP', 1, 'Today'),
(1, 'Thabo Nkosi', '+27 71 234 5678', 'Recent buyer', 1, 'Yesterday'),
(1, 'Zanele Dlamini', '+27 83 345 6789', 'Fashion lovers', 1, '2 days ago'),
(1, 'Lerato Phiri', '+27 76 456 7890', 'Inactive 30d', 0, '31 days ago')
on duplicate key update segment = values(segment), opted_in = values(opted_in), last_seen = values(last_seen);

insert into campaigns (business_id, name, status, audience, category, body, schedule_type, sent, delivered, read_rate, revenue) values
(1, 'Winter Sale Broadcast', 'Sent', '2,341 contacts', 'MARKETING', 'Hi {{first_name}}, our winter sale is live.', 'now', 2341, 2298, '82%', 'R 42,800'),
(1, 'Abandoned Cart Recovery', 'Running', '412 contacts', 'UTILITY', 'You left items in your cart. Reply CHECKOUT to complete.', 'now', 412, 401, '88%', 'R 14,220'),
(1, 'VIP Early Access', 'Draft', '156 contacts', 'MARKETING', 'VIP customers get first access this Friday.', 'later', 0, 0, '-', '-');

insert into inbox_conversations
  (business_id, contact_id, customer_name, customer_phone, status, last_message_preview, last_message_at, unread_count, source)
select 1, c.id, c.name, replace(c.phone, ' ', ''), 'open', 'Can I collect in store today?', current_timestamp, 2, 'whatsapp'
from contacts c
where c.business_id = 1 and c.name = 'Nomsa Mkhize'
on duplicate key update
  customer_name = values(customer_name),
  last_message_preview = values(last_message_preview),
  unread_count = values(unread_count);

insert into inbox_messages
  (business_id, conversation_id, direction, channel, provider_message_id, message_type, body, status, occurred_at, metadata)
select 1, ic.id, 'inbound', 'whatsapp', 'seed_nomsa_1', 'text', 'Can I collect in store today?', 'received', current_timestamp, json_object('seed', true)
from inbox_conversations ic
where ic.business_id = 1 and ic.customer_phone = '+27821234567'
on duplicate key update body = values(body);

insert into message_templates (business_id, name, category, status, body) values
(1, 'Flash Sale', 'Marketing', 'Approved', 'Hi {{1}}, our {{2}} sale is live. Use code {{3}} before midnight.'),
(1, 'Order Shipped', 'Utility', 'Approved', 'Your order {{1}} is on the way. Track it here: {{2}}'),
(1, 'Appointment Reminder', 'Utility', 'Approved', 'Reminder: your booking is confirmed for {{1}} at {{2}}.'),
(1, 'Winback Offer', 'Marketing', 'Approved', 'We miss you, {{1}}. Here is {{2}} off your next order.');

insert into business_subscriptions
  (business_id, plan_code, provider, provider_subscription_token, merchant_payment_id, status, amount_cents, currency, billing_frequency, next_billing_date, current_period_started_at, current_period_ends_at)
values
  (1, 'growth', 'payfast', 'seed_token', 'seed_1_growth', 'active', 79900, 'ZAR', 'monthly', '2026-07-01', '2026-06-01 00:00:00', '2026-07-01 00:00:00')
on duplicate key update status = values(status), amount_cents = values(amount_cents), next_billing_date = values(next_billing_date);

insert into invoices
  (business_id, invoice_number, provider, provider_payment_id, merchant_payment_id, amount_cents, currency, status, issued_on, due_on, paid_at, metadata)
values
  (1, 'CC-2026-000001', 'payfast', 'seed_pf_1', 'seed_1_growth', 79900, 'ZAR', 'paid', '2026-06-01', '2026-06-01', '2026-06-01 00:00:00', json_object('planCode', 'growth'))
on duplicate key update status = values(status), amount_cents = values(amount_cents), paid_at = values(paid_at);
