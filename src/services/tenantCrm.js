const crypto = require('node:crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const { decryptSecret, encryptSecret, maskSecret } = require('./encryption');
const { cancelJobsByDedupePrefix, enqueueJob, getJob } = require('./jobQueue');

const PROVIDERS = ['hubspot', 'salesforce', 'zoho', 'pipedrive'];
const STATE_TTL_MS = 10 * 60_000;
const PROVIDER_MAPPINGS = {
  hubspot:{ name:'firstname', email:'email', phone:'phone', segment:'', optedIn:'' },
  salesforce:{ name:'LastName', email:'Email', phone:'Phone', segment:'', optedIn:'' },
  zoho:{ name:'Last_Name', email:'Email', phone:'Phone', segment:'', optedIn:'' },
  pipedrive:{ name:'name', email:'emails', phone:'phones', segment:'', optedIn:'' }
};
const demo = { connections:[], states:new Map(), runs:[], links:[] };

const providerDefinitions = {
  hubspot:{ name:'HubSpot', authorizeUrl:'https://app.hubspot.com/oauth/authorize', tokenUrl:'https://api.hubapi.com/oauth/v3/token', scopes:['crm.objects.contacts.read','crm.objects.contacts.write'] },
  salesforce:{ name:'Salesforce', authorizeUrl:'https://login.salesforce.com/services/oauth2/authorize', tokenUrl:'https://login.salesforce.com/services/oauth2/token', scopes:['api','refresh_token'] },
  zoho:{ name:'Zoho CRM', authorizeUrl:'https://accounts.zoho.com/oauth/v2/auth', tokenUrl:'https://accounts.zoho.com/oauth/v2/token', scopes:['ZohoCRM.modules.contacts.READ','ZohoCRM.modules.contacts.CREATE','ZohoCRM.modules.contacts.UPDATE'] },
  pipedrive:{ name:'Pipedrive', authorizeUrl:'https://oauth.pipedrive.com/oauth/authorize', tokenUrl:'https://oauth.pipedrive.com/oauth/token', scopes:[] }
};

function getTenantCrmProviderStatus() {
  return PROVIDERS.map((provider) => {
    const config = oauthConfig(provider, false);
    return { provider, name:providerDefinitions[provider].name, configured:Boolean(config), redirectUri:config?.redirectUri || expectedRedirectUri(provider), scopes:providerDefinitions[provider].scopes, defaultMapping:PROVIDER_MAPPINGS[provider] };
  });
}

async function listTenantCrmConnections(businessId) {
  const rows = hasDatabaseConfig() ? await query(`select id,business_id as businessId,provider,status,credentials_masked as credentialsMasked,account_external_id as accountExternalId,account_name as accountName,api_base_url as apiBaseUrl,granted_scopes as grantedScopes,field_mapping as fieldMapping,sync_interval_minutes as syncIntervalMinutes,next_sync_at as nextSyncAt,last_synced_at as lastSyncedAt,last_health_status as lastHealthStatus,last_health_message as lastHealthMessage,last_checked_at as lastCheckedAt,consecutive_failures as consecutiveFailures,last_error as lastError,created_at as createdAt,updated_at as updatedAt from business_crm_connections where business_id=:businessId order by provider`, { businessId }) : demo.connections.filter((item) => Number(item.businessId) === Number(businessId));
  return rows.map(publicConnection);
}

async function getTenantCrmOperations(businessId) {
  const connections = await listTenantCrmConnections(businessId);
  const runs = hasDatabaseConfig() ? await query(`select r.id,r.connection_id as connectionId,c.provider,r.trigger_type as triggerType,r.status,r.attempted_count as attemptedCount,r.succeeded_count as succeededCount,r.failed_count as failedCount,r.duration_ms as durationMs,r.error_message as errorMessage,r.started_at as startedAt,r.completed_at as completedAt from business_crm_sync_runs r join business_crm_connections c on c.id=r.connection_id where r.business_id=:businessId order by r.started_at desc limit 50`, { businessId }) : demo.runs.filter((item) => Number(item.businessId) === Number(businessId)).slice(-50).reverse();
  return { providers:getTenantCrmProviderStatus(), connections, runs, summary:{ connected:connections.filter((item)=>item.status==='connected').length, attention:connections.filter((item)=>item.status==='error').length, synced24h:runs.filter((item)=>item.status==='succeeded'&&Date.now()-new Date(item.completedAt).getTime()<86400000).length, failed24h:runs.filter((item)=>item.status==='failed'&&Date.now()-new Date(item.completedAt).getTime()<86400000).length } };
}

async function beginTenantCrmOAuth(input) {
  const provider = normalizeProvider(input.provider);
  const config = oauthConfig(provider, true);
  const state = crypto.randomBytes(32).toString('base64url');
  const stateHash = hash(state);
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  const payload = { fieldMapping:validateFieldMapping(input.fieldMapping, provider), syncIntervalMinutes:normalizeInterval(input.syncIntervalMinutes) };
  if (hasDatabaseConfig()) await query(`insert into business_crm_oauth_states (state_hash,provider,business_id,user_id,payload,expires_at) values (:stateHash,:provider,:businessId,:userId,:payload,:expiresAt)`, { stateHash, provider, businessId:input.businessId, userId:input.actorUser.id, payload:JSON.stringify(payload), expiresAt });
  else demo.states.set(stateHash, { stateHash, provider, businessId:Number(input.businessId), userId:Number(input.actorUser.id), payload, expiresAt, usedAt:null });
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (config.scopes.length) url.searchParams.set('scope', provider === 'zoho' ? config.scopes.join(',') : config.scopes.join(' '));
  if (provider === 'zoho') { url.searchParams.set('access_type','offline'); url.searchParams.set('prompt','consent'); }
  if (provider === 'salesforce') url.searchParams.set('prompt','consent');
  return { provider, authorizationUrl:url.toString(), expiresAt:expiresAt.toISOString() };
}

async function completeTenantCrmOAuth(input, fetchImpl = global.fetch) {
  const provider = normalizeProvider(input.provider);
  if (input.error) throw httpError(`${providerDefinitions[provider].name} authorization was not completed: ${String(input.error).slice(0,120)}`, 400);
  if (!input.code || !input.state) throw httpError('CRM OAuth callback requires code and state', 400);
  const stored = await consumeState({ state:input.state, provider, businessId:input.businessId, userId:input.actorUser.id });
  const config = oauthConfig(provider, true);
  const token = await exchangeCode(provider, config, input.code, fetchImpl);
  const credentials = normalizeToken(provider, token);
  const connection = await saveConnection({ businessId:input.businessId, actorUser:input.actorUser, provider, credentials, payload:stored.payload });
  const job = await requestTenantCrmSync({ businessId:input.businessId, connectionId:connection.id, triggerType:'initial' });
  return { connection, job };
}

async function updateTenantCrmConnection(input) {
  const connection = await findConnection(input.businessId, input.connectionId, true);
  if (!connection) throw httpError('CRM connection not found', 404);
  const status = input.status === undefined ? connection.status : String(input.status);
  if (!['connected','paused'].includes(status)) throw httpError('CRM connection status must be connected or paused', 400);
  const mapping = input.fieldMapping ? validateFieldMapping(input.fieldMapping, connection.provider) : parseJson(connection.fieldMapping, PROVIDER_MAPPINGS[connection.provider]);
  const interval = input.syncIntervalMinutes === undefined ? connection.syncIntervalMinutes : normalizeInterval(input.syncIntervalMinutes);
  const nextSyncAt=status==='paused'?null:new Date(Date.now()+interval*60000);
  if (hasDatabaseConfig()) await query(`update business_crm_connections set status=:status,field_mapping=:mapping,sync_interval_minutes=:interval,next_sync_at=:nextSyncAt,updated_by_user_id=:userId where id=:id and business_id=:businessId`, { id:connection.id, businessId:input.businessId, status, mapping:JSON.stringify(mapping), interval, nextSyncAt, userId:input.actorUser.id });
  else Object.assign(connection, { status, fieldMapping:mapping, syncIntervalMinutes:interval, nextSyncAt:nextSyncAt?.toISOString()||null, updatedAt:new Date().toISOString() });
  await cancelJobsByDedupePrefix(scheduledDedupePrefix(connection.id));
  if(status==='connected')await enqueueNextSync({...connection,syncIntervalMinutes:interval},nextSyncAt);
  return publicConnection(await findConnection(input.businessId, connection.id));
}

async function testTenantCrmConnection(input, dependencies = {}) {
  const connection = await findConnection(input.businessId, input.connectionId, true);
  if (!connection) throw httpError('CRM connection not found', 404);
  const started = Date.now();
  try {
    const runtime = await ensureAccessToken(connection, dependencies.fetchImpl || global.fetch);
    await providerHealthRequest(runtime, dependencies.fetchImpl || global.fetch);
    await saveConnectionHealth(connection, 'healthy', `${providerDefinitions[connection.provider].name} contact access verified.`);
    return { status:'healthy', message:`${providerDefinitions[connection.provider].name} contact access verified.`, latencyMs:Date.now()-started };
  } catch (error) {
    await saveConnectionHealth(connection, 'failed', String(error.message || error));
    return { status:'failed', message:String(error.message || error).slice(0,500), latencyMs:Date.now()-started };
  }
}

async function requestTenantCrmSync(input) {
  const connection = await findConnection(input.businessId, input.connectionId);
  if (!connection) throw httpError('CRM connection not found', 404);
  if (connection.status === 'paused') throw httpError('Resume this CRM connection before syncing', 409);
  const scheduled=input.triggerType==='scheduled';
  return enqueueJob({ type:'tenant.crm.sync', payload:{ businessId:Number(input.businessId), connectionId:Number(connection.id), triggerType:input.triggerType || 'manual' }, maxAttempts:4, dedupeKey:scheduled?`${scheduledDedupePrefix(connection.id)}${input.scheduledFor||Date.now()}`:`tenant-crm-manual:${connection.id}:${Date.now()}` });
}

async function getTenantCrmJobStatus(businessId, jobId) {
  const job = await getJob(jobId);
  if (!job || job.type !== 'tenant.crm.sync' || Number(job.payload?.businessId) !== Number(businessId)) {
    throw httpError('CRM sync job not found', 404);
  }
  const status = crmJobStatus(job);
  return {
    id:job.id,
    connectionId:job.payload.connectionId,
    status,
    label:status.replace(/^./, (letter) => letter.toUpperCase()),
    attempts:Number(job.attempts || 0),
    maxAttempts:Number(job.maxAttempts || 0),
    lastError:job.lastError || null,
    result:job.result || null,
    createdAt:job.createdAt,
    updatedAt:job.updatedAt,
    completedAt:job.completedAt || null
  };
}

function crmJobStatus(job) {
  if (job.status === 'queued') return 'queued';
  if (job.status === 'running') return 'processing';
  if (job.status === 'completed') return job.result?.status === 'partial' ? 'failed' : 'succeeded';
  return 'failed';
}

async function syncTenantCrmConnection(input, dependencies = {}) {
  const connection = await findConnection(input.businessId, input.connectionId, true);
  if (!connection || connection.status === 'disconnected') return { skipped:true, reason:'connection_missing' };
  if (connection.status === 'paused') return { skipped:true, reason:'connection_paused' };
  const run = await beginRun(connection, input);
  const fetchImpl = dependencies.fetchImpl || global.fetch;
  try {
    const runtime = await ensureAccessToken(connection, fetchImpl);
    const contacts = await listContacts(connection.businessId);
    let succeeded = 0; let failed = 0; let retryableFailures = 0;
    for (const contact of contacts.slice(0, 250)) {
      try { await syncContact(runtime, contact, connection, fetchImpl); succeeded += 1; }
      catch (error) { failed += 1; if (error.retryable) retryableFailures += 1; await saveRecordLink(connection, contact, null, 'failed', error.message); }
    }
    const status = failed ? (succeeded ? 'partial' : 'failed') : 'succeeded';
    if (status === 'failed') {
      const error = retryableFailures
        ? retryableError(`${providerDefinitions[connection.provider].name} contact sync failed for every contact`)
        : httpError(`${providerDefinitions[connection.provider].name} contact sync rejected every contact`, 422);
      throw Object.assign(error, { syncCounts:{ attempted:contacts.length, succeeded, failed } });
    }
    await completeRun(run, { status, attemptedCount:contacts.length, succeededCount:succeeded, failedCount:failed, errorMessage:failed?`${failed} contact(s) failed to sync`:null });
    const nextSyncAt = await updateConnectionAfterSync(connection, status, failed?`${failed} contact(s) failed to sync`:null);
    await enqueueNextSync(connection, nextSyncAt);
    return { provider:connection.provider, status, attempted:contacts.length, succeeded, failed };
  } catch (error) {
    const counts = error.syncCounts || {};
    await completeRun(run, { status:'failed', attemptedCount:counts.attempted, succeededCount:counts.succeeded, failedCount:counts.failed, errorMessage:error.message });
    const nextSyncAt = await updateConnectionAfterSync(connection, 'failed', error.message);
    await enqueueNextSync(connection, nextSyncAt).catch(() => null);
    throw error;
  }
}

async function disconnectTenantCrm(input, fetchImpl = global.fetch) {
  const connection = await findConnection(input.businessId, input.connectionId, true);
  if (!connection) throw httpError('CRM connection not found', 404);
  const credentials = decryptCredentials(connection.credentialsEncrypted);
  await revokeToken(connection.provider, credentials, fetchImpl).catch(() => null);
  await cancelJobsByDedupePrefix(scheduledDedupePrefix(connection.id));
  if (hasDatabaseConfig()) await query(`update business_crm_connections set status='disconnected',credentials_encrypted=null,credentials_masked=null,next_sync_at=null,updated_by_user_id=:userId where id=:id and business_id=:businessId`, { id:connection.id, businessId:input.businessId, userId:input.actorUser.id });
  else Object.assign(connection, { status:'disconnected', credentialsEncrypted:null, credentialsMasked:null, nextSyncAt:null });
  return { disconnected:true };
}

async function saveConnection(input) {
  const masked = maskCredentials(input.credentials);
  const encrypted = encryptSecret(JSON.stringify(input.credentials));
  const scopes = input.credentials.scopes || providerDefinitions[input.provider].scopes;
  const mapping = input.payload.fieldMapping;
  if (hasDatabaseConfig()) {
    await query(`insert into business_crm_connections (business_id,provider,status,credentials_encrypted,credentials_masked,account_external_id,account_name,api_base_url,granted_scopes,field_mapping,sync_interval_minutes,next_sync_at,created_by_user_id,updated_by_user_id) values (:businessId,:provider,'connected',:encrypted,:masked,:accountExternalId,:accountName,:apiBaseUrl,:scopes,:mapping,:interval,current_timestamp,:userId,:userId) on duplicate key update status='connected',credentials_encrypted=values(credentials_encrypted),credentials_masked=values(credentials_masked),account_external_id=values(account_external_id),account_name=values(account_name),api_base_url=values(api_base_url),granted_scopes=values(granted_scopes),field_mapping=values(field_mapping),sync_interval_minutes=values(sync_interval_minutes),next_sync_at=current_timestamp,last_error=null,updated_by_user_id=values(updated_by_user_id)`, { businessId:input.businessId, provider:input.provider, encrypted, masked:JSON.stringify(masked), accountExternalId:input.credentials.accountId || null, accountName:input.credentials.accountName || null, apiBaseUrl:input.credentials.apiBaseUrl || null, scopes:JSON.stringify(scopes), mapping:JSON.stringify(mapping), interval:input.payload.syncIntervalMinutes, userId:input.actorUser.id });
    return publicConnection((await query(`select id,business_id as businessId,provider,status,credentials_masked as credentialsMasked,account_external_id as accountExternalId,account_name as accountName,api_base_url as apiBaseUrl,granted_scopes as grantedScopes,field_mapping as fieldMapping,sync_interval_minutes as syncIntervalMinutes,next_sync_at as nextSyncAt,last_synced_at as lastSyncedAt,last_health_status as lastHealthStatus,last_health_message as lastHealthMessage,last_checked_at as lastCheckedAt,consecutive_failures as consecutiveFailures,last_error as lastError from business_crm_connections where business_id=:businessId and provider=:provider limit 1`, { businessId:input.businessId, provider:input.provider }))[0]);
  }
  let connection = demo.connections.find((item)=>Number(item.businessId)===Number(input.businessId)&&item.provider===input.provider);
  const values = { id:connection?.id || Date.now(), businessId:Number(input.businessId), provider:input.provider, status:'connected', credentialsEncrypted:encrypted, credentialsMasked:masked, apiBaseUrl:input.credentials.apiBaseUrl, grantedScopes:scopes, fieldMapping:mapping, syncIntervalMinutes:input.payload.syncIntervalMinutes, nextSyncAt:new Date().toISOString(), consecutiveFailures:0 };
  if (connection) Object.assign(connection, values); else { connection=values; demo.connections.push(connection); }
  return publicConnection(connection);
}

async function findConnection(businessId, id, includeCredentials = false) {
  let row;
  if (hasDatabaseConfig()) row=(await query(`select id,business_id as businessId,provider,status,credentials_encrypted as credentialsEncrypted,credentials_masked as credentialsMasked,account_external_id as accountExternalId,account_name as accountName,api_base_url as apiBaseUrl,granted_scopes as grantedScopes,field_mapping as fieldMapping,sync_interval_minutes as syncIntervalMinutes,next_sync_at as nextSyncAt,last_synced_at as lastSyncedAt,last_health_status as lastHealthStatus,last_health_message as lastHealthMessage,last_checked_at as lastCheckedAt,consecutive_failures as consecutiveFailures,last_error as lastError from business_crm_connections where id=:id and business_id=:businessId limit 1`, { id, businessId }))[0];
  else row=demo.connections.find((item)=>Number(item.id)===Number(id)&&Number(item.businessId)===Number(businessId));
  if (!row) return null;
  return includeCredentials ? { ...row, credentials:decryptCredentials(row.credentialsEncrypted) } : row;
}

async function consumeState(input) {
  const stateHash=hash(input.state); let stored;
  if (hasDatabaseConfig()) stored=(await query(`select state_hash as stateHash,provider,business_id as businessId,user_id as userId,payload,expires_at as expiresAt,used_at as usedAt from business_crm_oauth_states where state_hash=:stateHash and provider=:provider limit 1`, { stateHash, provider:input.provider }))[0];
  else stored=demo.states.get(stateHash);
  if (!stored||stored.usedAt||new Date(stored.expiresAt)<=new Date()) throw httpError('CRM OAuth state is invalid, expired, or already used',400);
  if (Number(stored.businessId)!==Number(input.businessId)||Number(stored.userId)!==Number(input.userId)) throw httpError('CRM OAuth state does not belong to this workspace session',403);
  if (hasDatabaseConfig()) { const result=await query(`update business_crm_oauth_states set used_at=current_timestamp where state_hash=:stateHash and used_at is null and expires_at>current_timestamp`,{stateHash}); if(!result.affectedRows)throw httpError('CRM OAuth state is invalid, expired, or already used',400); }
  else stored.usedAt=new Date();
  return { ...stored, payload:parseJson(stored.payload,{}) };
}

async function exchangeCode(provider, config, code, fetchImpl) {
  const values={ grant_type:'authorization_code', code:String(code), redirect_uri:config.redirectUri };
  const headers={ 'Content-Type':'application/x-www-form-urlencoded' };
  if (provider==='pipedrive') headers.Authorization=`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
  else Object.assign(values,{client_id:config.clientId,client_secret:config.clientSecret});
  let response;
  try { response=await fetchImpl(config.tokenUrl,{method:'POST',headers,body:new URLSearchParams(values).toString()}); }
  catch { throw httpError(`${providerDefinitions[provider].name} token exchange could not reach ${new URL(config.tokenUrl).hostname}. Verify outbound HTTPS access and try connecting again.`,502); }
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw httpError(`${providerDefinitions[provider].name} token exchange failed: ${result.error_description||result.message||result.error||`HTTP ${response.status}`}`,502);
  return result;
}

function normalizeToken(provider, token) {
  const apiBaseUrl = provider==='hubspot'?'https://api.hubapi.com':provider==='salesforce'?token.instance_url:provider==='zoho'?(token.api_domain||'https://www.zohoapis.com'):token.api_domain;
  if(!token.access_token||!token.refresh_token||!apiBaseUrl)throw httpError(`${providerDefinitions[provider].name} did not return complete offline credentials`,502);
  return { accessToken:token.access_token,refreshToken:token.refresh_token,expiresAt:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),tokenType:token.token_type||'Bearer',apiBaseUrl,scopes:String(token.scope||'').split(/[ ,]+/).filter(Boolean),accountId:token.id||null };
}

async function ensureAccessToken(connection, fetchImpl) {
  let credentials=connection.credentials||decryptCredentials(connection.credentialsEncrypted);
  if(!credentials?.refreshToken)throw httpError('CRM refresh credentials are unavailable',409);
  if(new Date(credentials.expiresAt||0).getTime()>Date.now()+60000)return{...connection,credentials};
  const config=oauthConfig(connection.provider,true); const values={grant_type:'refresh_token',refresh_token:credentials.refreshToken}; const headers={'Content-Type':'application/x-www-form-urlencoded'};
  if(connection.provider==='pipedrive')headers.Authorization=`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`; else Object.assign(values,{client_id:config.clientId,client_secret:config.clientSecret});
  const response=await fetchImpl(config.tokenUrl,{method:'POST',headers,body:new URLSearchParams(values).toString()}); const token=await response.json().catch(()=>({}));
  if(!response.ok)throw retryableError(`${providerDefinitions[connection.provider].name} token refresh failed: ${token.error_description||token.message||token.error||response.status}`);
  credentials={...credentials,accessToken:token.access_token||credentials.accessToken,refreshToken:token.refresh_token||credentials.refreshToken,expiresAt:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),apiBaseUrl:token.instance_url||token.api_domain||credentials.apiBaseUrl};
  const encrypted=encryptSecret(JSON.stringify(credentials)); const masked=maskCredentials(credentials);
  if(hasDatabaseConfig())await query(`update business_crm_connections set credentials_encrypted=:encrypted,credentials_masked=:masked,api_base_url=:apiBaseUrl where id=:id`,{encrypted,masked:JSON.stringify(masked),apiBaseUrl:credentials.apiBaseUrl,id:connection.id}); else Object.assign(connection,{credentialsEncrypted:encrypted,credentialsMasked:masked,apiBaseUrl:credentials.apiBaseUrl});
  return{...connection,credentials};
}

async function providerHealthRequest(connection, fetchImpl) {
  const c=connection.credentials; const base=c.apiBaseUrl.replace(/\/$/,''); let url;
  if(connection.provider==='hubspot')url=`${base}/crm/v3/objects/contacts?limit=1`;
  if(connection.provider==='salesforce')url=`${base}/services/data/${salesforceApiVersion()}/query?q=${encodeURIComponent('SELECT Id FROM Contact LIMIT 1')}`;
  if(connection.provider==='zoho')url=`${base}/crm/v8/Contacts?fields=id&per_page=1`;
  if(connection.provider==='pipedrive')url=`${base}/api/v2/persons?limit=1`;
  return requestJson(fetchImpl,url,{headers:{Authorization:`Bearer ${c.accessToken}`} },connection.provider);
}

async function syncContact(runtime, contact, connection, fetchImpl) {
  const mapping=parseJson(connection.fieldMapping,PROVIDER_MAPPINGS[connection.provider]);
  const link=await findRecordLink(connection.id,contact.id); const payload=providerProperties(connection.provider,contact,mapping); const payloadHash=hash(JSON.stringify(payload));
  if(link?.status==='synced'&&link.payloadHash===payloadHash)return link;
  const c=runtime.credentials; const base=c.apiBaseUrl.replace(/\/$/,''); let result; let externalId=link?.externalId;
  if(connection.provider==='hubspot') {
    const properties=payload;
    result=await syncHubSpotContact({ fetchImpl, base, credentials:c, contact, properties, externalId, phoneProperty:mapping.phone });
    externalId=String(result.id||externalId||'');
  } else if(connection.provider==='zoho') {
    result=await requestJson(fetchImpl,`${base}/crm/v8/Contacts/upsert`,{method:'POST',headers:bearer(c),body:JSON.stringify({data:[payload],duplicate_check_fields:[mapping.email||mapping.phone].filter(Boolean),trigger:[]})},connection.provider); externalId=String(result.data?.[0]?.details?.id||externalId||'');
  } else if(connection.provider==='salesforce') {
    if(externalId) { await requestJson(fetchImpl,`${base}/services/data/${salesforceApiVersion()}/sobjects/Contact/${externalId}`,{method:'PATCH',headers:bearer(c),body:JSON.stringify(payload)},connection.provider,true); }
    else { result=await requestJson(fetchImpl,`${base}/services/data/${salesforceApiVersion()}/sobjects/Contact`,{method:'POST',headers:bearer(c),body:JSON.stringify(payload)},connection.provider); externalId=String(result.id||''); }
  } else {
    result=await syncPipedrivePerson({ fetchImpl, base, credentials:c, contact, properties:payload, externalId });
    externalId=String(result.data?.id||result.id||externalId||'');
  }
  if(!externalId)throw httpError(`${providerDefinitions[connection.provider].name} did not return a contact identifier`,502);
  return saveRecordLink(connection,contact,externalId,'synced',null,payloadHash);
}

async function syncHubSpotContact({ fetchImpl, base, credentials, contact, properties, externalId, phoneProperty='phone' }) {
  if(externalId)return requestJson(fetchImpl,`${base}/crm/v3/objects/contacts/${externalId}`,{method:'PATCH',headers:bearer(credentials),body:JSON.stringify({properties})},'hubspot');
  if(contact.email){const upsert=await requestJson(fetchImpl,`${base}/crm/v3/objects/contacts/batch/upsert`,{method:'POST',headers:bearer(credentials),body:JSON.stringify({inputs:[{idProperty:'email',id:contact.email,properties}]})},'hubspot');return upsert.results?.[0]||{};}
  if(!contact.phone)throw httpError('HubSpot contact sync requires an email address or phone number',422);
  const search=await requestJson(fetchImpl,`${base}/crm/v3/objects/contacts/search`,{method:'POST',headers:bearer(credentials),body:JSON.stringify({filterGroups:[{filters:[{propertyName:phoneProperty||'phone',operator:'EQ',value:contact.phone}]}],properties:[],limit:2})},'hubspot');
  const matches=Array.isArray(search.results)?search.results:[];
  if(matches.length>1)throw httpError('HubSpot phone lookup matched multiple contacts; resolve the duplicate records before syncing',409);
  if(matches.length===1)return requestJson(fetchImpl,`${base}/crm/v3/objects/contacts/${matches[0].id}`,{method:'PATCH',headers:bearer(credentials),body:JSON.stringify({properties})},'hubspot');
  return requestJson(fetchImpl,`${base}/crm/v3/objects/contacts`,{method:'POST',headers:bearer(credentials),body:JSON.stringify({properties})},'hubspot');
}

async function syncPipedrivePerson({ fetchImpl, base, credentials, contact, properties, externalId }) {
  if(externalId)return requestJson(fetchImpl,`${base}/api/v2/persons/${externalId}`,{method:'PATCH',headers:bearer(credentials),body:JSON.stringify(properties)},'pipedrive');
  const identity=contact.email||contact.phone;
  const field=contact.email?'email':'phone';
  if(!identity)throw httpError('Pipedrive person sync requires an email address or phone number',422);
  const searchUrl=new URL(`${base}/api/v2/persons/search`);
  searchUrl.searchParams.set('term',identity);
  searchUrl.searchParams.set('fields',field);
  searchUrl.searchParams.set('exact_match','true');
  searchUrl.searchParams.set('limit','2');
  const search=await requestJson(fetchImpl,searchUrl.toString(),{headers:{Authorization:`Bearer ${credentials.accessToken}`}},'pipedrive');
  const items=Array.isArray(search.data?.items)?search.data.items:Array.isArray(search.data)?search.data:[];
  const matches=items.map((item)=>item.item||item).filter((item)=>item?.id);
  if(matches.length>1)throw httpError(`Pipedrive ${field} lookup matched multiple people; resolve the duplicate records before syncing`,409);
  if(matches.length===1)return requestJson(fetchImpl,`${base}/api/v2/persons/${matches[0].id}`,{method:'PATCH',headers:bearer(credentials),body:JSON.stringify(properties)},'pipedrive');
  return requestJson(fetchImpl,`${base}/api/v2/persons`,{method:'POST',headers:bearer(credentials),body:JSON.stringify(properties)},'pipedrive');
}

async function requestJson(fetchImpl,url,options,provider,allowEmpty=false){const response=await fetchImpl(url,options);const body=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(`${providerDefinitions[provider].name} returned HTTP ${response.status}${body.message?`: ${body.message}`:''}`),{retryable:response.status===429||response.status>=500});return allowEmpty?body:body;}
function bearer(c){return{Authorization:`Bearer ${c.accessToken}`,'Content-Type':'application/json'};}
function providerProperties(provider,c,mapping){
  const p=splitName(c.name); const values={name:c.name,email:c.email,phone:c.phone,segment:c.segment,optedIn:Boolean(c.optedIn)}; const payload={};
  for(const [local,remote] of Object.entries(mapping)){if(!remote||values[local]===undefined||values[local]===null||values[local]==='')continue;payload[remote]=values[local];}
  if(provider==='hubspot'&&mapping.name==='firstname'){payload.firstname=p.first;if(p.last)payload.lastname=p.last;}
  if(provider==='salesforce'&&mapping.name==='LastName'){payload.FirstName=p.first;payload.LastName=p.last||p.first;}
  if(provider==='zoho'&&mapping.name==='Last_Name'){payload.First_Name=p.first;payload.Last_Name=p.last||p.first;}
  if(provider==='pipedrive'){if(mapping.email&&c.email)payload[mapping.email]=[{value:c.email,primary:true}];if(mapping.phone&&c.phone)payload[mapping.phone]=[{value:c.phone,primary:true}];}
  return compact(payload);
}
function splitName(value){const parts=String(value||'').trim().split(/\s+/);return{first:parts.shift()||'Contact',last:parts.join(' ')}};
function compact(v){return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined&&x!==null&&x!==''));}

async function listContacts(businessId){if(hasDatabaseConfig())return query(`select id,business_id as businessId,name,phone,email,segment,opted_in as optedIn,created_at as createdAt from contacts where business_id=:businessId and deleted_at is null order by id limit 250`,{businessId});return[];}
async function findRecordLink(connectionId,contactId){if(hasDatabaseConfig())return(await query(`select id,external_id as externalId,payload_hash as payloadHash,status from business_crm_record_links where connection_id=:connectionId and contact_id=:contactId limit 1`,{connectionId,contactId}))[0];return demo.links.find((x)=>x.connectionId===connectionId&&x.contactId===contactId);}
async function saveRecordLink(connection,contact,externalId,status,lastError,payloadHash=null){if(hasDatabaseConfig()){await query(`insert into business_crm_record_links (business_id,connection_id,contact_id,external_id,payload_hash,status,last_error,last_synced_at) values (:businessId,:connectionId,:contactId,:externalId,:payloadHash,:status,:lastError,:lastSyncedAt) on duplicate key update external_id=coalesce(values(external_id),external_id),payload_hash=coalesce(values(payload_hash),payload_hash),status=values(status),last_error=values(last_error),last_synced_at=values(last_synced_at)`,{businessId:connection.businessId,connectionId:connection.id,contactId:contact.id,externalId,payloadHash,status,lastError:String(lastError||'').slice(0,500)||null,lastSyncedAt:status==='synced'?new Date():null});return findRecordLink(connection.id,contact.id);}const value={connectionId:connection.id,contactId:contact.id,externalId,payloadHash,status,lastError};demo.links.push(value);return value;}
async function beginRun(connection,input){const run={id:Date.now(),businessId:connection.businessId,connectionId:connection.id,provider:connection.provider,triggerType:input.triggerType||'scheduled',status:'running',startedAt:new Date()};if(hasDatabaseConfig()){const result=await query(`insert into business_crm_sync_runs (business_id,connection_id,job_id,trigger_type) values (:businessId,:connectionId,:jobId,:triggerType)`,{...run,jobId:input.jobId||null});run.id=result.insertId;}else demo.runs.push(run);return run;}
async function completeRun(run,result){const durationMs=Date.now()-new Date(run.startedAt).getTime();if(hasDatabaseConfig())await query(`update business_crm_sync_runs set status=:status,attempted_count=:attemptedCount,succeeded_count=:succeededCount,failed_count=:failedCount,duration_ms=:durationMs,error_message=:errorMessage,completed_at=current_timestamp where id=:id`,{id:run.id,status:result.status,attemptedCount:result.attemptedCount||0,succeededCount:result.succeededCount||0,failedCount:result.failedCount||0,durationMs,errorMessage:String(result.errorMessage||'').slice(0,500)||null});else Object.assign(run,result,{durationMs,completedAt:new Date()});}
async function updateConnectionAfterSync(c,status,error){const ok=['succeeded','partial'].includes(status);const next=new Date(Date.now()+Number(c.syncIntervalMinutes||360)*60000);if(hasDatabaseConfig())await query(`update business_crm_connections set status=:connectionStatus,last_synced_at=:lastSyncedAt,next_sync_at=:nextSyncAt,consecutive_failures=:failures,last_error=:error where id=:id`,{id:c.id,connectionStatus:ok?'connected':'error',lastSyncedAt:ok?new Date():c.lastSyncedAt||null,nextSyncAt:next,failures:ok?0:Number(c.consecutiveFailures||0)+1,error:String(error||'').slice(0,500)||null});else Object.assign(c,{status:ok?'connected':'error',lastSyncedAt:ok?new Date():c.lastSyncedAt,nextSyncAt:next,consecutiveFailures:ok?0:Number(c.consecutiveFailures||0)+1,lastError:error});return next;}
async function enqueueNextSync(c,runAt){return enqueueJob({type:'tenant.crm.sync',payload:{businessId:Number(c.businessId),connectionId:Number(c.id),triggerType:'scheduled',scheduledFor:runAt.toISOString()},runAt,maxAttempts:4,dedupeKey:`${scheduledDedupePrefix(c.id)}${runAt.toISOString()}`});}
function scheduledDedupePrefix(connectionId){return`tenant-crm-scheduled:${connectionId}:`;}
async function saveConnectionHealth(c,status,message){if(hasDatabaseConfig())await query(`update business_crm_connections set last_health_status=:status,last_health_message=:message,last_checked_at=current_timestamp where id=:id`,{id:c.id,status,message:String(message).slice(0,500)});else Object.assign(c,{lastHealthStatus:status,lastHealthMessage:message,lastCheckedAt:new Date()});}

async function revokeToken(provider,credentials,fetchImpl){if(!credentials?.refreshToken)return{revoked:false};if(provider==='pipedrive'){const c=oauthConfig(provider,true);const r=await fetchImpl('https://oauth.pipedrive.com/oauth/revoke',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:credentials.refreshToken,token_type_hint:'refresh_token'}).toString()});if(!r.ok)throw new Error(`Pipedrive revocation returned ${r.status}`);return{revoked:true};}if(provider==='zoho'){const r=await fetchImpl(`${oauthConfig(provider,true).tokenUrl}/revoke?token=${encodeURIComponent(credentials.refreshToken)}`,{method:'POST'});if(!r.ok)throw new Error(`Zoho revocation returned ${r.status}`);return{revoked:true};}return{revoked:false,reason:'provider_uninstall_required'};}
function oauthConfig(provider,required){const prefix=`CRM_${provider.toUpperCase()}_OAUTH`;const clientId=String(process.env[`${prefix}_CLIENT_ID`]||'').trim();const clientSecret=String(process.env[`${prefix}_CLIENT_SECRET`]||'').trim();if(!clientId||!clientSecret){if(required)throw httpError(`${providerDefinitions[provider].name} OAuth is not configured for this platform`,503);return null;}const definition=providerDefinitions[provider];return{clientId,clientSecret,authorizeUrl:String(process.env[`${prefix}_AUTHORIZE_URL`]||definition.authorizeUrl),tokenUrl:String(process.env[`${prefix}_TOKEN_URL`]||definition.tokenUrl),redirectUri:String(process.env[`${prefix}_REDIRECT_URI`]||expectedRedirectUri(provider)),scopes:definition.scopes};}
function expectedRedirectUri(provider){return`${String(process.env.APP_URL||'http://localhost:3000').replace(/\/$/,'')}/auth/crm/${provider}/callback`;}
function publicConnection(c){return{...c,credentialsEncrypted:undefined,credentials:undefined,credentialsMasked:parseJson(c.credentialsMasked,c.credentialsMasked||{}),grantedScopes:parseJson(c.grantedScopes,[]),fieldMapping:parseJson(c.fieldMapping,PROVIDER_MAPPINGS[c.provider]),configured:Boolean(c.credentialsMasked)};}
function decryptCredentials(value){try{return parseJson(decryptSecret(value),{});}catch{return{};}}
function maskCredentials(c){return{accessToken:maskSecret(c.accessToken),refreshToken:maskSecret(c.refreshToken)};}
function validateFieldMapping(value,provider){const defaults=PROVIDER_MAPPINGS[provider];const mapping=parseJson(value,value||defaults);if(provider==='pipedrive'){const optional={};for(const field of ['segment','optedIn']){const target=String(mapping[field]||'').trim();if(target&&!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(target))throw httpError(`CRM field mapping has an invalid target for ${field}`,400);optional[field]=target;}return{...defaults,...optional};}const result={...defaults,...mapping};for(const [local,remote]of Object.entries(result)){if(!Object.hasOwn(defaults,local))throw httpError(`CRM field mapping contains an unsupported field: ${local}`,400);if(!['segment','optedIn'].includes(local)&&!remote)throw httpError(`CRM field mapping requires a target for ${local}`,400);if(String(remote)&&!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(String(remote)))throw httpError(`CRM field mapping has an invalid target for ${local}`,400);}return result;}
function salesforceApiVersion(){return String(process.env.CRM_SALESFORCE_API_VERSION||'v67.0').replace(/^\/?/,'').replace(/^(?!v)/,'v');}
function normalizeProvider(value){const p=String(value||'').toLowerCase();if(!PROVIDERS.includes(p))throw httpError('Unsupported CRM provider',400);return p;}
function normalizeInterval(value){const n=Number(value||360);return Math.min(10080,Math.max(15,Number.isFinite(n)?n:360));}
function parseJson(value,fallback){if(value&&typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;}}
function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function retryableError(message){const e=new Error(message);e.retryable=true;return e;}
function httpError(message,status){const e=new Error(message);e.status=status;return e;}

module.exports={ beginTenantCrmOAuth, completeTenantCrmOAuth, disconnectTenantCrm, getTenantCrmJobStatus, getTenantCrmOperations, getTenantCrmProviderStatus, listTenantCrmConnections, requestTenantCrmSync, syncHubSpotContact, syncPipedrivePerson, syncTenantCrmConnection, testTenantCrmConnection, updateTenantCrmConnection, validateFieldMapping, providerDefinitions, providerProperties, PROVIDER_MAPPINGS };
