import { AnalysisResult, ResumeData, generateMockAnalysis } from './mock-data';

export type SupportedModel = 'qwen3-max' | 'claude-4-opus';

const MODEL_LABEL: Record<SupportedModel, string> = {
  'qwen3-max': 'Qwen 3 Max',
  'claude-4-opus': 'Claude 4 Opus',
};

function buildPrompt(resume: ResumeData) {
  return `你是一位“一人企业战略顾问”。
请基于下面的简历结构化信息，输出 AnalysisResult 的 JSON（仅 JSON，不要 markdown，不要解释）。

要求：
1) 内容必须个性化，引用输入里的具体信息。
2) 全部中文。
3) 字段结构必须严格匹配：
{
  "assets": [{"name":"string","potential":1-5,"evidence":"string","product":"string"}],
  "positioning": {"primary":"string","alternativeA":"string","alternativeB":"string"},
  "growthPath": [{"phase":"string","duration":"string","goal":"string","actions":["string"],"milestone":"string"}],
  "revenueModel": [{"phase":"string","product":"string","pricing":"string","target":"string","expectedIncome":"string"}],
  "risks": [{"point":"string","warning":"string","solution":"string"}],
  "checklist": [{"week":"string","tasks":["string"]}]
}

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
  };
}

async function analyzeWithQwen(resume: ResumeData): Promise<AnalysisResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法调用 Qwen 3 Max');
  }

  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.QWEN_MODEL || 'qwen3-max',
      temperature: 0.3,
      messages: [
        { role: 'system', content: '你是资深一人企业战略顾问，严格输出 JSON。' },
        { role: 'user', content: buildPrompt(resume) },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Qwen 请求失败：${resp.status} ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Qwen 返回为空');

  const fallback = generateMockAnalysis(resume);
  const parsed = JSON.parse(extractFirstJson(content));
  return normalizeResult(parsed, fallback);
}

async function analyzeWithClaude(resume: ResumeData): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 ANTHROPIC_API_KEY，无法调用 Claude 4 Opus');
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-opus-4-1',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{ role: 'user', content: buildPrompt(resume) }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude 请求失败：${resp.status} ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.content?.find((x: any) => x.type === 'text')?.text;
  if (!content) throw new Error('Claude 返回为空');

  const fallback = generateMockAnalysis(resume);
  const parsed = JSON.parse(extractFirstJson(content));
  return normalizeResult(parsed, fallback);
}

export async function analyzeResumeByModel(model: SupportedModel, resume: ResumeData): Promise<AnalysisResult> {
  if (model === 'qwen3-max') return analyzeWithQwen(resume);
  if (model === 'claude-4-opus') return analyzeWithClaude(resume);
  throw new Error(`不支持的模型：${model}`);
}

export function getModelLabel(model: SupportedModel) {
  return MODEL_LABEL[model] || model;
}
