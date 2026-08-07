'use client';

import { useEffect, useState } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle2,
  Check,
  ChevronDown,
  HelpCircle,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  X,
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
const ANALYZE_REQUEST_TIMEOUT_MS = 115_000;
const PDF_EXTRACT_TIMEOUT_MS = 10_000;
const PDF_RENDER_SCALE = 0.55;
const PDF_MAX_PAGES = 2;
const PDF_MAX_LONG_EDGE = 1_500;
const PDF_SLICE_MAX_HEIGHT = 1_100;
const PDF_SLICE_OVERLAP = 64;
const PDF_WHITE_THRESHOLD = 245;
const PDF_JPEG_QUALITY = 0.62;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_EXTENSIONS = ['.pdf', '.docx', '.txt'];

type FlowStatus = 'idle' | 'modelSelected' | 'fileSelected' | 'validating' | 'analyzing' | 'error';

function trackConversionEvent(
  name: string,
  payload: Record<string, string | number | boolean> = {}
) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('resumegrowth:conversion', {
      detail: { name, payload },
    })
  );

  const gtag = (window as Window & {
    gtag?: (event: string, eventName: string, params?: Record<string, unknown>) => void;
  }).gtag;

  if (typeof gtag === 'function') {
    gtag('event', name, payload);
  }
}

function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function trimCanvasWhitespace(source: HTMLCanvasElement) {
  const context = source.getContext('2d');
  if (!context) return source;

  const { width, height } = source;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const alpha = data[index + 3];
      const isBlank =
        alpha === 0 || (r >= PDF_WHITE_THRESHOLD && g >= PDF_WHITE_THRESHOLD && b >= PDF_WHITE_THRESHOLD);

      if (isBlank) continue;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) {
    return source;
  }

  const padding = 12;
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(width, right + padding + 1);
  const cropBottom = Math.min(height, bottom + padding + 1);
  const cropWidth = cropRight - cropLeft;
  const cropHeight = cropBottom - cropTop;

  if (cropWidth >= width && cropHeight >= height) {
    return source;
  }

  const cropped = createCanvas(cropWidth, cropHeight);
  const croppedContext = cropped.getContext('2d');
  if (!croppedContext) return source;

  croppedContext.fillStyle = '#ffffff';
  croppedContext.fillRect(0, 0, cropWidth, cropHeight);
  croppedContext.drawImage(source, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return cropped;
}

function resizeCanvasLongEdge(source: HTMLCanvasElement, maxLongEdge: number) {
  const longEdge = Math.max(source.width, source.height);
  if (longEdge <= maxLongEdge) {
    return source;
  }

  const ratio = maxLongEdge / longEdge;
  const resized = createCanvas(source.width * ratio, source.height * ratio);
  const context = resized.getContext('2d');
  if (!context) return source;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, resized.width, resized.height);
  context.drawImage(source, 0, 0, resized.width, resized.height);
  return resized;
}

function sliceCanvasForOcr(source: HTMLCanvasElement) {
  if (source.height <= PDF_SLICE_MAX_HEIGHT) {
    return [source];
  }

  const slices: HTMLCanvasElement[] = [];
  let offsetY = 0;
  const maxSlices = PDF_MAX_PAGES * 2;

  while (offsetY < source.height && slices.length < maxSlices) {
    const sliceHeight = Math.min(PDF_SLICE_MAX_HEIGHT, source.height - offsetY);
    const slice = createCanvas(source.width, sliceHeight);
    const context = slice.getContext('2d');
    if (!context) break;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(source, 0, offsetY, source.width, sliceHeight, 0, 0, source.width, sliceHeight);
    slices.push(slice);

    if (offsetY + sliceHeight >= source.height) {
      break;
    }

    offsetY += sliceHeight - PDF_SLICE_OVERLAP;
  }

  return slices.length ? slices : [source];
}

async function extractPdfTextInBrowser(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  try {
    const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
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

async function extractPdfTextInBrowserWithTimeout(file: File) {
  return Promise.race([
    extractPdfTextInBrowser(file),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error(`PDF 浏览器预提取超时，已等待 ${Math.round(PDF_EXTRACT_TIMEOUT_MS / 1000)} 秒。`)), PDF_EXTRACT_TIMEOUT_MS)
    ),
  ]);
}

