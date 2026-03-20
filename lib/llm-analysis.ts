import { AnalysisResult, ResumeData, generateMockAnalysis } from './mock-data';

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

function buildPrompt(resume: ResumeData) {
  return `你不是内容生成器，而是一个"职业路径决策引擎"。
你的任务不是给出好看的建议，而是做出最现实、可执行、可成交的路径判断。
你的目标只有一个：帮助用户在最短时间内完成第一次变现。

一、系统角色定义（必须放最前）
你不是内容生成器，而是一个"职业路径决策引擎"。
你的任务不是给出好看的建议，而是做出最现实、可执行、可成交的路径判断。
你的目标只有一个：帮助用户在最短时间内完成第一次变现。

二、分析输出原则（决策逻辑）
请严格遵循以下原则：

【优先级顺序】
1. 当前职业资本（行业经验、岗位经验、资源）
2. 最近3年可验证成果
3. 最快成交路径（是否30天内可变现）
4. 可复制技能
5. 行业势能
6. 长期天花板

【决策逻辑】
- 优先选择"能立即变现"的路径，而不是理想路径
- 不默认推荐内容/IP路径，必须经过验证才可成立
- 所有建议必须能解释"第一单怎么来"
- 所有产品建议必须能在30天内交付
- 多路径时优先选择成交路径最短的
- 背景较弱时优先推荐服务型路径

【禁止行为】
- 不要泛泛而谈
- 不要推荐长期才能变现的路径（无证据时）
- 不要脱离用户经验建议转型

三、路线类型枚举（Route Pool）
请从以下路线池中进行选择：
[项目制交付型, 标准化服务型, 顾问/咨询型, 代运营型, 渠道销售型, 培训/陪跑型, 资源撮合型, 信息服务/研究型, 工具型产品, 垂直SaaS, 内容/IP型]

四、路线选择规则
【总规则】
所有路线必须参与评估，但优先选择"30天内可变现"的路径。

【选择流程】
1. 筛选符合用户背景的路线
2. 对每条路线评估：
   - 变现速度
   - 经验匹配度
   - 成交路径清晰度
3. 排序优先级：变现速度 > 成交路径 > 匹配度
4. 输出：1个主路线 + 2个备选路线

五、内容/IP型特殊规则
内容/IP型允许参与竞争，但必须满足更高标准：
作为主路线必须满足至少2条：
1. 有持续内容输出（写作/视频/社媒）
2. 有转化或商业化迹象（粉丝/成交）
3. 当前职业与表达/传播强相关
4. 能设计出30天内变现路径
如果不满足：内容/IP只能作为辅助路径，不能作为主路线

六、Resume → Route 判断规则
优先根据"最近3年经验 + 实际做过的工作类型"进行匹配：

1. 销售 / BD / 渠道：→ 渠道销售型 / 资源撮合型 / 顾问型
2. 产品 / 技术 / 数据：→ 工具型产品 / 标准化服务 / SaaS
3. 运营 / 增长：→ 代运营 / 标准化服务 / 陪跑
4. 设计 / 品牌：→ 项目制交付 / 标准化服务 / 模板产品
5. 内容 / 写作：→ 内容/IP（有成果时） / 代运营 / 内容服务
6. 管理 / 高级岗位：→ 顾问 / 培训 / 信息服务
7. 初级 / 无明显技能：→ 标准化服务 / 代运营 / 项目制

核心规则：不跨能力、不跳跃式转型

七、修正规则（强制纠偏）
- 有成果 → 可以升级为顾问/培训
- 有重复工作 → 必须考虑标准化服务
- 有资源 → 必须考虑撮合或渠道
- 有表达能力 → 内容/IP才可参与竞争
- 技术背景 → 必须包含工具/SaaS路径

八、强约束（必须满足）
任何主路线必须满足：
可以明确说明："第一单从哪里来 + 如何成交"
否则不能作为主路线

九、输出结构（风格要求）
输出必须以"路径决策"为核心，而不是内容分析。

必须包含以下内容：
1. 路线结论
   主路线：
   备选路线：

2. 判断逻辑（简洁）
   基于用户的哪些能力 / 经验做出判断
   为什么这个路径最容易变现

3. 路径解释（执行导向）
   第一阶段做什么
   第二阶段如何升级
   第三阶段如何放大

4. 第一单路径（核心）
   目标客户：
   获取方式：
   成交方式：

5. 明确不推荐路径
   不推荐哪些路线：
   原因：

【Assets评估与排序规则 - 强制执行】
assets数组的顺序直接影响用户决策，必须严格按以下规则排序：

排序优先级（从高到低）：
1. 项目交付类（设计、视觉、活动执行、物料制作）
2. 标准化服务类（模板、套餐、可重复服务）
3. 顾问咨询类（培训、陪跑、策略建议）
4. 内容运营类（社媒、粉丝、IP）- 除非有明确商业转化证据，否则必须排最后

强制约束：
- assets[0] 必须是当前最能变现的核心能力（通常是主业/项目经验）
- assets[1] 必须是可延展的第二能力
- 内容运营类能力（含社媒运营、粉丝增长、内容创作）必须放在assets数组末尾
- 粉丝数量、点赞数等不等于变现能力，不能作为排序依据
- 有商业化证据的内容能力（已接单/已变现）可提升至中位，但仍不能排第一

判断标准（按顺序）：
1. 是否可直接交付给客户（设计稿、活动执行、物料）
2. 是否有客户/主办方/雇主付费验证
3. 是否30天内可再次变现
4. 是否有明确成交路径

十、结构化输出（用于前端）
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

最后一条（最重要）
你的输出必须帮助用户做出"可执行决策"，而不是提供分析。
如果不能帮助用户在30天内完成第一单变现，这个方案就是失败的。

输入简历数据：
${JSON.stringify(resume, null, 2)}`;
}

function extractFirstJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('模型返回内容不含 JSON');
  }
  return text.slice(start, end + 1);
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
  if (!list.length) throw new Error('当前 API Key 无可用模型');

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

function parseTextFromOpenAiCompat(data: any) {
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型返回为空');
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
    return `外部模型请求失败：返回了 HTML 而不是 JSON。请检查 API Base URL 是否为接口地址。当前地址：${baseURL}`;
  }

  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message || parsed?.message || short;
    const code = parsed?.error?.code || parsed?.code;

    if (code === 'model_not_found' || /model_not_found/i.test(body) || /No available channel for model/i.test(body)) {
      return `外部模型不可用：该网关当前没有可用的模型通道。provider=${providerName}，modelId=${modelId}，status=${status}。原始信息：${msg}`;
    }

    return `外部模型请求失败：provider=${providerName}，modelId=${modelId}，status=${status}。${msg}`;
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
}) {
  const { url, init, providerName, modelId, baseURL } = params;
  let resp: Response;
  try {
    resp = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(`外部模型网络请求失败：provider=${providerName}，modelId=${modelId}，baseURL=${baseURL}。${message}`);
  }

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(buildProviderError({ providerName, modelId, baseURL, status: resp.status, rawText: text }));
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(buildProviderError({ providerName, modelId, baseURL, status: resp.status, rawText: text }));
  }
}

async function callOpenAiCompatible(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
  providerName: string;
}) {
  const { baseURL, apiKey, modelId, resume, providerName } = params;
  const endpoint = baseURL.replace(/\/$/, '') + '/chat/completions';

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
          { role: 'system', content: '你是职业路径决策引擎，严格输出 JSON。' },
          { role: 'user', content: buildPrompt(resume) },
        ],
      }),
    },
  });

  const content = parseTextFromOpenAiCompat(data);
  const fallback = generateMockAnalysis(resume);
  const parsed = JSON.parse(extractFirstJson(content));
  return normalizeResult(parsed, fallback);
}

async function callOpenAiNative(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
}) {
  return callOpenAiCompatible({ ...params, providerName: 'OpenAI' });
}

