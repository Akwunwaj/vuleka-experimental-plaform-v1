create table if not exists businesses (
  id bigint unsigned primary key auto_increment,
  name varchar(180) not null,
  plan varchar(50) not null default 'Starter',
  meta_waba_id varchar(100),
  meta_phone_number_id varchar(100),
  created_at timestamp default current_timestamp
);

create table if not exists users (
  id bigint unsigned primary key auto_increment,
  name varchar(180) not null,
  email varchar(180) not null unique,
  password_hash varchar(220) not null,
  status varchar(40) not null default 'active',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);

create table if not exists business_memberships (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  user_id bigint unsigned not null,
  role varchar(40) not null default 'member',
  created_at timestamp default current_timestamp,
  unique key business_memberships_unique (business_id, user_id),
  constraint business_memberships_business_fk foreign key (business_id) references businesses(id),
  constraint business_memberships_user_fk foreign key (user_id) references users(id)
);

create table if not exists sessions (
  id char(64) primary key,
  user_id bigint unsigned not null,
  business_id bigint unsigned not null,
  user_agent varchar(255),
  ip_address varchar(64),
  expires_at timestamp not null,
  created_at timestamp default current_timestamp,
  constraint sessions_user_fk foreign key (user_id) references users(id),
  constraint sessions_business_fk foreign key (business_id) references businesses(id),
  index sessions_expires_at_idx (expires_at)
);

create table if not exists password_reset_tokens (
  id bigint unsigned primary key auto_increment,
  user_id bigint unsigned not null,
  token_hash char(64) not null,
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp default current_timestamp,
  unique key password_reset_tokens_hash_unique (token_hash),
  index password_reset_tokens_user_idx (user_id, expires_at),
  constraint password_reset_tokens_user_fk foreign key (user_id) references users(id)
);

create table if not exists social_auth_states (
  id bigint unsigned primary key auto_increment,
  state_hash char(64) not null unique,
  provider varchar(40) not null,
  purpose varchar(40) not null,
  plan_code varchar(40),
  redirect_to varchar(255),
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp default current_timestamp,
  index social_auth_states_provider_idx (provider, expires_at)
);

create table if not exists social_signup_verifications (
  id bigint unsigned primary key auto_increment,
  token_hash char(64) not null unique,
  provider varchar(40) not null,
  provider_user_id varchar(180) not null,
  email varchar(180) not null,
  name varchar(180),
  plan_code varchar(40),
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp default current_timestamp,
  index social_signup_verifications_email_idx (email, expires_at)
);

create table if not exists social_identities (
  id bigint unsigned primary key auto_increment,
  user_id bigint unsigned not null,
  provider varchar(40) not null,
  provider_user_id varchar(180) not null,
  email varchar(180) not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key social_identities_provider_user_unique (provider, provider_user_id),
  unique key social_identities_user_provider_unique (user_id, provider),
  constraint social_identities_user_fk foreign key (user_id) references users(id)
);