async function renderPdfPagesInBrowser(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  try {
    const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
    const images: string[] = [];

    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        continue;
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;

      const croppedCanvas = trimCanvasWhitespace(canvas);
      const resizedCanvas = resizeCanvasLongEdge(croppedCanvas, PDF_MAX_LONG_EDGE);
      const slices = sliceCanvasForOcr(resizedCanvas);

      for (const slice of slices) {
        const dataUrl = slice.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
        if (dataUrl) {
          images.push(dataUrl);
        }
      }
    }

    return images;
  } finally {
    if (typeof pdf.destroy === 'function') {
      pdf.destroy();
    }
  }
}

function LegacyHome() {
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
      let renderedPdfImages: string[] = [];

      if (isPdf) {
        try {
          extractedPdfText = await extractPdfTextInBrowserWithTimeout(selectedFile);
          if (extractedPdfText.trim().length >= 30) {
            formData.append('extractedText', extractedPdfText.trim());
            formData.append('fileName', selectedFile.name);
            formData.append('fileType', selectedFile.type || 'application/pdf');
          }
        } catch (browserPdfError) {
          console.warn('[client] pdf text extraction skipped, fallback to file upload', browserPdfError);
        }

        if (extractedPdfText.trim().length < 30) {
          try {
            renderedPdfImages = await renderPdfPagesInBrowser(selectedFile);
            if (renderedPdfImages.length) {
              formData.append('fileName', selectedFile.name);
              formData.append('fileType', selectedFile.type || 'application/pdf');
            }
            renderedPdfImages.forEach((image) => {
              formData.append('pdfImages', image);
            });
          } catch (browserPdfRenderError) {
            console.warn('[client] pdf image rendering skipped, fallback to server rendering', browserPdfRenderError);
          }
        }
      }

      const hasClientPdfPayload = extractedPdfText.trim().length >= 30 || renderedPdfImages.length > 0;

      if (!isPdf || !hasClientPdfPayload) {
        formData.append('file', selectedFile);
      }

      if (isCustomModel) {
        formData.append('apiBaseUrl', apiBaseUrl.trim());
        formData.append('apiKey', apiKey.trim());
        formData.append('modelId', modelId.trim());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYZE_REQUEST_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`分析超时，已等待 ${Math.round(ANALYZE_REQUEST_TIMEOUT_MS / 1000)} 秒。请重试，或优先上传 DOCX。`);
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

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
    <main className="min-h-screen overflow-x-hidden bg-[#0b0d12] text-white">
      <div className="pointer-events-none fixed right-3 top-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-amber-400/35 bg-[#16120a]/90 px-3 py-2 text-[11px] text-amber-100 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:right-4 sm:top-4 sm:max-w-none sm:px-4 sm:text-xs">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/75">Frontend Version</div>
        <div className="mt-1 font-mono text-sm font-semibold text-amber-50">{FRONTEND_VERSION}</div>
      </div>
      <section className="px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
            <Sparkles className="h-4 w-4" />
            一人企业简历分析引擎
          </div>

          <h1 className="max-w-4xl text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            上传你的简历
            <br />
            获取你的一人企业成长方案
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:mt-6 sm:text-lg">
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

      <section className="px-4 pb-10 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-7">
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
              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
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

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-7">
            <div className="mb-4 text-sm font-medium text-white/90">第二步：上传简历</div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="mb-2 block text-sm text-white/75">选择文件（PDF / DOCX / TXT）</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                className="block w-full min-w-0 cursor-pointer rounded-xl border border-white/12 bg-[#12151d] px-3 py-3 text-sm text-white outline-none file:mr-3 file:max-w-[7.5rem] file:overflow-hidden file:text-ellipsis file:whitespace-nowrap file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
              />
            </div>

            <div
              className={cn(
                'mt-4 rounded-2xl border px-4 py-4',
                selectedFile ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02]'
              )}
            >
              {selectedFile ? (
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 text-emerald-300" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-emerald-200">已上传完成</div>
                    <div className="break-all text-xs text-emerald-200/70">{selectedFile.name}</div>
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

      <section className="px-4 py-14 sm:px-6 sm:py-20">
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

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('modelSelected');
  const [analysisStage, setAnalysisStage] = useState('正在准备分析');

  const isCustomModel = selectedModel === 'custom';
  const backendModel = isCustomModel ? 'claude-4.6-opus' : 'qwen3.5-flash';

  useEffect(() => {
    trackConversionEvent('page_view');
  }, []);

  const selectModel = (model: ModelOption) => {
    setSelectedModel(model);
    setError(null);
    setFlowStatus(selectedFile ? 'fileSelected' : 'modelSelected');
    trackConversionEvent('model_selected', { model });
  };

  const acceptFile = (file: File | undefined) => {
    if (!file) return;

    const extension = getFileExtension(file.name);
    if (!ACCEPTED_FILE_EXTENSIONS.includes(extension)) {
      setSelectedFile(null);
      setFlowStatus('error');
      setError('暂不支持这个文件格式，请上传 PDF、DOCX 或 TXT 文件。');
      trackConversionEvent('upload_error', { reason: 'unsupported_format', extension: extension || 'unknown' });
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setSelectedFile(null);
      setFlowStatus('error');
      setError('文件不能超过 10 MB，请压缩后再试。');
      trackConversionEvent('upload_error', { reason: 'file_too_large' });
      return;
    }

    setSelectedFile(file);
    setError(null);
    setFlowStatus('fileSelected');
    trackConversionEvent('upload_success', { extension, size_mb: Number((file.size / (1024 * 1024)).toFixed(2)) });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    setFlowStatus('modelSelected');
  };

  const analyzeResume = async () => {
    if (!selectedFile) {
      setFlowStatus('error');
      setError('请先上传简历文件。');
      trackConversionEvent('upload_error', { reason: 'missing_file' });
      return;
    }

    if (isCustomModel && (!apiBaseUrl.trim() || !apiKey.trim())) {
      setFlowStatus('error');
      setError('使用自定义模型时，请先填写 API Base URL 和 API Key。');
      trackConversionEvent('analysis_error', { reason: 'missing_custom_config' });
      return;
    }

    setIsAnalyzing(true);
    setFlowStatus('validating');
    setError(null);
    setAnalysisStage('正在读取你的经历');
    trackConversionEvent('analysis_started', { model: backendModel, extension: getFileExtension(selectedFile.name) });

    try {
      const formData = new FormData();
      formData.append('model', backendModel);

      const isPdf = selectedFile.type.includes('pdf') || selectedFile.name.toLowerCase().endsWith('.pdf');
      let extractedPdfText = '';
      let renderedPdfImages: string[] = [];

      if (isPdf) {
        try {
          extractedPdfText = await extractPdfTextInBrowserWithTimeout(selectedFile);
          if (extractedPdfText.trim().length >= 30) {
            formData.append('extractedText', extractedPdfText.trim());
            formData.append('fileName', selectedFile.name);
            formData.append('fileType', selectedFile.type || 'application/pdf');
          }
        } catch (browserPdfError) {
          console.warn('[client] pdf text extraction skipped, fallback to file upload', browserPdfError);
        }

        if (extractedPdfText.trim().length < 30) {
          setAnalysisStage('正在处理 PDF 页面');
          try {
            renderedPdfImages = await renderPdfPagesInBrowser(selectedFile);
            if (renderedPdfImages.length) {
              formData.append('fileName', selectedFile.name);
              formData.append('fileType', selectedFile.type || 'application/pdf');
            }
            renderedPdfImages.forEach((image) => formData.append('pdfImages', image));
          } catch (browserPdfRenderError) {
            console.warn('[client] pdf image rendering skipped, fallback to server rendering', browserPdfRenderError);
          }
        }
      }

      const hasClientPdfPayload = extractedPdfText.trim().length >= 30 || renderedPdfImages.length > 0;
      if (!isPdf || !hasClientPdfPayload) formData.append('file', selectedFile);

      if (isCustomModel) {
        formData.append('apiBaseUrl', apiBaseUrl.trim());
        formData.append('apiKey', apiKey.trim());
        formData.append('modelId', modelId.trim());
      }

      setFlowStatus('analyzing');
      setAnalysisStage('正在识别优势资产与商业化方向');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYZE_REQUEST_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`分析超时，已等待 ${Math.round(ANALYZE_REQUEST_TIMEOUT_MS / 1000)} 秒。请重试，或优先上传 DOCX。`);
        }
        throw new Error('网络连接失败，请检查网络后重试。');
      } finally {
        clearTimeout(timeoutId);
      }

      const raw = await response.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error('分析接口返回异常，请稍后重试。');
      }

      if (!response.ok) {
        throw new Error(payload?.error || '分析失败，请稍后重试。');
      }

      trackConversionEvent('analysis_success', { model: backendModel });
      setResult(payload.result);
      setAnalysisMeta(payload.analysisMeta || null);
      setReportFileName(selectedFile.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败，请稍后重试。';
      setError(message);
      setFlowStatus('error');
      trackConversionEvent('analysis_error', { model: backendModel });
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
          setSelectedFile(null);
          setFlowStatus('modelSelected');
        }}
      />
    );
  }

  const featureCards = [
    { icon: TrendingUp, title: '找到主定位', desc: '从经历与技能中识别最值得优先验证的商业化方向。' },
    { icon: ArrowRight, title: '明确第一单', desc: '把抽象优势拆成具体的服务、客户与行动入口。' },
    { icon: Clock3, title: '规划 90 天', desc: '按周拆解验证、交付、获客与复盘任务。' },
    { icon: ShieldCheck, title: '守住隐私', desc: '简历只用于本次分析，统计事件不包含简历正文。' },
  ];

  const reportPreview = [
    ['主定位', '知识型服务顾问'],
    ['第一单打法', '用一次小型诊断换取真实反馈'],
    ['90 天节奏', '定位 → 验证 → 交付 → 复购'],
  ];

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-[#080a0f] text-white">
      <div className="absolute inset-x-0 top-0 -z-0 h-[620px] overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(14,165,233,0.19),transparent_38%),radial-gradient(circle_at_92%_8%,rgba(168,85,247,0.16),transparent_34%)]" />

      <header className="relative z-10 border-b border-white/10 bg-[#080a0f]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="ResumeGrowth 首页">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#080a0f]">R</span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">ResumeGrowth</span>
              <span className="hidden text-[11px] text-white/45 sm:block">把经历变成下一步</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex" aria-label="主导航">
            <a className="transition hover:text-white" href="#preview">你会得到什么</a>
            <a className="transition hover:text-white" href="#steps">使用步骤</a>
            <a className="transition hover:text-white" href="#trust">隐私与安全</a>
            <a className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:border-white/35" href="#start">开始分析</a>
          </nav>
          <a className="rounded-full border border-white/15 px-3 py-2 text-xs text-white md:hidden" href="#start">开始分析</a>
        </div>
      </header>

      <section className="relative z-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div className="pt-2 lg:pt-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3.5 py-2 text-xs font-medium text-cyan-100 sm:text-sm">
              <Sparkles className="h-4 w-4" />
              一人企业成长方案生成器
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              把你的经历，
              <span className="block bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-transparent">变成一条可执行的路。</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/65 sm:text-lg">
              上传一份简历，AI 会帮你梳理主定位、备选方向、第一单打法，以及接下来 90 天应该做什么。
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5 text-xs text-white/65 sm:text-sm">
              {['不只看职位', '给出商业化方向', '直接拆成行动清单'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-cyan-200" />
                  {item}
                </span>
              ))}
            </div>
            <a href="#start" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#080a0f] shadow-[0_16px_50px_rgba(255,255,255,0.14)] transition hover:bg-cyan-50">
              免费生成我的成长方案
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-4 text-xs text-white/40">支持 PDF、DOCX、TXT · 默认使用内置模型 · 无需注册</p>
          </div>

          <div id="start" className="scroll-mt-24 rounded-[30px] border border-white/15 bg-white/[0.065] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Start here</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">生成你的专属方案</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">两步完成，分析通常需要 1–3 分钟。</p>
              </div>
              <div className="hidden rounded-2xl border border-white/10 bg-black/20 p-3 text-right sm:block">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">你的输入</div>
                <div className="mt-1 text-sm font-semibold text-white/85">1 份简历</div>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void analyzeResume();
              }}
              data-flow-status={flowStatus}
              className="space-y-5"
              aria-describedby={error ? 'analysis-error' : undefined}
            >
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-white/85">1. 选择分析模型</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="分析模型">
                  <label className="group cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="qwen3.5-flash"
                      checked={selectedModel === 'qwen3.5-flash'}
                      onChange={() => selectModel('qwen3.5-flash')}
                      className="peer sr-only"
                    />
                    <span className="block rounded-2xl border border-white/12 bg-black/10 p-4 transition group-hover:border-white/30 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200 peer-checked:border-cyan-100/60 peer-checked:bg-cyan-100/10">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">内置模型</span>
                        <span className="rounded-full bg-cyan-100/10 px-2 py-1 text-[10px] text-cyan-100">推荐</span>
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-white/50">Qwen 3.5 Plus，无需填写任何配置</span>
                    </span>
                  </label>
                  <label className="group cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="custom"
                      checked={selectedModel === 'custom'}
                      onChange={() => selectModel('custom')}
                      className="peer sr-only"
                    />
                    <span className="block rounded-2xl border border-white/12 bg-black/10 p-4 transition group-hover:border-white/30 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-200 peer-checked:border-violet-200/60 peer-checked:bg-violet-200/10">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">自定义模型</span>
                        <span className="text-[10px] text-white/40">高级</span>
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-white/50">适用于 Claude、GPT、Gemini 等兼容接口</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {isCustomModel && (
                <div className="space-y-3 rounded-2xl border border-violet-200/20 bg-violet-200/[0.06] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-100"><LockKeyhole className="h-4 w-4" />自定义模型配置</div>
                  <div>
                    <label htmlFor="api-base-url" className="mb-1.5 block text-xs text-white/65">API Base URL</label>
                    <input id="api-base-url" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://your-gateway.com/v1" autoComplete="url" className="w-full rounded-xl border border-white/12 bg-[#10131a] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-100/60 focus:ring-2 focus:ring-cyan-100/20" />
                  </div>
                  <div>
                    <label htmlFor="api-key" className="mb-1.5 block text-xs text-white/65">API Key</label>
                    <input id="api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="仅用于本次请求" autoComplete="off" className="w-full rounded-xl border border-white/12 bg-[#10131a] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-100/60 focus:ring-2 focus:ring-cyan-100/20" />
                  </div>
                  <div>
                    <label htmlFor="model-id" className="mb-1.5 block text-xs text-white/65">模型名称 <span className="font-normal text-white/35">（可选）</span></label>
                    <input id="model-id" value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="例如 claude-sonnet-4-6" autoComplete="off" className="w-full rounded-xl border border-white/12 bg-[#10131a] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-100/60 focus:ring-2 focus:ring-cyan-100/20" />
                  </div>
                </div>
              )}

              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-white/85">2. 上传简历</legend>
                <label
                  htmlFor="resume-upload"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  className="group block cursor-pointer rounded-2xl border border-dashed border-cyan-100/35 bg-cyan-100/[0.04] p-5 text-center transition hover:border-cyan-100/70 hover:bg-cyan-100/[0.08] focus-within:ring-2 focus-within:ring-cyan-100"
                >
                  <input id="resume-upload" name="resume" type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} className="sr-only" aria-describedby="resume-upload-help" />
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100/10 text-cyan-100 transition group-hover:scale-105"><Upload className="h-5 w-5" /></span>
                  <span className="mt-3 block text-sm font-semibold">点击选择或拖拽文件到这里</span>
                  <span id="resume-upload-help" className="mt-1 block text-xs leading-5 text-white/45">支持 PDF / DOCX / TXT，单个文件不超过 10 MB</span>
                </label>
              </fieldset>

              <div aria-live="polite" className="min-h-[70px] rounded-2xl border border-white/10 bg-black/15 p-4">
                {selectedFile ? (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-emerald-100">文件已准备好</p>
                      <p className="mt-1 truncate text-xs text-white/50">{selectedFile.name} · {formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button type="button" onClick={clearFile} className="rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="移除已选文件"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-white/45"><FileText className="h-5 w-5" /><span className="text-sm">上传后会在这里显示文件状态</span></div>
                )}
              </div>

              {error && <p id="analysis-error" role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2.5 text-sm leading-6 text-rose-100">{error}</p>}

              <button type="submit" disabled={!selectedFile || isAnalyzing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-[#080a0f] shadow-[0_16px_50px_rgba(255,255,255,0.12)] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none">
                {isAnalyzing ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />{analysisStage}</> : <><Sparkles className="h-4 w-4" />开始分析</>}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/40"><Shield className="h-3.5 w-3.5" />不会把简历正文写入转化统计</p>
            </form>
          </div>
        </div>
      </section>

      <section id="preview" className="relative z-10 border-y border-white/10 bg-white/[0.025] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">A clearer next step</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">不是一份泛泛的职业测评，而是一份执行版成长方案。</h2>
            <p className="mt-5 max-w-lg leading-8 text-white/55">你会看到从“我是谁”到“我先卖什么”的完整推导，并且知道这一周就可以开始验证哪一件事。</p>
          </div>
          <div className="rounded-[28px] border border-white/15 bg-[#10131b] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/60">示例报告预览</p><h3 className="mt-1 text-lg font-semibold">你的成长路线图</h3></div><span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[10px] text-emerald-100">Demo</span></div>
            <div className="space-y-3">
              {reportPreview.map(([label, value], index) => <div key={label} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cyan-100/10 text-xs font-bold text-cyan-100">0{index + 1}</span><div><p className="text-xs text-white/40">{label}</p><p className="mt-1 text-sm font-medium text-white/85">{value}</p></div></div>)}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/40">你会知道</p><p className="mt-2 text-sm font-medium">优先服务谁、解决什么问题</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/40">你会开始做</p><p className="mt-2 text-sm font-medium">一套能获得反馈的最小行动</p></div></div>
          </div>
        </div>
      </section>

      <section id="steps" className="relative z-10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100/70">Simple by design</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">三步，从经历走到行动。</h2><p className="mt-4 leading-8 text-white/55">把复杂的定位与商业化问题拆成一个可以马上开始的流程。</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[['01', '选择模型', '默认使用内置模型；如果你有自己的 API，也可以切换到自定义模型。'], ['02', '上传简历', '支持 PDF、DOCX 和 TXT。系统会先提取经历与技能，再交给模型分析。'], ['03', '拿到路线图', '从主定位到第一单打法，再到 90 天任务，按优先级直接行动。']].map(([number, title, desc]) => <div key={number} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><span className="text-sm font-bold text-cyan-100/80">{number}</span><h3 className="mt-6 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-white/55">{desc}</p></div>)}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, desc }) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><Icon className="h-5 w-5 text-cyan-100" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{desc}</p></div>)}
          </div>
        </div>
      </section>

      <section id="trust" className="relative z-10 border-y border-white/10 bg-[#0d1017] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100/10 text-cyan-100"><LockKeyhole className="h-5 w-5" /></div><h2 className="mt-5 text-3xl font-semibold tracking-tight">先把安全说清楚。</h2><p className="mt-4 leading-8 text-white/55">你的简历只用于生成这一次成长方案。我们不会把简历正文放进转化统计，也不会在页面上展示你的 API Key。</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['文件处理', '仅用于本次分析请求，分析完成后页面不保留上传入口中的文件对象。'], ['自定义模型', 'API Base URL、Key 和模型名只随本次请求发送，不进入统计事件。'], ['示例内容', '页面展示的路线图是演示内容，不代表任何真实用户结果。'], ['失败可重试', '解析失败、网络超时或模型失败时，会给出文字提示并允许重新上传。']].map(([title, desc]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><HelpCircle className="h-4 w-4 text-cyan-100" />{title}</div><p className="mt-3 text-sm leading-6 text-white/50">{desc}</p></div>)}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">FAQ</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">开始前，你可能想知道</h2></div><div className="mt-8 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.03] px-5">{[['我没有明确的创业方向，也能用吗？', '可以。分析会从你的经历、技能和可迁移资产出发，先给出主定位与备选路径，再把方向拆成可验证的第一步。'], ['支持哪些文件？', '目前支持 PDF、DOCX 和 TXT，单个文件大小限制为 10 MB。扫描版 PDF 可能需要更长的处理时间。'], ['为什么要提供 API Base URL 和 API Key？', '只有在你主动选择自定义模型时才需要填写；默认内置模型不需要任何额外配置。']].map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-white/85"><span>{question}</span><ChevronDown className="h-4 w-4 flex-none text-white/45 transition group-open:rotate-180" /></summary><p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">{answer}</p></details>)}</div></div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white/75">ResumeGrowth</p><p className="mt-1 text-xs">从简历出发，找到下一条可执行的路。</p></div><div className="flex flex-wrap gap-5"><a className="transition hover:text-white" href="#preview">结果示例</a><a className="transition hover:text-white" href="#steps">使用步骤</a><a className="transition hover:text-white" href="#trust">隐私与安全</a><a className="transition hover:text-white" href="#top">回到顶部</a></div></div></footer>
    </main>
  );
}
