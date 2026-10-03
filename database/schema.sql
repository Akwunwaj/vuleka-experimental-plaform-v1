create table if not exists businesses (
  id bigint unsigned primary key auto_increment,
  name varchar(180) not null,
  plan varchar(50) not null default 'Starter',
  meta_waba_id varchar(100),
  meta_phone_number_id varchar(100),
  created_at timestamp default current_timestamp
);

alter table businesses add column if not exists platform_status varchar(40) not null default 'active';
alter table businesses add column if not exists platform_status_reason varchar(500);
alter table businesses add column if not exists platform_status_updated_at timestamp null;

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

create table if not exists platform_users (
  id bigint unsigned primary key auto_increment,
  name varchar(180) not null,
  email varchar(180) not null unique,
  password_hash varchar(220) not null,
  role varchar(40) not null default 'operator',
  status varchar(40) not null default 'active',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);

create table if not exists platform_sessions (
  id char(64) primary key,
  platform_user_id bigint unsigned not null,
  user_agent varchar(255),
  ip_address varchar(64),
  expires_at timestamp not null,
  created_at timestamp default current_timestamp,
  constraint platform_sessions_user_fk foreign key (platform_user_id) references platform_users(id),
  index platform_sessions_expires_at_idx (expires_at)
);

create table if not exists platform_audit_logs (
  id bigint unsigned primary key auto_increment,
  platform_user_id bigint unsigned,
  action varchar(120) not null,
  target_type varchar(80),
  target_id varchar(120),
  reason varchar(500),
  metadata json,
  ip_address varchar(64),
  user_agent varchar(255),
  created_at timestamp default current_timestamp,
  index platform_audit_logs_action_idx (action, created_at),
  index platform_audit_logs_target_idx (target_type, target_id, created_at),
  constraint platform_audit_logs_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists platform_tenant_notes (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  platform_user_id bigint unsigned,
  note varchar(1000) not null,
  category varchar(80) not null default 'general',
  created_at timestamp default current_timestamp,
  index platform_tenant_notes_business_idx (business_id, created_at),
  constraint platform_tenant_notes_business_fk foreign key (business_id) references businesses(id),
  constraint platform_tenant_notes_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists public_leads (
  id bigint unsigned primary key auto_increment,
  reference_code varchar(40) not null unique,
  lead_type enum('sales', 'demo') not null,
  status enum('new', 'contacted', 'qualified', 'disqualified', 'converted') not null default 'new',
  priority enum('normal', 'high') not null default 'normal',
  route_key varchar(80) not null default 'sales_general',
  name varchar(180) not null,
  work_email varchar(180) not null,
  phone varchar(40),
  company varchar(180) not null,
  role_title varchar(120),
  team_size varchar(40),
  monthly_conversations varchar(40),
  use_case varchar(80),
  preferred_contact varchar(40) not null default 'email',
  message text not null,
  consent_to_contact tinyint(1) not null default 1,
  marketing_opt_in tinyint(1) not null default 0,
  source_path varchar(300) not null default '/contact',
  attribution json,
  ip_hash char(64),
  user_agent varchar(255),
  duplicate_count int unsigned not null default 0,
  owner_platform_user_id bigint unsigned,
  response_due_at timestamp null,
  next_follow_up_at timestamp null,
  last_activity_at timestamp null,
  first_contacted_at timestamp null,
  converted_at timestamp null,
  disqualification_reason varchar(500),
  crm_delivery_status enum('not_configured', 'pending', 'delivered', 'failed') not null default 'not_configured',
  crm_delivered_at timestamp null,
  retention_expires_at timestamp not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index public_leads_status_idx (status, priority, created_at),
  index public_leads_email_idx (work_email, created_at),
  index public_leads_retention_idx (retention_expires_at),
  constraint public_leads_owner_fk foreign key (owner_platform_user_id) references platform_users(id)
);

alter table public_leads add column if not exists response_due_at timestamp null after owner_platform_user_id;
alter table public_leads add column if not exists next_follow_up_at timestamp null after response_due_at;
alter table public_leads add column if not exists last_activity_at timestamp null after next_follow_up_at;
alter table public_leads add column if not exists disqualification_reason varchar(500) null after converted_at;
alter table public_leads add column if not exists crm_delivery_status enum('not_configured', 'pending', 'delivered', 'failed') not null default 'not_configured' after disqualification_reason;
alter table public_leads add column if not exists crm_delivered_at timestamp null after crm_delivery_status;

create table if not exists public_lead_events (
  id bigint unsigned primary key auto_increment,
  lead_id bigint unsigned not null,
  platform_user_id bigint unsigned,
  event_type varchar(80) not null,
  note varchar(2000) not null,
  metadata json,
  created_at timestamp default current_timestamp,
  index public_lead_events_lead_idx (lead_id, created_at),
  constraint public_lead_events_lead_fk foreign key (lead_id) references public_leads(id) on delete cascade,
  constraint public_lead_events_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists platform_guardrails (
  guardrail_key varchar(80) primary key,
  enabled tinyint(1) not null default 0,
  reason varchar(500),
  updated_by_platform_user_id bigint unsigned,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint platform_guardrails_user_fk foreign key (updated_by_platform_user_id) references platform_users(id)
);

create table if not exists platform_incidents (
  id bigint unsigned primary key auto_increment,
  title varchar(180) not null,
  summary text not null,
  customer_impact text not null,
  severity enum('sev1', 'sev2', 'sev3', 'sev4') not null default 'sev3',
  status enum('open', 'monitoring', 'resolved') not null default 'open',
  linked_guardrail_key varchar(80),
  provider_key varchar(40),
  owner_platform_user_id bigint unsigned,
  resolution_note text,
  started_at timestamp not null default current_timestamp,
  resolved_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index platform_incidents_status_idx (status, severity, started_at),
  index platform_incidents_provider_idx (provider_key, status, started_at),
  constraint platform_incidents_owner_fk foreign key (owner_platform_user_id) references platform_users(id),
  constraint platform_incidents_guardrail_fk foreign key (linked_guardrail_key) references platform_guardrails(guardrail_key)
);

alter table platform_incidents add column if not exists provider_key varchar(40) null after linked_guardrail_key;

create table if not exists platform_incident_events (
  id bigint unsigned primary key auto_increment,
  incident_id bigint unsigned not null,
  platform_user_id bigint unsigned,
  event_type varchar(80) not null default 'note',
  note text not null,
  metadata json,
  created_at timestamp default current_timestamp,
  index platform_incident_events_incident_idx (incident_id, created_at),
  constraint platform_incident_events_incident_fk foreign key (incident_id) references platform_incidents(id) on delete cascade,
  constraint platform_incident_events_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists ai_provider_configs (
  provider_key varchar(40) primary key,
  status enum('disabled', 'configured', 'degraded') not null default 'disabled',
  api_key_encrypted text,
  base_url varchar(500),
  default_model varchar(180),
  timeout_ms int unsigned not null default 30000,
  last_health_status varchar(40),
  last_health_message varchar(500),
  last_checked_at timestamp null,
  updated_by_platform_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint ai_provider_configs_user_fk foreign key (updated_by_platform_user_id) references platform_users(id)
);

create table if not exists crm_provider_config (
  id tinyint unsigned primary key default 1,
  provider_key enum('webhook', 'hubspot') not null default 'webhook',
  hubspot_delivery_mode enum('contacts_only', 'contacts_and_leads') not null default 'contacts_only',
  enabled tinyint(1) not null default 0,
  access_token_encrypted text,
  webhook_url varchar(1000),
  webhook_secret_encrypted text,
  timeout_ms int unsigned not null default 10000,
  last_health_status varchar(40) not null default 'not_checked',
  last_health_message varchar(500),
  last_checked_at timestamp null,
  updated_by_platform_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint crm_provider_config_user_fk foreign key (updated_by_platform_user_id) references platform_users(id)
);

alter table crm_provider_config add column if not exists hubspot_delivery_mode enum('contacts_only', 'contacts_and_leads') not null default 'contacts_only' after provider_key;

create table if not exists business_crm_connections (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  provider enum('hubspot', 'salesforce', 'zoho', 'pipedrive') not null,
  status enum('pending', 'connected', 'paused', 'error', 'disconnected') not null default 'pending',
  credentials_encrypted text,
  credentials_masked json,
  account_external_id varchar(220),
  account_name varchar(220),
  api_base_url varchar(1000),
  granted_scopes json not null,
  field_mapping json not null,
  sync_interval_minutes int unsigned not null default 360,
  next_sync_at timestamp null,
  last_synced_at timestamp null,
  last_health_status varchar(40) not null default 'not_checked',
  last_health_message varchar(500),
  last_checked_at timestamp null,
  consecutive_failures int unsigned not null default 0,
  last_error varchar(500),
  created_by_user_id bigint unsigned,
  updated_by_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key business_crm_provider_unique (business_id, provider),
  index business_crm_status_idx (business_id, status, next_sync_at),
  constraint business_crm_business_fk foreign key (business_id) references businesses(id),
  constraint business_crm_created_user_fk foreign key (created_by_user_id) references users(id),
  constraint business_crm_updated_user_fk foreign key (updated_by_user_id) references users(id)
);

create table if not exists business_crm_oauth_states (
  state_hash char(64) primary key,
  provider enum('hubspot', 'salesforce', 'zoho', 'pipedrive') not null,
  business_id bigint unsigned not null,
  user_id bigint unsigned not null,
  payload json not null,
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp default current_timestamp,
  index business_crm_oauth_expiry_idx (expires_at, used_at),
  constraint business_crm_oauth_business_fk foreign key (business_id) references businesses(id),
  constraint business_crm_oauth_user_fk foreign key (user_id) references users(id)
);

create table if not exists business_crm_sync_runs (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  connection_id bigint unsigned not null,
  job_id bigint unsigned,
  trigger_type enum('initial', 'scheduled', 'manual', 'retry') not null default 'scheduled',
  status enum('running', 'succeeded', 'partial', 'failed', 'skipped') not null default 'running',
  attempted_count int unsigned not null default 0,
  succeeded_count int unsigned not null default 0,
  failed_count int unsigned not null default 0,
  duration_ms int unsigned,
  error_message varchar(500),
  started_at timestamp not null default current_timestamp,
  completed_at timestamp null,
  created_at timestamp default current_timestamp,
  index business_crm_runs_idx (business_id, connection_id, started_at),
  constraint business_crm_runs_business_fk foreign key (business_id) references businesses(id),
  constraint business_crm_runs_connection_fk foreign key (connection_id) references business_crm_connections(id) on delete cascade
);

create table if not exists business_ai_policies (
  business_id bigint unsigned primary key,
  enabled tinyint(1) not null default 0,
  autonomy_mode enum('assist', 'draft', 'auto_reply') not null default 'assist',
  provider_chain json not null,
  monthly_budget_cents int unsigned not null default 0,
  monthly_token_limit int unsigned not null default 0,
  max_response_tokens int unsigned not null default 800,
  human_handoff_enabled tinyint(1) not null default 1,
  updated_by_platform_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint business_ai_policies_business_fk foreign key (business_id) references businesses(id),
  constraint business_ai_policies_user_fk foreign key (updated_by_platform_user_id) references platform_users(id)
);

create table if not exists business_knowledge_sources (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  source_type enum('upload', 'api_push', 'shopify', 'woocommerce', 'google_drive') not null,
  format_type enum('csv', 'text', 'markdown', 'json', 'pdf', 'docx', 'remote') not null,
  name varchar(220) not null,
  status enum('ready', 'syncing', 'error', 'paused') not null default 'ready',
  configuration json not null,
  credentials_encrypted text,
  credentials_masked json,
  sync_interval_minutes int unsigned not null default 360,
  next_sync_at timestamp null,
  consecutive_failures int unsigned not null default 0,
  item_count int unsigned not null default 0,
  last_synced_at timestamp null,
  last_error varchar(500),
  deleted_at timestamp null,
  created_by_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index business_knowledge_sources_idx (business_id, status, updated_at),
  constraint business_knowledge_sources_business_fk foreign key (business_id) references businesses(id),
  constraint business_knowledge_sources_user_fk foreign key (created_by_user_id) references users(id)
);

alter table business_knowledge_sources modify column source_type enum('upload', 'api_push', 'shopify', 'woocommerce', 'google_drive') not null;
alter table business_knowledge_sources modify column format_type enum('csv', 'text', 'markdown', 'json', 'pdf', 'docx', 'remote') not null;
alter table business_knowledge_sources add column if not exists credentials_encrypted text null after configuration;
alter table business_knowledge_sources add column if not exists credentials_masked json null after credentials_encrypted;
alter table business_knowledge_sources add column if not exists sync_interval_minutes int unsigned not null default 360 after credentials_masked;
alter table business_knowledge_sources add column if not exists next_sync_at timestamp null after sync_interval_minutes;
alter table business_knowledge_sources add column if not exists consecutive_failures int unsigned not null default 0 after next_sync_at;
alter table business_knowledge_sources add column if not exists deleted_at timestamp null after last_error;

create table if not exists knowledge_connector_oauth_states (
  state_hash char(64) primary key,
  provider varchar(40) not null,
  business_id bigint unsigned not null,
  user_id bigint unsigned not null,
  payload json not null,
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp default current_timestamp,
  index knowledge_connector_oauth_expiry_idx (expires_at, used_at),
  constraint knowledge_connector_oauth_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_connector_oauth_user_fk foreign key (user_id) references users(id)
);

create table if not exists knowledge_connector_sync_runs (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  source_id bigint unsigned not null,
  job_id bigint unsigned,
  provider varchar(40) not null,
  trigger_type enum('initial', 'scheduled', 'manual', 'oauth') not null default 'scheduled',
  status enum('running', 'succeeded', 'failed', 'skipped') not null default 'running',
  attempt int unsigned not null default 1,
  max_attempts int unsigned not null default 1,
  fetched_count int unsigned not null default 0,
  created_count int unsigned not null default 0,
  updated_count int unsigned not null default 0,
  skipped_count int unsigned not null default 0,
  duration_ms int unsigned,
  error_message varchar(500),
  scheduled_for timestamp null,
  started_at timestamp not null default current_timestamp,
  completed_at timestamp null,
  created_at timestamp default current_timestamp,
  index knowledge_connector_runs_source_idx (business_id, source_id, started_at),
  index knowledge_connector_runs_status_idx (business_id, status, started_at),
  constraint knowledge_connector_runs_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_connector_runs_source_fk foreign key (source_id) references business_knowledge_sources(id)
);

create table if not exists knowledge_connector_alert_policies (
  business_id bigint unsigned primary key,
  email_enabled tinyint(1) not null default 1,
  minimum_email_severity enum('info', 'warning', 'critical') not null default 'warning',
  notify_roles json not null,
  additional_emails json not null,
  escalation_minutes int unsigned not null default 60,
  updated_by_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint knowledge_connector_alert_policy_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_connector_alert_policy_user_fk foreign key (updated_by_user_id) references users(id)
);

create table if not exists knowledge_connector_alerts (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  source_id bigint unsigned not null,
  alert_key varchar(80) not null,
  severity enum('info', 'warning', 'critical') not null,
  status enum('open', 'acknowledged', 'resolved') not null default 'open',
  title varchar(220) not null,
  detail varchar(1000) not null,
  first_detected_at timestamp not null default current_timestamp,
  last_detected_at timestamp not null default current_timestamp,
  acknowledged_by_user_id bigint unsigned,
  acknowledged_at timestamp null,
  resolved_at timestamp null,
  escalation_at timestamp null,
  escalated_at timestamp null,
  last_notified_at timestamp null,
  notification_count int unsigned not null default 0,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key knowledge_connector_alert_unique (business_id, source_id, alert_key),
  index knowledge_connector_alert_status_idx (business_id, status, severity, last_detected_at),
  constraint knowledge_connector_alert_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_connector_alert_source_fk foreign key (source_id) references business_knowledge_sources(id),
  constraint knowledge_connector_alert_user_fk foreign key (acknowledged_by_user_id) references users(id)
);

create table if not exists knowledge_connector_alert_events (
  id bigint unsigned primary key auto_increment,
  alert_id bigint unsigned not null,
  event_type enum('opened', 'updated', 'notified', 'delivery_failed', 'acknowledged', 'escalated', 'resolved') not null,
  channel varchar(40),
  recipient varchar(220),
  detail varchar(1000),
  actor_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  index knowledge_connector_alert_events_idx (alert_id, created_at),
  constraint knowledge_connector_alert_events_alert_fk foreign key (alert_id) references knowledge_connector_alerts(id) on delete cascade,
  constraint knowledge_connector_alert_events_user_fk foreign key (actor_user_id) references users(id)
);

create table if not exists business_knowledge_items (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  item_type enum('faq', 'policy', 'instruction') not null,
  title varchar(220) not null,
  content text not null,
  keywords json not null,
  status enum('draft', 'approved', 'archived') not null default 'draft',
  version int unsigned not null default 1,
  source_id bigint unsigned,
  external_ref varchar(220),
  content_hash char(64),
  created_by_user_id bigint unsigned,
  approved_by_user_id bigint unsigned,
  approved_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index business_knowledge_status_idx (business_id, status, updated_at),
  index business_knowledge_type_idx (business_id, item_type, status),
  constraint business_knowledge_business_fk foreign key (business_id) references businesses(id),
  constraint business_knowledge_created_user_fk foreign key (created_by_user_id) references users(id),
  constraint business_knowledge_approved_user_fk foreign key (approved_by_user_id) references users(id),
  constraint business_knowledge_source_fk foreign key (source_id) references business_knowledge_sources(id)
);

create table if not exists knowledge_evaluation_cases (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  name varchar(180) not null,
  query_text text not null,
  customer_phone varchar(30),
  expected_source_refs json not null,
  required_terms json not null,
  forbidden_source_refs json not null,
  candidate_answer text,
  status enum('active', 'archived') not null default 'active',
  created_by_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index knowledge_eval_cases_idx (business_id, status, updated_at),
  constraint knowledge_eval_cases_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_eval_cases_user_fk foreign key (created_by_user_id) references users(id)
);

alter table business_knowledge_items add column if not exists source_id bigint unsigned null after version;
alter table business_knowledge_items add column if not exists external_ref varchar(220) null after source_id;
alter table business_knowledge_items add column if not exists content_hash char(64) null after external_ref;

create table if not exists knowledge_evaluation_runs (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  case_count int unsigned not null default 0,
  citation_precision decimal(6,5) not null default 0,
  source_recall decimal(6,5) not null default 0,
  completeness decimal(6,5) not null default 0,
  isolation_pass_rate decimal(6,5) not null default 0,
  unsupported_claim_risk decimal(6,5) not null default 0,
  results json not null,
  created_by_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  index knowledge_eval_runs_idx (business_id, created_at),
  constraint knowledge_eval_runs_business_fk foreign key (business_id) references businesses(id),
  constraint knowledge_eval_runs_user_fk foreign key (created_by_user_id) references users(id)
);

create table if not exists ai_usage_events (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  provider_key varchar(40) not null,
  model varchar(180) not null,
  workflow_key varchar(100),
  status enum('succeeded', 'failed', 'blocked') not null,
  input_tokens int unsigned not null default 0,
  output_tokens int unsigned not null default 0,
  estimated_cost_cents int unsigned not null default 0,
  latency_ms int unsigned not null default 0,
  provider_request_id varchar(180),
  error_code varchar(100),
  created_at timestamp default current_timestamp,
  index ai_usage_events_business_idx (business_id, created_at),
  index ai_usage_events_provider_idx (provider_key, status, created_at),
  constraint ai_usage_events_business_fk foreign key (business_id) references businesses(id)
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

create table if not exists social_data_deletion_requests (
  id bigint unsigned primary key auto_increment,
  confirmation_code varchar(40) not null unique,
  provider varchar(40) not null,
  provider_user_id_hash char(64) not null,
  user_id bigint unsigned,
  status varchar(40) not null default 'completed',
  completed_at timestamp null,
  created_at timestamp default current_timestamp,
  index social_data_deletion_provider_idx (provider, provider_user_id_hash),
  index social_data_deletion_status_idx (status, created_at)
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
  deleted_at timestamp null,
  deleted_by_user_id bigint unsigned null,
  last_seen varchar(80) default 'New',
  created_at timestamp default current_timestamp,
  unique key contacts_business_phone_unique (business_id, phone),
  constraint contacts_business_fk foreign key (business_id) references businesses(id)
);

alter table contacts add column if not exists deleted_at timestamp null after opted_out_at;
alter table contacts add column if not exists deleted_by_user_id bigint unsigned null after deleted_at;

create table if not exists business_crm_record_links (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  connection_id bigint unsigned not null,
  contact_id bigint unsigned not null,
  external_object_type varchar(80) not null default 'contact',
  external_id varchar(220),
  payload_hash char(64),
  status enum('pending', 'synced', 'failed') not null default 'pending',
  last_error varchar(500),
  last_synced_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  unique key business_crm_record_unique (connection_id, contact_id),
  index business_crm_record_status_idx (business_id, connection_id, status),
  constraint business_crm_record_business_fk foreign key (business_id) references businesses(id),
  constraint business_crm_record_connection_fk foreign key (connection_id) references business_crm_connections(id) on delete cascade,
  constraint business_crm_record_contact_fk foreign key (contact_id) references contacts(id) on delete cascade
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

create table if not exists inbox_ai_drafts (
  id bigint unsigned primary key auto_increment,
  business_id bigint unsigned not null,
  conversation_id bigint unsigned not null,
  generated_by_user_id bigint unsigned,
  provider_key varchar(40) not null,
  model varchar(180) not null,
  autonomy_mode varchar(40) not null,
  status enum('generated', 'used', 'discarded', 'blocked', 'expired') not null default 'generated',
  body text not null,
  confidence decimal(4,3) not null,
  safety_flags json not null,
  context_message_count smallint unsigned not null default 0,
  requires_handoff tinyint(1) not null default 0,
  knowledge_refs json not null,
  knowledge_source_count smallint unsigned not null default 0,
  was_edited tinyint(1),
  used_by_user_id bigint unsigned,
  used_at timestamp null,
  expires_at timestamp not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index inbox_ai_drafts_conversation_idx (business_id, conversation_id, created_at),
  index inbox_ai_drafts_status_idx (business_id, status, created_at),
  constraint inbox_ai_drafts_business_fk foreign key (business_id) references businesses(id),
  constraint inbox_ai_drafts_conversation_fk foreign key (conversation_id) references inbox_conversations(id),
  constraint inbox_ai_drafts_generated_user_fk foreign key (generated_by_user_id) references users(id),
  constraint inbox_ai_drafts_used_user_fk foreign key (used_by_user_id) references users(id)
);

alter table inbox_ai_drafts add column if not exists knowledge_refs json null after requires_handoff;
alter table inbox_ai_drafts add column if not exists knowledge_source_count smallint unsigned not null default 0 after knowledge_refs;

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
  retry_of_job_id bigint unsigned null,
  unique key jobs_dedupe_key_unique (dedupe_key),
  index jobs_status_run_idx (status, run_at, id),
  index jobs_type_status_idx (type, status),
  index jobs_retry_of_idx (retry_of_job_id),
  constraint jobs_retry_of_fk foreign key (retry_of_job_id) references jobs(id)
);

alter table jobs add column if not exists retry_of_job_id bigint unsigned null after failed_at;

create table if not exists worker_heartbeats (
  worker_id varchar(180) primary key,
  role varchar(80) not null default 'job-worker',
  status enum('starting', 'idle', 'working', 'stopping', 'error') not null default 'starting',
  process_id int unsigned,
  version varchar(80),
  current_job_id bigint unsigned,
  jobs_processed bigint unsigned not null default 0,
  last_error varchar(500),
  started_at timestamp not null default current_timestamp,
  last_job_at timestamp null,
  last_seen_at timestamp not null default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index worker_heartbeats_seen_idx (last_seen_at, status),
  constraint worker_heartbeats_job_fk foreign key (current_job_id) references jobs(id)
);

create table if not exists job_recovery_events (
  id bigint unsigned primary key auto_increment,
  original_job_id bigint unsigned not null,
  recovery_job_id bigint unsigned not null,
  platform_user_id bigint unsigned,
  reason varchar(500) not null,
  created_at timestamp default current_timestamp,
  index job_recovery_original_idx (original_job_id, created_at),
  index job_recovery_recovery_idx (recovery_job_id),
  constraint job_recovery_original_fk foreign key (original_job_id) references jobs(id),
  constraint job_recovery_job_fk foreign key (recovery_job_id) references jobs(id),
  constraint job_recovery_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists job_dead_letter_resolutions (
  id bigint unsigned primary key auto_increment,
  job_id bigint unsigned not null,
  action varchar(40) not null default 'discarded',
  platform_user_id bigint unsigned,
  reason varchar(500) not null,
  created_at timestamp default current_timestamp,
  unique key job_dead_letter_resolution_job_unique (job_id),
  index job_dead_letter_resolution_created_idx (created_at),
  constraint job_dead_letter_resolution_job_fk foreign key (job_id) references jobs(id),
  constraint job_dead_letter_resolution_user_fk foreign key (platform_user_id) references platform_users(id)
);

create table if not exists platform_reliability_alert_policies (
  id tinyint unsigned primary key default 1,
  email_enabled tinyint(1) not null default 1,
  in_app_enabled tinyint(1) not null default 1,
  minimum_email_severity enum('info', 'warning', 'critical') not null default 'warning',
  notify_roles json not null,
  additional_emails json not null,
  on_call_platform_user_id bigint unsigned,
  escalation_minutes int unsigned not null default 30,
  repeat_minutes int unsigned not null default 60,
  updated_by_platform_user_id bigint unsigned,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint platform_reliability_policy_on_call_fk foreign key (on_call_platform_user_id) references platform_users(id),
  constraint platform_reliability_policy_user_fk foreign key (updated_by_platform_user_id) references platform_users(id)
);

create table if not exists platform_reliability_alerts (
  id bigint unsigned primary key auto_increment,
  alert_key varchar(220) not null unique,
  signal_type varchar(80) not null,
  target_key varchar(180) not null,
  severity enum('info', 'warning', 'critical') not null,
  status enum('open', 'acknowledged', 'resolved') not null default 'open',
  title varchar(220) not null,
  detail varchar(1000) not null,
  snapshot json not null,
  owner_platform_user_id bigint unsigned,
  acknowledged_by_platform_user_id bigint unsigned,
  acknowledged_at timestamp null,
  incident_id bigint unsigned,
  escalation_at timestamp null,
  escalated_at timestamp null,
  last_notified_at timestamp null,
  notification_count int unsigned not null default 0,
  first_detected_at timestamp not null default current_timestamp,
  last_detected_at timestamp not null default current_timestamp,
  resolved_at timestamp null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index platform_reliability_alert_status_idx (status, severity, last_detected_at),
  index platform_reliability_alert_owner_idx (owner_platform_user_id, status),
  constraint platform_reliability_alert_owner_fk foreign key (owner_platform_user_id) references platform_users(id),
  constraint platform_reliability_alert_ack_fk foreign key (acknowledged_by_platform_user_id) references platform_users(id),
  constraint platform_reliability_alert_incident_fk foreign key (incident_id) references platform_incidents(id)
);

create table if not exists platform_reliability_alert_events (
  id bigint unsigned primary key auto_increment,
  alert_id bigint unsigned not null,
  event_type enum('opened', 'updated', 'notified', 'delivery_failed', 'acknowledged', 'assigned', 'escalated', 'incident_linked', 'resolved') not null,
  channel varchar(40),
  recipient varchar(220),
  detail varchar(1000),
  platform_user_id bigint unsigned,
  metadata json,
  created_at timestamp default current_timestamp,
  index platform_reliability_alert_events_idx (alert_id, created_at),
  constraint platform_reliability_alert_event_alert_fk foreign key (alert_id) references platform_reliability_alerts(id) on delete cascade,
  constraint platform_reliability_alert_event_user_fk foreign key (platform_user_id) references platform_users(id)
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