create table if not exists business_integrations (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  provider varchar(80) not null,
  status varchar(40) not null default 'pending',
  external_account_id varchar(120),
  phone_number_id varchar(120),
  access_token_encrypted text,
  verify_token varchar(180),
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key business_integrations_provider_unique (business_id, provider),
  constraint business_integrations_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists setup_wizard_steps (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  step_id varchar(80) not null,
  status varchar(40) not null default 'pending',
  completed_at timestamp null,
  metadata_json json,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key setup_wizard_steps_business_step_unique (business_id, step_id),
  constraint setup_wizard_steps_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists contacts (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  phone varchar(40) not null,
  email varchar(180),
  segment varchar(80) default 'Imported',
  opted_in tinyint(1) not null default 1,
  opt_in_channel varchar(120),
  opt_in_at timestamp null,
  opted_out_at timestamp null,
  last_seen varchar(80) default 'New',
  created_at timestamp default current_timestamp,
  unique key contacts_business_phone_unique (business_id, phone),
  constraint contacts_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists contact_import_jobs (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  file_name varchar(255) not null,
  status varchar(40) not null default 'pending',
  total_rows int unsigned not null default 0,
  imported_count int unsigned not null default 0,
  duplicate_count int unsigned not null default 0,
  error_count int unsigned not null default 0,
  created_at timestamp default current_timestamp,
  completed_at timestamp null,
  constraint contact_import_jobs_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists opt_in_events (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  contact_id bigint unsigned not null,
  event_type varchar(40) not null,
  channel varchar(120) not null,
  source varchar(180),
  occurred_at timestamp not null,
  metadata json,
  constraint opt_in_events_business_fk foreign key (business_id) references businesses(id),
  constraint opt_in_events_contact_fk foreign key (contact_id) references contacts(id),
  index opt_in_events_contact_idx (contact_id, occurred_at)
);

create table if not exists data_deletion_requests (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  contact_id bigint unsigned,
  phone_masked varchar(80) not null,
  phone_hash char(64) not null,
  requested_by_user_id bigint unsigned,
  reason varchar(255),
  status varchar(40) not null default 'processing',
  affected_counts_json json,
  requested_at timestamp default current_timestamp,
  completed_at timestamp null,
  index data_deletion_requests_business_idx (business_id, requested_at),
  index data_deletion_requests_hash_idx (business_id, phone_hash),
  constraint data_deletion_requests_business_fk foreign key (business_id) references businesses(id),
  constraint data_deletion_requests_contact_fk foreign key (contact_id) references contacts(id),
  constraint data_deletion_requests_user_fk foreign key (requested_by_user_id) references users(id)
);

create table if not exists campaigns (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  status varchar(40) not null default 'Draft',
  audience varchar(120) not null default 'All contacts',
  category varchar(40) not null default 'MARKETING',
  body text,
  schedule_type varchar(40) not null default 'now',
  sent int unsigned not null default 0,
  delivered int unsigned not null default 0,
  read_rate varchar(20) not null default '-',
  revenue varchar(40) not null default '-',
  created_at timestamp default current_timestamp,
  constraint campaigns_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists campaign_recipients (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  campaign_id bigint unsigned not null,
  contact_id bigint unsigned not null,
  phone varchar(40) not null,
  status varchar(40) not null default 'queued',
  personalized_body text,
  provider_message_id varchar(180),
  error_message varchar(255),
  queued_at timestamp default current_timestamp,
  sent_at timestamp null,
  delivered_at timestamp null,
  read_at timestamp null,
  failed_at timestamp null,
  unique key campaign_recipients_unique (campaign_id, contact_id),
  index campaign_recipients_provider_message_idx (business_id, provider_message_id),
  index campaign_recipients_status_idx (business_id, status, queued_at),
  constraint campaign_recipients_business_fk foreign key (business_id) references businesses(id),
  constraint campaign_recipients_campaign_fk foreign key (campaign_id) references campaigns(id),
  constraint campaign_recipients_contact_fk foreign key (contact_id) references contacts(id)
);

create table if not exists inbox_conversations (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  contact_id bigint unsigned,
  customer_name varchar(180) not null,
  customer_phone varchar(40) not null,
  status varchar(40) not null default 'open',
  assigned_user_id bigint unsigned,
  last_message_preview varchar(180),
  last_message_at timestamp null,
  unread_count int unsigned not null default 0,
  first_response_due_at timestamp null,
  first_responded_at timestamp null,
  resolved_at timestamp null,
  csat_score tinyint unsigned,
  csat_comment varchar(500),
  csat_requested_at timestamp null,
  csat_received_at timestamp null,
  source varchar(40) not null default 'whatsapp',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key inbox_conversations_business_phone_unique (business_id, customer_phone),
  index inbox_conversations_status_idx (business_id, status, last_message_at),
  index inbox_conversations_assigned_idx (business_id, assigned_user_id, status),
  constraint inbox_conversations_business_fk foreign key (business_id) references businesses(id),
  constraint inbox_conversations_contact_fk foreign key (contact_id) references contacts(id),
  constraint inbox_conversations_assigned_user_fk foreign key (assigned_user_id) references users(id)
);

create table if not exists inbox_notes (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  conversation_id bigint unsigned not null,
  body text not null,
  author_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  index inbox_notes_conversation_idx (business_id, conversation_id, created_at),
  constraint inbox_notes_business_fk foreign key (business_id) references businesses(id),
  constraint inbox_notes_conversation_fk foreign key (conversation_id) references inbox_conversations(id),
  constraint inbox_notes_author_user_fk foreign key (author_user_id) references users(id)
);

create table if not exists inbox_messages (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  conversation_id bigint unsigned not null,
  direction varchar(20) not null,
  channel varchar(40) not null default 'whatsapp',
  provider_message_id varchar(180),
  message_type varchar(40) not null default 'text',
  body text,
  status varchar(40) not null default 'received',
  author_user_id bigint unsigned,
  occurred_at timestamp not null,
  metadata json,
  created_at timestamp default current_timestamp,
  unique key inbox_messages_provider_unique (business_id, provider_message_id),
  index inbox_messages_conversation_idx (business_id, conversation_id, occurred_at),
  constraint inbox_messages_business_fk foreign key (business_id) references businesses(id),
  constraint inbox_messages_conversation_fk foreign key (conversation_id) references inbox_conversations(id),
  constraint inbox_messages_author_user_fk foreign key (author_user_id) references users(id)
);

create table if not exists message_templates (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned,
  name varchar(180) not null,
  slug varchar(180),
  category varchar(80) not null,
  industry varchar(120) default 'general',
  language varchar(20) not null default 'en_ZA',
  status varchar(40) not null default 'Draft',
  body text not null,
  footer varchar(255),
  components_json json,
  variables_json json,
  meta_template_id varchar(180),
  rejection_reason varchar(255),
  submitted_at timestamp null,
  approved_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key message_templates_business_slug_unique (business_id, slug)
);

create table if not exists chatbot_flows (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  industry_id varchar(80) not null default 'custom',
  industry_name varchar(180) not null default 'Custom',
  status varchar(40) not null default 'Draft',
  version int unsigned not null default 1,
  definition_json json not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  published_at timestamp null,
  index chatbot_flows_business_status_idx (business_id, status, updated_at),
  constraint chatbot_flows_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists chatbot_sessions (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  flow_id bigint unsigned not null,
  conversation_id bigint unsigned,
  customer_phone varchar(40) not null,
  status varchar(40) not null default 'active',
  current_node_id varchar(120),
  context_json json,
  last_input varchar(500),
  started_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  completed_at timestamp null,
  index chatbot_sessions_customer_idx (business_id, customer_phone, status, updated_at),
  index chatbot_sessions_flow_idx (business_id, flow_id, updated_at),
  constraint chatbot_sessions_business_fk foreign key (business_id) references businesses(id),
  constraint chatbot_sessions_flow_fk foreign key (flow_id) references chatbot_flows(id),
  constraint chatbot_sessions_conversation_fk foreign key (conversation_id) references inbox_conversations(id)
);

create table if not exists commerce_products (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  sku varchar(120) not null,
  description text,
  price_cents int unsigned not null,
  currency varchar(10) not null default 'ZAR',
  image_url varchar(500),
  inventory_count int unsigned not null default 0,
  status varchar(40) not null default 'active',
  meta_catalog_id varchar(120),
  meta_product_retailer_id varchar(180),
  payment_link_url varchar(500),
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key commerce_products_business_sku_unique (business_id, sku),
  index commerce_products_status_idx (business_id, status, updated_at),
  constraint commerce_products_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists commerce_product_collections (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  description text,
  status varchar(40) not null default 'active',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index commerce_product_collections_status_idx (business_id, status, updated_at),
  constraint commerce_product_collections_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists commerce_product_collection_items (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  collection_id bigint unsigned not null,
  product_id bigint unsigned not null,
  sort_order int unsigned not null default 0,
  created_at timestamp default current_timestamp,
  unique key commerce_product_collection_items_unique (collection_id, product_id),
  index commerce_product_collection_items_business_idx (business_id, collection_id),
  constraint commerce_product_collection_items_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_product_collection_items_collection_fk foreign key (collection_id) references commerce_product_collections(id),
  constraint commerce_product_collection_items_product_fk foreign key (product_id) references commerce_products(id)
);

create table if not exists commerce_coupons (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  code varchar(80) not null,
  name varchar(180) not null,
  discount_type varchar(40) not null,
  discount_value int unsigned not null,
  minimum_order_cents int unsigned not null default 0,
  max_redemptions int unsigned,
  redeemed_count int unsigned not null default 0,
  status varchar(40) not null default 'active',
  starts_at timestamp null,
  ends_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key commerce_coupons_business_code_unique (business_id, code),
  index commerce_coupons_status_idx (business_id, status, ends_at),
  constraint commerce_coupons_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists commerce_orders (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  customer_name varchar(180) not null,
  customer_phone varchar(40) not null,
  status varchar(40) not null default 'new',
  source varchar(80) not null default 'manual',
  currency varchar(10) not null default 'ZAR',
  total_cents int unsigned not null default 0,
  subtotal_cents int unsigned not null default 0,
  discount_cents int unsigned not null default 0,
  discount_code varchar(80),
  payment_provider varchar(80),
  payment_reference varchar(180),
  payment_link_url varchar(500),
  fulfilment_provider varchar(120),
  tracking_number varchar(180),
  tracking_url varchar(500),
  fulfilled_at timestamp null,
  metadata_json json,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index commerce_orders_business_status_idx (business_id, status, created_at),
  index commerce_orders_payment_reference_idx (business_id, payment_reference),
  constraint commerce_orders_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists commerce_coupon_redemptions (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  coupon_id bigint unsigned not null,
  order_id bigint unsigned not null,
  discount_cents int unsigned not null default 0,
  created_at timestamp default current_timestamp,
  unique key commerce_coupon_redemptions_order_unique (business_id, order_id),
  index commerce_coupon_redemptions_coupon_idx (business_id, coupon_id),
  constraint commerce_coupon_redemptions_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_coupon_redemptions_coupon_fk foreign key (coupon_id) references commerce_coupons(id),
  constraint commerce_coupon_redemptions_order_fk foreign key (order_id) references commerce_orders(id)
);

create table if not exists commerce_order_items (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  order_id bigint unsigned not null,
  product_id bigint unsigned,
  product_name varchar(180) not null,
  sku varchar(120),
  quantity int unsigned not null default 1,
  unit_price_cents int unsigned not null default 0,
  currency varchar(10) not null default 'ZAR',
  created_at timestamp default current_timestamp,
  index commerce_order_items_order_idx (business_id, order_id),
  constraint commerce_order_items_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_order_items_order_fk foreign key (order_id) references commerce_orders(id),
  constraint commerce_order_items_product_fk foreign key (product_id) references commerce_products(id)
);

create table if not exists commerce_return_requests (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  order_id bigint unsigned not null,
  reason varchar(240) not null,
  resolution varchar(80) not null default 'refund',
  status varchar(80) not null default 'requested',
  amount_cents int unsigned not null default 0,
  refund_reference varchar(180),
  note varchar(500),
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index commerce_return_requests_status_idx (business_id, status, updated_at),
  index commerce_return_requests_order_idx (business_id, order_id),
  constraint commerce_return_requests_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_return_requests_order_fk foreign key (order_id) references commerce_orders(id)
);

create table if not exists commerce_automation_rules (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  rule_key varchar(120) not null,
  name varchar(180) not null,
  description varchar(500),
  trigger_status varchar(80) not null,
  prompt_type varchar(80) not null,
  delay_value int unsigned not null default 0,
  delay_unit varchar(40) not null default 'hours',
  enabled tinyint(1) not null default 1,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key commerce_automation_rules_business_key_unique (business_id, rule_key),
  index commerce_automation_rules_trigger_idx (business_id, enabled, trigger_status),
  constraint commerce_automation_rules_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists commerce_product_variants (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  product_id bigint unsigned not null,
  name varchar(180) not null,
  sku varchar(120) not null,
  option_name varchar(80),
  option_value varchar(120),
  price_cents int unsigned,
  inventory_count int unsigned not null default 0,
  status varchar(40) not null default 'active',
  meta_product_retailer_id varchar(180),
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key commerce_product_variants_business_sku_unique (business_id, sku),
  index commerce_product_variants_product_idx (business_id, product_id, status),
  constraint commerce_product_variants_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_product_variants_product_fk foreign key (product_id) references commerce_products(id)
);

create table if not exists commerce_order_events (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  order_id bigint unsigned not null,
  event_type varchar(80) not null,
  status varchar(80),
  note varchar(500),
  metadata_json json,
  created_at timestamp default current_timestamp,
  index commerce_order_events_order_idx (business_id, order_id, created_at),
  constraint commerce_order_events_business_fk foreign key (business_id) references businesses(id),
  constraint commerce_order_events_order_fk foreign key (order_id) references commerce_orders(id)
);

create table if not exists webhook_events (
  id bigint unsigned primary key auto_increment,
  provider varchar(80) not null,
  event_type varchar(120),
  payload json not null,
  processed_at timestamp null,
  created_at timestamp default current_timestamp
);

create table if not exists jobs (
  id bigint unsigned primary key auto_increment,
  type varchar(120) not null,
  status varchar(40) not null default 'queued',
  payload json not null,
  result json,
  dedupe_key varchar(180) not null,
  attempts int unsigned not null default 0,
  max_attempts int unsigned not null default 3,
  run_at timestamp not null default current_timestamp,
  last_error varchar(500),
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  completed_at timestamp null,
  failed_at timestamp null,
  unique key jobs_dedupe_key_unique (dedupe_key),
  index jobs_status_run_idx (status, run_at, id),
  index jobs_type_status_idx (type, status)
);

create table if not exists dispatch_rate_limits (
  id bigint unsigned primary key auto_increment,
  scope varchar(40) not null,
  scope_key varchar(120) not null,
  window_start timestamp not null,
  sent_count int unsigned not null default 0,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key dispatch_rate_limits_scope_window_unique (scope, scope_key, window_start)
);

create table if not exists meta_rate_cards (
  id bigint unsigned primary key auto_increment,
  market varchar(40) not null,
  currency varchar(10) not null default 'ZAR',
  category varchar(60) not null,
  pricing_type varchar(80) not null default 'regular',
  volume_tier_from int unsigned not null default 0,
  volume_tier_to int unsigned,
  rate_cents int unsigned not null default 0,
  source varchar(120) not null default 'manual',
  effective_from timestamp not null default current_timestamp,
  is_active tinyint(1) not null default 1,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key meta_rate_cards_unique (market, currency, category, pricing_type, volume_tier_from)
);

create table if not exists message_cost_events (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  provider_message_id varchar(180) not null,
  campaign_recipient_id bigint unsigned,
  campaign_id bigint unsigned,
  market varchar(40) not null,
  category varchar(60) not null,
  pricing_type varchar(80) not null default 'regular',
  billable tinyint(1) not null default 1,
  currency varchar(10) not null default 'ZAR',
  rate_cents int unsigned not null default 0,
  amount_cents int unsigned not null default 0,
  status_event varchar(40) not null,
  source varchar(120) not null,
  raw_pricing json,
  occurred_at timestamp not null,
  created_at timestamp default current_timestamp,
  unique key message_cost_events_provider_unique (business_id, provider_message_id),
  index message_cost_events_business_idx (business_id, occurred_at),
  index message_cost_events_campaign_idx (business_id, campaign_id),
  constraint message_cost_events_business_fk foreign key (business_id) references businesses(id),
  constraint message_cost_events_recipient_fk foreign key (campaign_recipient_id) references campaign_recipients(id),
  constraint message_cost_events_campaign_fk foreign key (campaign_id) references campaigns(id)
);

create table if not exists business_subscriptions (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  plan_code varchar(40) not null,
  provider varchar(80) not null default 'payfast',
  provider_subscription_token varchar(180),
  merchant_payment_id varchar(180) not null,
  status varchar(40) not null default 'pending',
  amount_cents int unsigned not null,
  currency varchar(10) not null default 'ZAR',
  billing_frequency varchar(40) not null default 'monthly',
  next_billing_date date,
  current_period_started_at timestamp null,
  current_period_ends_at timestamp null,
  canceled_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key business_subscriptions_merchant_payment_unique (merchant_payment_id),
  index business_subscriptions_business_status_idx (business_id, status),
  constraint business_subscriptions_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists invoices (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  invoice_number varchar(60) not null,
  provider varchar(80) not null,
  provider_payment_id varchar(180),
  merchant_payment_id varchar(180),
  amount_cents int unsigned not null,
  currency varchar(10) not null default 'ZAR',
  status varchar(40) not null,
  issued_on date not null,
  due_on date,
  paid_at timestamp null,
  metadata json,
  unique key invoices_provider_payment_unique (provider, provider_payment_id),
  index invoices_business_status_idx (business_id, status, issued_on),
  constraint invoices_business_fk foreign key (business_id) references businesses(id)
);

create table if not exists billing_events (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned,
  provider varchar(80) not null,
  provider_payment_id varchar(180),
  merchant_payment_id varchar(180),
  event_type varchar(80),
  status varchar(40) not null,
  reason varchar(255),
  payload json,
  checks json,
  processed_at timestamp null,
  created_at timestamp default current_timestamp,
  index billing_events_business_idx (business_id, provider, created_at),
  index billing_events_merchant_idx (merchant_payment_id),
  constraint billing_events_business_fk foreign key (business_id) references businesses(id)
);
