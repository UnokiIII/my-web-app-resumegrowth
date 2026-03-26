import { AnalysisResult, ResumeData, generateMockAnalysis } from './mock-data';
import type { KnowledgeContext } from './knowledge';

export type SupportedModel = 'qwen3.5-flash' | 'claude-4.6-opus' | 'gpt-5.4' | 'gemini-3.1';
export type ProviderKind = 'openai-compatible' | 'openai-native' | 'anthropic-native' | 'gemini-native';

export interface CustomApiConfig {
  baseURL?: string;
  apiKey?: string;
  modelId?: string;
}

export interface AnalyzeMeta {
  providerKind: ProviderKind;
  requestedModelId: string;
  resolvedModelId: string;
  availableModelsSample?: string[];
  fallbackFromModelId?: string;
  attemptedModelIds?: string[];
}

export interface AnalyzeOutput {
  result: AnalysisResult;
  meta?: AnalyzeMeta;
}

const MODEL_LABEL: Record<SupportedModel, string> = {
  'qwen3.5-flash': 'Qwen 3.5 Flash',
  'claude-4.6-opus': 'Claude 4.6 Opus',
  'gpt-5.4': 'GPT 5.4',
  'gemini-3.1': 'Gemini 3.1',
};

const PROVIDER_TIMEOUT_MS = 75_000;
const OPENAI_COMPATIBLE_TIMEOUT_MS = 20_000;

class ProviderRequestError extends Error {
  status: number;
  rawText: string;
  providerName: string;
  modelId: string;
  baseURL: string;

  constructor(params: {
    message: string;
    status: number;
    rawText: string;
    providerName: string;
    modelId: string;
    baseURL: string;
  }) {
    super(params.message);
    this.name = 'ProviderRequestError';
    this.status = params.status;
    this.rawText = params.rawText;
    this.providerName = params.providerName;
    this.modelId = params.modelId;
    this.baseURL = params.baseURL;
  }
}

function buildPrompt(resume: ResumeData, knowledgeContext?: KnowledgeContext) {
  const prompt = `你不是泛职业建议助手，而是一人企业路径决策引擎。

你的任务是：基于这份简历，判断最现实、最容易在 30 天内拿到第一单的一人企业路径。

必须遵守以下规则：
1. 先看这份简历里已经验证过的经验、成果、技能、关系和可复用流程，不允许套用其他简历的答案。
2. 路线只能从以下池子中选择：项目制交付、标准化服务、顾问咨询、代运营/代理服务、渠道销售、培训/陪跑、资源撮合、信息服务/研究、工具产品、垂直 SaaS、内容/IP。
3. 内容/IP 只有在“持续输出 + 商业化证据”同时成立时，才能做主路线；否则只能做辅助放大器。
4. 垂直 SaaS 只有在“真实服务验证 + 重复需求明确”时，才能做主路线；否则只能做后续升级方向。
5. 资产排序必须按“这份简历里最容易直接变现的证据”排序，而不是按固定职业类别排序。
6. 如果履历是混合型，可以给主路线、备选 A、备选 B，但每条都必须解释为什么成立。
7. 所有建议都要能解释第一单从哪里来、为什么这个方向比其他方向更容易成交。

输出要求：
1. 只输出 JSON，不要 markdown，不要额外解释。
2. JSON 必须严格符合下面结构。
3. 文案必须用简体中文。

JSON schema:
{
  "assets": [{"name":"string","potential":1-5,"evidence":"string","product":"string"}],
  "positioning": {"primary":"string","alternativeA":"string","alternativeB":"string"},
  "growthPath": [{"phase":"string","duration":"string","goal":"string","actions":["string"],"milestone":"string"}],
  "revenueModel": [{"phase":"string","product":"string","pricing":"string","target":"string","expectedIncome":"string"}],
  "risks": [{"point":"string","warning":"string","solution":"string"}],
  "checklist": [{"week":"string","tasks":["string"]}],
  "routeSelection": {
    "mainRoute": "string",
    "secondaryRoutes": ["string", "string"],
    "rejectedRoutes": ["string"],
    "reason": "string"
  },
  "firstDealPlan": {
    "targetCustomer": "string",
    "whereToFind": "string",
    "approach": "string",
    "closing": "string"
  }
}

简历数据：
${JSON.stringify(resume, null, 2)}`;

  if (!knowledgeContext) return prompt;

  return `${prompt}

${knowledgeContext.promptContext}`;
}

function extractFirstJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('模型返回内容中不包含合法 JSON');
  }
  return text.slice(start, end + 1);
}

function parseModelJsonSafely(content: string, fallback: AnalysisResult, providerName: string) {
  try {
    const parsed = JSON.parse(extractFirstJson(content));
    return normalizeResult(parsed, fallback);
  } catch (error) {
    console.error('[llm-analysis] invalid-json', {
      providerName,
      message: error instanceof Error ? error.message : 'unknown parse error',
      preview: content.slice(0, 1200),
    });
    return fallback;
  }
}

function normalizeResult(raw: unknown, fallback: AnalysisResult): AnalysisResult {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<AnalysisResult>;

  return {
    assets: Array.isArray(obj.assets) && obj.assets.length ? obj.assets : fallback.assets,
    positioning:
      obj.positioning && typeof obj.positioning === 'object'
        ? {
            primary: (obj.positioning as any).primary || fallback.positioning.primary,
            alternativeA: (obj.positioning as any).alternativeA || fallback.positioning.alternativeA,
            alternativeB: (obj.positioning as any).alternativeB || fallback.positioning.alternativeB,
          }
        : fallback.positioning,
    growthPath: Array.isArray(obj.growthPath) && obj.growthPath.length ? obj.growthPath : fallback.growthPath,
    revenueModel: Array.isArray(obj.revenueModel) && obj.revenueModel.length ? obj.revenueModel : fallback.revenueModel,
    risks: Array.isArray(obj.risks) && obj.risks.length ? obj.risks : fallback.risks,
    checklist: Array.isArray(obj.checklist) && obj.checklist.length ? obj.checklist : fallback.checklist,
    routeSelection:
      obj.routeSelection && typeof obj.routeSelection === 'object'
        ? {
            mainRoute: (obj.routeSelection as any).mainRoute || fallback.routeSelection?.mainRoute || '',
            secondaryRoutes:
              Array.isArray((obj.routeSelection as any).secondaryRoutes) && (obj.routeSelection as any).secondaryRoutes.length
                ? (obj.routeSelection as any).secondaryRoutes
                : fallback.routeSelection?.secondaryRoutes || [],
            rejectedRoutes:
              Array.isArray((obj.routeSelection as any).rejectedRoutes) && (obj.routeSelection as any).rejectedRoutes.length
                ? (obj.routeSelection as any).rejectedRoutes
                : fallback.routeSelection?.rejectedRoutes || [],
            reason: (obj.routeSelection as any).reason || fallback.routeSelection?.reason || '',
          }
        : fallback.routeSelection,
    firstDealPlan:
      obj.firstDealPlan && typeof obj.firstDealPlan === 'object'
        ? {
            targetCustomer: (obj.firstDealPlan as any).targetCustomer || fallback.firstDealPlan?.targetCustomer || '',
            whereToFind: (obj.firstDealPlan as any).whereToFind || fallback.firstDealPlan?.whereToFind || '',
            approach: (obj.firstDealPlan as any).approach || fallback.firstDealPlan?.approach || '',
            closing: (obj.firstDealPlan as any).closing || fallback.firstDealPlan?.closing || '',
          }
        : fallback.firstDealPlan,
  };
}

function buildFallbackAnalysis(resume: ResumeData, knowledgeContext?: KnowledgeContext) {
  const fallback = generateMockAnalysis(resume);

  if (!knowledgeContext) return fallback;

  const mainRoute = knowledgeContext.candidateRoutes[0]?.route.name || fallback.routeSelection?.mainRoute || '标准化服务';
  const secondaryRoutes = knowledgeContext.candidateRoutes.slice(1, 3).map((item) => item.route.name);
  const rejectedRoutes = knowledgeContext.rejectedRoutes.map((item) => item.name);
  const reason =
    knowledgeContext.candidateRoutes[0]?.reason ||
    fallback.routeSelection?.reason ||
    '当前优先选择最容易在短期内拿到第一单的路线。';

  return {
    ...fallback,
    routeSelection: {
      mainRoute,
      secondaryRoutes,
      rejectedRoutes,
      reason,
    },
  };
}

