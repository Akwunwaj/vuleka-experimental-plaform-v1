const { hasDatabaseConfig, query } = require('../db/pool');
const { retrieveTenantKnowledge } = require('./tenantKnowledge');

const demoCases = new Map();
const demoRuns = new Map();
let nextDemoCaseId = 1;
let nextDemoRunId = 1;
const stopWords = new Set(['the','and','for','that','this','with','from','your','you','are','was','have','has','will','can','our','but','not','into','about']);

async function listKnowledgeEvaluationCases(businessId) {
  if (!hasDatabaseConfig()) return [...demoCases.values()].filter((item) => Number(item.businessId) === Number(businessId) && item.status === 'active').sort((a,b) => Number(b.id)-Number(a.id));
  const rows = await query(
    `select id,business_id as businessId,name,query_text as queryText,customer_phone as customerPhone,
            expected_source_refs as expectedSourceRefs,required_terms as requiredTerms,forbidden_source_refs as forbiddenSourceRefs,
            candidate_answer as candidateAnswer,status,created_by_user_id as createdByUserId,created_at as createdAt,updated_at as updatedAt
     from knowledge_evaluation_cases where business_id=:businessId and status='active' order by updated_at desc,id desc`,
    { businessId }
  );
  return rows.map(normalizeCase);
}

async function createKnowledgeEvaluationCase(input) {
  const item = validateCase(input);
  const now = new Date().toISOString();
  if (!hasDatabaseConfig()) {
    const stored = { id:nextDemoCaseId++, businessId:Number(input.businessId), ...item, status:'active', createdByUserId:input.actorUser?.id || null, createdAt:now, updatedAt:now };
    demoCases.set(stored.id, stored);
    return stored;
  }
  const result = await query(
    `insert into knowledge_evaluation_cases
       (business_id,name,query_text,customer_phone,expected_source_refs,required_terms,forbidden_source_refs,candidate_answer,status,created_by_user_id)
     values (:businessId,:name,:queryText,:customerPhone,:expectedSourceRefs,:requiredTerms,:forbiddenSourceRefs,:candidateAnswer,'active',:createdByUserId)`,
    { businessId:input.businessId, ...item, expectedSourceRefs:JSON.stringify(item.expectedSourceRefs), requiredTerms:JSON.stringify(item.requiredTerms), forbiddenSourceRefs:JSON.stringify(item.forbiddenSourceRefs), createdByUserId:input.actorUser?.id || null }
  );
  return (await listKnowledgeEvaluationCases(input.businessId)).find((candidate) => Number(candidate.id) === Number(result.insertId));
}

async function listKnowledgeEvaluationRuns(businessId, limit = 10) {
  if (!hasDatabaseConfig()) return [...demoRuns.values()].filter((item) => Number(item.businessId) === Number(businessId)).sort((a,b) => Number(b.id)-Number(a.id)).slice(0,limit);
  const rows = await query(
    `select id,business_id as businessId,case_count as caseCount,citation_precision as citationPrecision,
            source_recall as sourceRecall,completeness,isolation_pass_rate as isolationPassRate,
            unsupported_claim_risk as unsupportedClaimRisk,results,created_by_user_id as createdByUserId,created_at as createdAt
     from knowledge_evaluation_runs where business_id=:businessId order by created_at desc,id desc limit ${Math.max(1,Math.min(50,Number(limit)||10))}`,
    { businessId }
  );
  return rows.map(normalizeRun);
}

async function runKnowledgeEvaluations(input) {
  const cases = await listKnowledgeEvaluationCases(input.businessId);
  if (!cases.length) throw httpError('Create at least one active evaluation case before running evaluations', 409);
  const results = [];
  for (const item of cases.slice(0, 100)) {
    const retrieval = await retrieveTenantKnowledge({ businessId:input.businessId, queryText:item.queryText, customerPhone:item.customerPhone, limit:8 });
    results.push(scoreCase(item, retrieval.sources));
  }
  const scoredCitation = results.filter((result) => result.citationPrecision !== null);
  const scoredRecall = results.filter((result) => result.sourceRecall !== null);
  const scoredCompleteness = results.filter((result) => result.completeness !== null);
  const scoredUnsupported = results.filter((result) => result.unsupportedClaimRisk !== null);
  const summary = {
    caseCount:results.length,
    citationPrecision:average(scoredCitation.map((item) => item.citationPrecision)),
    sourceRecall:average(scoredRecall.map((item) => item.sourceRecall)),
    completeness:average(scoredCompleteness.map((item) => item.completeness)),
    isolationPassRate:average(results.map((item) => item.isolationPassed ? 1 : 0)),
    unsupportedClaimRisk:average(scoredUnsupported.map((item) => item.unsupportedClaimRisk))
  };
  return saveRun({ businessId:input.businessId, actorUser:input.actorUser, ...summary, results });
}