async function callAnthropicNative(params: {
  baseURL: string;
  apiKey: string;
  modelId: string;
  resume: ResumeData;
}) {
  const { baseURL, apiKey, modelId, resume } = params;
  const endpoint = baseURL.replace(/\/$/, '') + '/messages';

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
        system: '你是职业路径决策引擎，严格输出 JSON。',
        messages: [{ role: 'user', content: buildPrompt(resume) }],
      }),
    },
  });

  const content = parseAnthropicText(data);
  const fallback = generateMockAnalysis(resume);
  const parsed = JSON.parse(extractFirstJson(content));
  return normalizeResult(parsed, fallback);
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
}) {
  const { baseURL, apiKey, modelId, resume } = params;
  const endpoint = buildGeminiEndpoint(baseURL, modelId, apiKey);

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
            parts: [{ text: `系统要求：你是职业路径决策引擎，严格输出 JSON。\n\n${buildPrompt(resume)}` }],
          },
        ],
      }),
    },
  });

  const content = parseGeminiText(data);
  const fallback = generateMockAnalysis(resume);
  const parsed = JSON.parse(extractFirstJson(content));
  return normalizeResult(parsed, fallback);
}

async function analyzeWithQwen(resume: ResumeData): Promise<AnalysisResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法调用 Qwen 3.5 Flash');
  }

  return callOpenAiCompatible({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey,
    modelId: getDefaultModelId('qwen3.5-flash'),
    resume,
    providerName: 'Qwen',
  });
}

function normalizeComparableModelId(modelId: string) {
  return modelId.toLowerCase().replace(/[._]/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
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

async function fetchOpenAiCompatibleModels(baseURL: string, apiKey: string) {
  const endpoint = baseURL.replace(/\/$/, '') + '/models';
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

async function resolveOpenAiCompatibleModel(baseURL: string, apiKey: string, requestedModelId: string, preferredFamily = '') {
  const requested = requestedModelId.trim();
  try {
    const available = await fetchOpenAiCompatibleModels(baseURL, apiKey);
    if (!available.length) {
      return { resolvedModelId: normalizeModelId(baseURL, requested), availableModelsSample: [] as string[] };
    }

    const exact = available.find((item) => normalizeComparableModelId(item) === normalizeComparableModelId(requested));
    if (exact) {
      return { resolvedModelId: exact, availableModelsSample: available.slice(0, 20) };
    }

    const normalizedAlias = normalizeModelId(baseURL, requested);
    const aliasExact = available.find((item) => normalizeComparableModelId(item) === normalizeComparableModelId(normalizedAlias));
    if (aliasExact) {
      return { resolvedModelId: aliasExact, availableModelsSample: available.slice(0, 20) };
    }

    const scored = available
      .map((item) => ({ item, score: Math.max(scoreModelCandidate(requested, item), scoreModelCandidate(normalizedAlias, item)) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score > 80) {
      return { resolvedModelId: best.item, availableModelsSample: available.slice(0, 20) };
    }

    return { resolvedModelId: normalizedAlias, availableModelsSample: available.slice(0, 20) };
  } catch {
    return { resolvedModelId: normalizeModelId(baseURL, requested), availableModelsSample: [] as string[] };
  }
}

function assertCustomConfig(config: CustomApiConfig, model: SupportedModel) {
  if (!config.baseURL || !config.apiKey) {
    throw new Error(`${MODEL_LABEL[model]} 需要填写 API Base URL 和 API Key`);
  }

  const base = config.baseURL.trim();
  if (!/^https:\/\//i.test(base) && !/^http:\/\/localhost/i.test(base)) {
    throw new Error('API Base URL 必须是 HTTPS（本地测试可用 http://localhost）');
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
  customConfig: CustomApiConfig = {}
): Promise<AnalyzeOutput> {
  if (model === 'qwen3.5-flash') {
    const result = await analyzeWithQwen(resume);
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

    const resolved = await resolveOpenAiCompatibleModel(
      cfg.baseURL,
      cfg.apiKey,
      requestedModelId,
      getPreferredFamily(model)
    );
    const result = await callOpenAiCompatible({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
      modelId: resolved.resolvedModelId,
      resume,
      providerName: MODEL_LABEL[model],
    });

    return {
      result,
      meta: {
        providerKind: provider,
        requestedModelId,
        resolvedModelId: resolved.resolvedModelId,
        availableModelsSample: resolved.availableModelsSample,
      },
    };
  }

  throw new Error(`不支持的模型：${model}`);
}

export function getModelLabel(model: SupportedModel) {
  return MODEL_LABEL[model] || model;
}