function getDefaultModelId(model: SupportedModel) {
  if (model === 'qwen3.5-flash') return process.env.QWEN_MODEL || 'qwen3.5-flash';
  if (model === 'claude-4.6-opus') return 'claude-4.6-opus';
  if (model === 'gpt-5.4') return 'gpt-5.4';
  return 'gemini-3.1';
}

function getPreferredFamily(model: SupportedModel) {
  if (model === 'claude-4.6-opus') return 'claude';
  if (model === 'gpt-5.4') return 'gpt';
  if (model === 'gemini-3.1') return 'gemini';
  return '';
}

function pickDefaultModelFromAvailable(available: string[], preferredFamily: string) {
  const list = available.map((item) => item.trim()).filter(Boolean);
  if (!list.length) throw new Error('当前 API Key 没有可用模型');

  if (preferredFamily === 'claude') {
    return (
      list.find((item) => /^claude-opus-/i.test(item)) ||
      list.find((item) => /^claude-sonnet-/i.test(item)) ||
      list.find((item) => /^claude-haiku-/i.test(item)) ||
      list.find((item) => /^claude-/i.test(item)) ||
      list[0]
    );
  }

  if (preferredFamily === 'gemini') {
    return list.find((item) => /^gemini-/i.test(item)) || list[0];
  }

  if (preferredFamily === 'gpt') {
    return list.find((item) => /^gpt-/i.test(item)) || list[0];
  }

  return list[0];
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function isVersionedApiBase(baseURL: string) {
  return /\/v\d+(?:[a-z0-9.-]*)?$/i.test(trimTrailingSlash(baseURL));
}

function getOpenAiCompatibleBaseCandidates(baseURL: string) {
  const trimmed = trimTrailingSlash(baseURL.trim());
  const candidates = [trimmed];

  if (!isVersionedApiBase(trimmed)) {
    candidates.push(`${trimmed}/v1`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function extractTextFromOpenAiCompatContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => extractTextFromOpenAiCompatContent(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
    if (Array.isArray(content.content)) {
      return extractTextFromOpenAiCompatContent(content.content);
    }
  }

  return '';
}

function parseTextFromOpenAiCompat(data: any) {
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型返回为空');
  const extracted = extractTextFromOpenAiCompatContent(content).trim();
  if (extracted) return extracted;
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function buildProviderError(params: {
  providerName: string;
  modelId: string;
  baseURL: string;
  status: number;
  rawText: string;
}) {
  const { providerName, modelId, baseURL, status, rawText } = params;
  const body = rawText.trim();
  const short = body.slice(0, 500);

  if (/^<!doctype html/i.test(body) || /^<html/i.test(body)) {
    const suggestion = isVersionedApiBase(baseURL) ? '' : `。这个地址更像网站首页，OpenAI 兼容接口通常在：${trimTrailingSlash(baseURL)}/v1`;
    return `外部模型请求失败：返回了 HTML 而不是 JSON。请检查 API Base URL 是否正确。当前地址：${baseURL}${suggestion}`;
  }

  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.message || short;
    const code = parsed?.error?.code || parsed?.code;

    if (code === 'model_not_found' || /model_not_found/i.test(body) || /No available channel for model/i.test(body)) {
      return `外部模型不可用：provider=${providerName}，modelId=${modelId}，status=${status}。原始信息：${message}`;
    }

    return `外部模型请求失败：provider=${providerName}，modelId=${modelId}，status=${status}。${message}`;
  } catch {
    return `外部模型请求失败：provider=${providerName}，modelId=${modelId}，status=${status}。响应片段：${short}`;
  }
}

function normalizeModelId(baseURL: string, modelId: string) {
  return modelId.trim();
}

function detectProvider(baseURL: string, modelId: string): ProviderKind {
  const base = baseURL.toLowerCase();

  if (base.includes('anthropic.com')) return 'anthropic-native';
  if (base.includes('generativelanguage.googleapis.com') || base.includes('aiplatform.googleapis.com') || base.includes('googleapis.com')) {
    return 'gemini-native';
  }
  if (base.includes('api.openai.com')) return 'openai-native';
  return 'openai-compatible';
}

function parseAnthropicText(data: any) {
  const content = data?.content;
  if (!Array.isArray(content)) throw new Error('Anthropic 返回为空');
  const text = content
    .filter((item: any) => item?.type === 'text' && item?.text)
    .map((item: any) => item.text)
    .join('\n');
  if (!text) throw new Error('Anthropic 返回内容为空');
  return text;
}

function parseGeminiText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) throw new Error('Gemini 返回为空');
  const text = parts.map((part: any) => part?.text || '').join('\n');
  if (!text) throw new Error('Gemini 返回内容为空');
  return text;
}

async function fetchJsonWithHandling(params: {
  url: string;
  init: RequestInit;
  providerName: string;
  modelId: string;
  baseURL: string;
  timeoutMs?: number;
}) {
  const { url, init, providerName, modelId, baseURL, timeoutMs = PROVIDER_TIMEOUT_MS } = params;
  let resp: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    resp = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `外部模型请求超时：provider=${providerName}，modelId=${modelId}。已等待 ${Math.round(PROVIDER_TIMEOUT_MS / 1000)} 秒，请稍后重试。`
      );
    }

    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(`外部模型网络请求失败：provider=${providerName}，modelId=${modelId}，baseURL=${baseURL}。${message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await resp.text();
  if (!resp.ok) {
    throw new ProviderRequestError({
      message: buildProviderError({ providerName, modelId, baseURL, status: resp.status, rawText: text }),
      status: resp.status,
      rawText: text,
      providerName,
      modelId,
      baseURL,
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderRequestError({
      message: buildProviderError({ providerName, modelId, baseURL, status: resp.status, rawText: text }),
      status: resp.status,
      rawText: text,
      providerName,
      modelId,
      baseURL,
    });
  }
}

async function callOpenAiCompatible(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
  providerName: string;
  knowledgeContext?: KnowledgeContext;
  timeoutMs?: number;
}) {
  const { baseURL, apiKey, modelId, resume, providerName, knowledgeContext, timeoutMs = OPENAI_COMPATIBLE_TIMEOUT_MS } = params;
  const endpoint = baseURL.replace(/\/$/, '') + '/chat/completions';
  const fallback = buildFallbackAnalysis(resume, knowledgeContext);

  const data = await fetchJsonWithHandling({
    url: endpoint,
    providerName,
    modelId,
    baseURL,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        temperature: 0.2,
        messages: [
          { role: 'system', content: '你是一人企业路径决策引擎。严格输出 JSON，不要输出 markdown。' },
          { role: 'user', content: buildPrompt(resume, knowledgeContext) },
        ],
      }),
    },
    timeoutMs,
  });

  const content = parseTextFromOpenAiCompat(data);
  return parseModelJsonSafely(content, fallback, providerName);
}

async function callOpenAiNative(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
  knowledgeContext?: KnowledgeContext;
}) {
  return callOpenAiCompatible({ ...params, providerName: 'OpenAI', timeoutMs: PROVIDER_TIMEOUT_MS });
}

async function callAnthropicNative(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
  knowledgeContext?: KnowledgeContext;
}) {
  const { baseURL, apiKey, modelId, resume, knowledgeContext } = params;
  const endpoint = baseURL.replace(/\/$/, '') + '/messages';
  const fallback = buildFallbackAnalysis(resume, knowledgeContext);

  const data = await fetchJsonWithHandling({
    url: endpoint,
    providerName: 'Anthropic',
    modelId,
    baseURL,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        temperature: 0.2,
        system: '你是一人企业路径决策引擎。严格输出 JSON，不要输出 markdown。',
        messages: [{ role: 'user', content: buildPrompt(resume, knowledgeContext) }],
      }),
    },
  });

  const content = parseAnthropicText(data);
  return parseModelJsonSafely(content, fallback, 'Anthropic');
}

function buildGeminiEndpoint(baseURL: string, modelId: string, apiKey: string) {
  const trimmed = baseURL.replace(/\/$/, '');
  if (trimmed.includes('/models/')) {
    const sep = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${sep}key=${encodeURIComponent(apiKey)}`;
  }
  if (trimmed.endsWith('/v1beta') || trimmed.endsWith('/v1')) {
    return `${trimmed}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }
  if (trimmed.includes('aiplatform.googleapis.com')) {
    return `${trimmed}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }
  return `${trimmed}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function callGeminiNative(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
  knowledgeContext?: KnowledgeContext;
}) {
  const { baseURL, apiKey, modelId, resume, knowledgeContext } = params;
  const endpoint = buildGeminiEndpoint(baseURL, modelId, apiKey);
  const fallback = buildFallbackAnalysis(resume, knowledgeContext);

  const data = await fetchJsonWithHandling({
    url: endpoint,
    providerName: 'Gemini',
    modelId,
    baseURL,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `系统要求：你是一人企业路径决策引擎，严格输出 JSON。\n\n${buildPrompt(resume, knowledgeContext)}` }],
          },
        ],
      }),
    },
  });

  const content = parseGeminiText(data);
  return parseModelJsonSafely(content, fallback, 'Gemini');
}

async function analyzeWithQwen(resume: ResumeData, knowledgeContext?: KnowledgeContext): Promise<AnalysisResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法调用 Qwen 3.5 Flash');
  }

  return callOpenAiCompatible({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey,
    modelId: getDefaultModelId('qwen3.5-flash'),
    resume,
    knowledgeContext,
    providerName: 'Qwen',
    timeoutMs: PROVIDER_TIMEOUT_MS,
  });
}

function normalizeComparableModelId(modelId: string) {
  return modelId
    .toLowerCase()
    .replace(/[\s._/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function tokenizeModelId(modelId: string) {
  return normalizeComparableModelId(modelId).split('-').filter(Boolean);
}

function scoreModelCandidate(requested: string, candidate: string) {
  const requestedNorm = normalizeComparableModelId(requested);
  const candidateNorm = normalizeComparableModelId(candidate);
  const requestedTokens = tokenizeModelId(requested);
  const candidateTokens = tokenizeModelId(candidate);

  if (requestedNorm === candidateNorm) return 1000;

  let score = 0;
  if (candidateNorm.includes(requestedNorm)) score += 400;
  if (requestedNorm.includes(candidateNorm)) score += 250;

  const common = requestedTokens.filter((token) => candidateTokens.includes(token));
  score += common.length * 50;

  const requestedFamily = requestedTokens[0];
  const candidateFamily = candidateTokens[0];
  if (requestedFamily && requestedFamily === candidateFamily) score += 120;

  if (requestedTokens.includes('opus') && candidateTokens.includes('opus')) score += 90;
  if (requestedTokens.includes('sonnet') && candidateTokens.includes('sonnet')) score += 90;
  if (requestedTokens.includes('flash') && candidateTokens.includes('flash')) score += 90;
  if (requestedTokens.includes('pro') && candidateTokens.includes('pro')) score += 90;
  if (requestedTokens.includes('thinking') && candidateTokens.includes('thinking')) score += 60;
  if (requestedTokens.includes('cli') && candidateTokens.includes('cli')) score += 40;

  if (requestedFamily === 'claude' && candidateFamily !== 'claude') score -= 500;
  if (requestedFamily === 'gemini' && candidateFamily !== 'gemini') score -= 500;
  if (requestedFamily === 'gpt' && candidateFamily !== 'gpt') score -= 500;

  score -= Math.abs(candidateTokens.length - requestedTokens.length) * 5;
  return score;
}

function boostLightweightModel(candidate: string, preferredFamily = '') {
  const normalized = normalizeComparableModelId(candidate);
  let score = 0;

  const prefer = (pattern: RegExp, value: number) => {
    if (pattern.test(normalized)) score += value;
  };

  const penalize = (pattern: RegExp, value: number) => {
    if (pattern.test(normalized)) score -= value;
  };

  prefer(/(?:^|-)mini(?:-|$)/, 260);
  prefer(/(?:^|-)flash(?:-|$)/, 240);
  prefer(/(?:^|-)haiku(?:-|$)/, 220);
  prefer(/(?:^|-)lite(?:-|$)|(?:^|-)light(?:-|$)/, 200);
  prefer(/(?:^|-)sonnet(?:-|$)/, 160);

  penalize(/(?:^|-)opus(?:-|$)/, 1400);
  penalize(/(?:^|-)thinking(?:-|$)/, 180);
  penalize(/(?:^|-)pro(?:-|$)/, 120);
  penalize(/(?:^|-)max(?:-|$)/, 100);

  if (preferredFamily === 'claude') {
    prefer(/^claude-haiku-/, 260);
    prefer(/^claude-sonnet-/, 220);
    penalize(/^claude-opus-/, 1800);
  }

  if (preferredFamily === 'gpt') {
    prefer(/^gpt-4o-mini(?:-|$)/, 260);
    prefer(/^gpt-41-mini(?:-|$)/, 240);
    prefer(/^gpt-4o(?:-|$)/, 140);
    penalize(/^gpt-5(?:-|$)/, 140);
  }

  if (preferredFamily === 'gemini') {
    prefer(/^gemini-.*flash/, 240);
    penalize(/^gemini-.*pro/, 120);
  }

  return score;
}

function orderOpenAiCompatibleModels(requestedModelId: string, available: string[], preferredFamily = '') {
  const requested = requestedModelId.trim();
  const normalizedAlias = requested ? normalizeModelId('', requested) : requested;
  const list = Array.from(new Set(available.map((item) => item.trim()).filter(Boolean)));

  if (!list.length) return [] as string[];

  const scored = list
    .map((item) => {
      let score = Math.max(scoreModelCandidate(requested, item), scoreModelCandidate(normalizedAlias, item));
      const normalizedItem = normalizeComparableModelId(item);

      if (preferredFamily === 'claude' && normalizedItem.startsWith('claude-')) score += 120;
      if (preferredFamily === 'gpt' && normalizedItem.startsWith('gpt-')) score += 120;
      if (preferredFamily === 'gemini' && normalizedItem.startsWith('gemini-')) score += 120;
      score += boostLightweightModel(item, preferredFamily);

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.item);
}

function shouldRetryWithAnotherModel(error: unknown) {
  if (!(error instanceof ProviderRequestError)) return false;

  const body = `${error.message}\n${error.rawText}`.toLowerCase();

  if (error.status === 503) return true;
  if (error.status === 500 && /available credential|available channel|upstream|overload|model_not_found/.test(body)) return true;
  if (/model_not_found/.test(body)) return true;
  if (/no available channel for model/.test(body)) return true;
  if (/current no available credential/.test(body)) return true;
  if (/当前无可用凭证/.test(error.message)) return true;
  if (/upstream service overloaded/.test(body)) return true;

  return false;
}

async function fetchOpenAiCompatibleModels(baseURL: string, apiKey: string) {
  const endpoint = trimTrailingSlash(baseURL) + '/models';
  const data = await fetchJsonWithHandling({
    url: endpoint,
    providerName: 'OpenAI-Compatible',
    modelId: 'models:list',
    baseURL,
    init: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  });

  const items = Array.isArray(data?.data) ? data.data : [];
  return items
    .map((item: any) => item?.id)
    .filter((id: any) => typeof id === 'string' && id.trim()) as string[];
}

async function resolveOpenAiCompatibleBaseURL(baseURL: string, apiKey: string) {
  const candidates = getOpenAiCompatibleBaseCandidates(baseURL);

  for (const candidate of candidates) {
    try {
      const availableModels = await fetchOpenAiCompatibleModels(candidate, apiKey);
      return { baseURL: candidate, availableModels };
    } catch {
      continue;
    }
  }

  return {
    baseURL: candidates[candidates.length - 1] || trimTrailingSlash(baseURL),
    availableModels: [] as string[],
  };
}

async function resolveOpenAiCompatibleModel(
  baseURL: string,
  apiKey: string,
  requestedModelId: string,
  preferredFamily = '',
  prefetchedAvailable: string[] | null = null
) {
  const requested = requestedModelId.trim();
  try {
    const available = prefetchedAvailable ?? (await fetchOpenAiCompatibleModels(baseURL, apiKey));
    if (!available.length) {
      const fallbackId = normalizeModelId(baseURL, requested);
      return {
        resolvedModelId: fallbackId,
        orderedModelIds: [fallbackId],
        availableModelsSample: [] as string[],
      };
    }

    const orderedModelIds = orderOpenAiCompatibleModels(requested, available, preferredFamily);
    const fallbackDefault = pickDefaultModelFromAvailable(available, preferredFamily);
    const finalOrder = Array.from(new Set([...(orderedModelIds.length ? orderedModelIds : []), fallbackDefault]));

    return {
      resolvedModelId: finalOrder[0],
      orderedModelIds: finalOrder,
      availableModelsSample: available.slice(0, 20),
    };
  } catch {
    const fallbackId = normalizeModelId(baseURL, requested);
    return {
      resolvedModelId: fallbackId,
      orderedModelIds: [fallbackId],
      availableModelsSample: [] as string[],
    };
  }
}

function assertCustomConfig(config: CustomApiConfig, model: SupportedModel) {
  if (!config.baseURL || !config.apiKey) {
    throw new Error(`${MODEL_LABEL[model]} 需要填写 API Base URL 和 API Key`);
  }

  const base = config.baseURL.trim();
  if (!/^https:\/\//i.test(base) && !/^http:\/\/localhost/i.test(base)) {
    throw new Error('API Base URL 必须是 HTTPS，本地测试可用 http://localhost');
  }

  return {
    baseURL: base,
    apiKey: config.apiKey.trim(),
    modelId: (config.modelId || '').trim() || getDefaultModelId(model),
  };
}

export async function analyzeResumeByModel(
  model: SupportedModel,
  resume: ResumeData,
  customConfig: CustomApiConfig = {},
  knowledgeContext?: KnowledgeContext
): Promise<AnalyzeOutput> {
  if (model === 'qwen3.5-flash') {
    const result = await analyzeWithQwen(resume, knowledgeContext);
    return {
      result,
      meta: {
        providerKind: 'openai-compatible',
        requestedModelId: getDefaultModelId('qwen3.5-flash'),
        resolvedModelId: getDefaultModelId('qwen3.5-flash'),
      },
    };
  }

  if (model === 'claude-4.6-opus' || model === 'gpt-5.4' || model === 'gemini-3.1') {
    const cfg = assertCustomConfig(customConfig, model);
    const requestedModelId = cfg.modelId;
    const provider = detectProvider(cfg.baseURL, requestedModelId);

    if (provider === 'anthropic-native') {
      const result = await callAnthropicNative({
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
        modelId: requestedModelId,
        resume,
        knowledgeContext,
      });
      return {
        result,
        meta: {
          providerKind: provider,
          requestedModelId,
          resolvedModelId: requestedModelId,
        },
      };
    }

    if (provider === 'gemini-native') {
      const result = await callGeminiNative({
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
        modelId: requestedModelId,
        resume,
        knowledgeContext,
      });
      return {
        result,
        meta: {
          providerKind: provider,
          requestedModelId,
          resolvedModelId: requestedModelId,
        },
      };
    }

    if (provider === 'openai-native') {
      const result = await callOpenAiNative({
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
        modelId: requestedModelId,
        resume,
        knowledgeContext,
      });
      return {
        result,
        meta: {
          providerKind: provider,
          requestedModelId,
          resolvedModelId: requestedModelId,
        },
      };
    }

    const resolvedBase = await resolveOpenAiCompatibleBaseURL(cfg.baseURL, cfg.apiKey);
    const resolved = await resolveOpenAiCompatibleModel(
      resolvedBase.baseURL,
      cfg.apiKey,
      requestedModelId,
      getPreferredFamily(model),
      resolvedBase.availableModels
    );
    const attemptedModelIds: string[] = [];
    let resolvedModelId = resolved.resolvedModelId;
    let result: AnalysisResult | null = null;
    let lastError: unknown = null;

    for (const candidateModelId of resolved.orderedModelIds) {
      attemptedModelIds.push(candidateModelId);

      try {
        result = await callOpenAiCompatible({
          baseURL: resolvedBase.baseURL,
          apiKey: cfg.apiKey,
          modelId: candidateModelId,
          resume,
          knowledgeContext,
          providerName: MODEL_LABEL[model],
        });
        resolvedModelId = candidateModelId;
        break;
      } catch (error) {
        lastError = error;
        if (!shouldRetryWithAnotherModel(error)) {
          throw error;
        }
      }
    }

    if (!result) {
      if (lastError instanceof Error) throw lastError;
      throw new Error(`${MODEL_LABEL[model]} 当前无可用模型，请更换 API Base URL、API Key 或手动指定可用 model id`);
    }

    return {
      result,
      meta: {
        providerKind: provider,
        requestedModelId,
        resolvedModelId,
        availableModelsSample: resolved.availableModelsSample,
        fallbackFromModelId: resolvedModelId !== resolved.resolvedModelId ? resolved.resolvedModelId : undefined,
        attemptedModelIds,
      },
    };
  }

  throw new Error(`不支持的模型：${model}`);
}

export function getModelLabel(model: SupportedModel) {
  return MODEL_LABEL[model] || model;
}