function scoreCase(item, sources) {
  const returnedRefs = sources.map((source) => source.ref);
  const expected = item.expectedSourceRefs || [];
  const forbidden = item.forbiddenSourceRefs || [];
  const retrievedText = sources.map((source) => source.fact).join(' ');
  const expectedMatches = expected.filter((ref) => returnedRefs.includes(ref)).length;
  const candidateAnswer = String(item.candidateAnswer || '').trim();
  const answerText = candidateAnswer || retrievedText;
  const requiredTerms = item.requiredTerms || [];
  return {
    caseId:Number(item.id),
    name:item.name,
    returnedRefs,
    citationPrecision:expected.length ? ratio(expectedMatches, returnedRefs.filter((ref) => ref !== `business:${item.businessId}`).length) : null,
    sourceRecall:expected.length ? ratio(expectedMatches, expected.length) : null,
    completeness:requiredTerms.length ? ratio(requiredTerms.filter((term) => answerText.toLowerCase().includes(String(term).toLowerCase())).length, requiredTerms.length) : null,
    isolationPassed:forbidden.every((ref) => !returnedRefs.includes(ref)),
    forbiddenMatches:forbidden.filter((ref) => returnedRefs.includes(ref)),
    unsupportedClaimRisk:candidateAnswer ? unsupportedClaimRisk(candidateAnswer, retrievedText) : null
  };
}

function unsupportedClaimRisk(answer, sourceText) {
  const sourceTokens = tokenSet(sourceText);
  const sourceNumbers = new Set(String(sourceText).match(/\b\d+(?:[.,]\d+)?\b/g) || []);
  const sentences = String(answer).split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  let unsupported = 0;
  for (const sentence of sentences) {
    const tokens = [...tokenSet(sentence)];
    const numbers = sentence.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const lexicalSupport = tokens.length <= 2 ? 1 : ratio(tokens.filter((token) => sourceTokens.has(token)).length, tokens.length);
    const numbersSupported = numbers.every((number) => sourceNumbers.has(number));
    if (lexicalSupport < 0.35 || !numbersSupported) unsupported += 1;
  }
  return ratio(unsupported, sentences.length);
}

async function saveRun(run) {
  const now = new Date().toISOString();
  const methodology = {
    citationPrecision:'Expected source references divided by returned non-workspace references.',
    sourceRecall:'Expected source references found divided by expected references.',
    completeness:'Required terms present in the candidate answer, or retrieved facts when no candidate answer is supplied.',
    isolationPassRate:'Cases where no forbidden source reference was returned.',
    unsupportedClaimRisk:'Transparent lexical and numeric support heuristic; null when no candidate answer is supplied.'
  };
  if (!hasDatabaseConfig()) {
    const stored = { id:nextDemoRunId++, ...run, methodology, createdByUserId:run.actorUser?.id || null, createdAt:now };
    delete stored.actorUser;
    demoRuns.set(stored.id, stored);
    return stored;
  }
  const result = await query(
    `insert into knowledge_evaluation_runs
       (business_id,case_count,citation_precision,source_recall,completeness,isolation_pass_rate,unsupported_claim_risk,results,created_by_user_id)
     values (:businessId,:caseCount,:citationPrecision,:sourceRecall,:completeness,:isolationPassRate,:unsupportedClaimRisk,:results,:createdByUserId)`,
    { ...run, results:JSON.stringify(run.results), createdByUserId:run.actorUser?.id || null }
  );
  const { actorUser, ...publicRun } = run;
  return { id:Number(result.insertId), ...publicRun, methodology, createdByUserId:actorUser?.id || null, createdAt:now };
}

function validateCase(input) {
  const name=String(input.name||'').trim(); const queryText=String(input.queryText||'').trim();
  if(!name||name.length>180)throw httpError('Evaluation name is required and must be 180 characters or fewer',400);
  if(!queryText||queryText.length>5000)throw httpError('Evaluation query is required and must be 5000 characters or fewer',400);
  return { name,queryText,customerPhone:String(input.customerPhone||'').trim().slice(0,30)||null,expectedSourceRefs:normalizeList(input.expectedSourceRefs,30),requiredTerms:normalizeList(input.requiredTerms,30),forbiddenSourceRefs:normalizeList(input.forbiddenSourceRefs,30),candidateAnswer:String(input.candidateAnswer||'').trim().slice(0,10000)||null };
}
function normalizeList(value,limit) { const list=Array.isArray(value)?value:String(value||'').split(','); return [...new Set(list.map((item)=>String(item).trim()).filter(Boolean))].slice(0,limit); }
function tokenSet(value) { return new Set((String(value).toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter((token)=>!stopWords.has(token))); }
function average(values) { return values.length ? Number((values.reduce((sum,value)=>sum+Number(value||0),0)/values.length).toFixed(3)) : 0; }
function ratio(numerator,denominator) { return denominator ? Number((Number(numerator||0)/Number(denominator)).toFixed(3)) : 0; }
function normalizeCase(row) { return { ...row,id:Number(row.id),businessId:Number(row.businessId),expectedSourceRefs:parseJson(row.expectedSourceRefs,[]),requiredTerms:parseJson(row.requiredTerms,[]),forbiddenSourceRefs:parseJson(row.forbiddenSourceRefs,[]) }; }
function normalizeRun(row) { return { ...row,id:Number(row.id),businessId:Number(row.businessId),caseCount:Number(row.caseCount||0),citationPrecision:Number(row.citationPrecision||0),sourceRecall:Number(row.sourceRecall||0),completeness:Number(row.completeness||0),isolationPassRate:Number(row.isolationPassRate||0),unsupportedClaimRisk:Number(row.unsupportedClaimRisk||0),results:parseJson(row.results,[]) }; }
function parseJson(value,fallback) { if(value===null||value===undefined)return fallback;if(typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;} }
function httpError(message,status) { const error=new Error(message);error.status=status;return error; }

module.exports = { createKnowledgeEvaluationCase, listKnowledgeEvaluationCases, listKnowledgeEvaluationRuns, runKnowledgeEvaluations, scoreCase, unsupportedClaimRisk };
