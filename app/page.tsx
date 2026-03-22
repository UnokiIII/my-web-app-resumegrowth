'use client';

import { useState } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/lib/mock-data';
import ReportView from '@/components/ReportView';

interface AnalysisMeta {
  providerKind: 'openai-compatible' | 'openai-native' | 'anthropic-native' | 'gemini-native';
  requestedModelId: string;
  resolvedModelId: string;
  availableModelsSample?: string[];
  fallbackFromModelId?: string;
  attemptedModelIds?: string[];
}

type ModelOption = 'qwen3.5-flash' | 'custom';
const FRONTEND_VERSION = process.env.NEXT_PUBLIC_FRONTEND_VERSION || 'local-dev';

async function extractPdfTextInBrowser(file: File) {
  const pdfjs = await import('pdfjs-dist/webpack.mjs');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  try {
    const pages = Math.min(pdf.numPages, 3);
    const chunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();

      if (text) {
        chunks.push(text);
      }
    }

    return chunks.join('\n').trim();
  } finally {
    if (typeof pdf.destroy === 'function') {
      pdf.destroy();
    }
  }
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('qwen3.5-flash');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);
  const [reportFileName, setReportFileName] = useState<string | null>(null);

  const isCustomModel = selectedModel === 'custom';
  const backendModel = isCustomModel ? 'claude-4.6-opus' : 'qwen3.5-flash';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
  };

  const analyzeResume = async () => {
    if (!selectedFile) {
      setError('请先上传简历文件');
      return;
    }

    if (isCustomModel && (!apiBaseUrl.trim() || !apiKey.trim())) {
      setError('使用自定义模型时，请先填写 API Base URL 和 API Key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('model', backendModel);

      const isPdf = selectedFile.type.includes('pdf') || selectedFile.name.toLowerCase().endsWith('.pdf');
      let extractedPdfText = '';

      if (isPdf) {
        try {
          extractedPdfText = await extractPdfTextInBrowser(selectedFile);
          if (extractedPdfText.trim().length >= 30) {
            formData.append('extractedText', extractedPdfText.trim());
            formData.append('fileName', selectedFile.name);
            formData.append('fileType', selectedFile.type || 'application/pdf');
          }
        } catch (browserPdfError) {
          console.warn('[client] pdf text extraction failed', browserPdfError);
        }
      }

      if (!isPdf || extractedPdfText.trim().length < 30) {
        formData.append('file', selectedFile);
      }

      if (isCustomModel) {
        formData.append('apiBaseUrl', apiBaseUrl.trim());
        formData.append('apiKey', apiKey.trim());
        formData.append('modelId', modelId.trim());
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const raw = await response.text();
      let payload: any = null;

      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error('分析接口返回异常，请稍后重试');
      }

      if (!response.ok) {
        throw new Error(payload?.error || '分析失败，请稍后重试');
      }

      setResult(payload.result);
      setAnalysisMeta(payload.analysisMeta || null);
      setReportFileName(selectedFile.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败，请稍后重试';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (result) {
    return (
      <ReportView
        result={result}
        analysisMeta={analysisMeta}
        reportFileName={reportFileName}
        onReset={() => {
          setResult(null);
          setReportFileName(null);
        }}
      />
    );
  }

  const features = [
    { icon: TrendingUp, title: '优势资产识别', desc: '找出最容易变现的能力与经历，减少试错。' },
    { icon: Zap, title: '多模型接入', desc: '支持内置模型与外部 OpenAI 兼容接口。' },
    { icon: ArrowRight, title: '执行路线图', desc: '从定位到90天任务清单，直接照着做。' },
    { icon: Shield, title: '安全中转', desc: '默认只本次请求使用，不保存你填写的 API Key。' },
  ];

  return (
    <main className="min-h-screen bg-[#0b0d12] text-white">
      <div className="fixed right-4 top-4 z-50 rounded-2xl border border-amber-400/35 bg-[#16120a]/90 px-4 py-2 text-xs text-amber-100 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/75">Frontend Version</div>
        <div className="mt-1 font-mono text-sm font-semibold text-amber-50">{FRONTEND_VERSION}</div>
      </div>
      <section className="px-6 pb-16 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
            <Sparkles className="h-4 w-4" />
            一人企业简历分析引擎
          </div>

          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            上传你的简历
            <br />
            获取你的一人企业成长方案
          </h1>

          <p className="mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
            基于你的经历与技能，AI 为你定制专属的商业化路径。
            <br className="hidden sm:block" />
            从优势资产盘点到 90 天执行清单，每一步都清晰可执行。
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/75">
            {['结构化报告', '多模型原生/兼容接入', '可落地行动清单'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
            <div className="mb-4 text-sm font-medium text-white/90">第一步：选择模型</div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedModel('qwen3.5-flash')}
                className={cn(
                  'block w-full rounded-2xl border px-4 py-4 text-left transition-all',
                  selectedModel === 'qwen3.5-flash'
                    ? 'border-white/40 bg-white/14'
                    : 'border-white/12 bg-transparent hover:border-white/25 hover:bg-white/[0.04]'
                )}
              >
                <div className="text-base font-medium text-white">Qwen 3.5 Plus</div>
                <div className="mt-1 text-sm text-white/55">内置模型，无需填写任何配置</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('custom')}
                className={cn(
                  'block w-full rounded-2xl border px-4 py-4 text-left transition-all',
                  selectedModel === 'custom'
                    ? 'border-white/40 bg-white/14'
                    : 'border-white/12 bg-transparent hover:border-white/25 hover:bg-white/[0.04]'
                )}
              >
                <div className="text-base font-medium text-white">自定义模型</div>
                <div className="mt-1 text-sm text-white/55">Claude 4.6 Opus / GPT5.4 / Gemini3.1</div>
              </button>
            </div>

            {isCustomModel && (
              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div>
                  <label className="mb-1.5 block text-xs text-white/60">API Base URL</label>
                  <input
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://your-gateway.com/v1"
                    className="w-full rounded-xl border border-white/12 bg-[#12151d] px-3 py-3 text-sm text-white outline-none focus:border-white/30"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    OpenAI 例：https://api.openai.com/v1 ｜ Claude 例：https://api.anthropic.com/v1 ｜ Gemini 例：https://generativelanguage.googleapis.com/v1beta
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-white/60">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-white/12 bg-[#12151d] px-3 py-3 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-white/60">Model ID（可选）</label>
                  <input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="可留空，或填写你习惯的模型名"
                    className="w-full rounded-xl border border-white/12 bg-[#12151d] px-3 py-3 text-sm text-white outline-none focus:border-white/30"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    系统会根据 API 地址和 Key 自动获取可用模型，并匹配最接近的实际 model id。分析结果页会显示：你填写的模型名 → 实际调用的模型名。
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
            <div className="mb-4 text-sm font-medium text-white/90">第二步：上传简历</div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="mb-2 block text-sm text-white/75">选择文件（PDF / DOCX / TXT）</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-xl border border-white/12 bg-[#12151d] px-3 py-3 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
              />
            </div>

            <div
              className={cn(
                'mt-4 rounded-2xl border px-4 py-4',
                selectedFile ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02]'
              )}
            >
              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-emerald-300" />
                  <div>
                    <div className="text-sm font-medium text-emerald-200">已上传完成</div>
                    <div className="text-xs text-emerald-200/70">{selectedFile.name}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-white/50">
                  <Upload className="h-5 w-5" />
                  <div className="text-sm">尚未上传文件</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={analyzeResume}
              disabled={!selectedFile || isAnalyzing}
              className={cn(
                'mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-medium transition-all',
                selectedFile && !isAnalyzing
                  ? 'bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90'
                  : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/35'
              )}
            >
              {isAnalyzing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  正在分析，可能需要1～3分钟...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始分析
                </>
              )}
            </button>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">你会拿到什么</h2>
          <p className="mb-10 text-white/60">简洁但完整的增长建议，从“我是谁”到“下一步做什么”。</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-medium">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
