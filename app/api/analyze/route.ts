import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseResumeText } from '@/lib/resume-parser';
import { analyzeResumeByModel, type CustomApiConfig, type SupportedModel } from '@/lib/llm-analysis';
import { buildKnowledgeContext } from '@/lib/knowledge-engine';
import { buildStrategyOptions } from '@/lib/strategy-options';

export const runtime = 'nodejs';
export const maxDuration = 120;

const execFileAsync = promisify(execFile);
const SUPPORTED_MODELS: SupportedModel[] = ['qwen3.5-flash', 'claude-4.6-opus', 'gpt-5.4', 'gemini-3.1'];
const OCR_TIMEOUT_MS = 45_000;
const EXTERNAL_OCR_TIMEOUT_MS = 12_000;
const BAIDU_OCR_TIMEOUT_MS = 12_000;
const OCR_MAX_PAGES = 2;
const OCR_MAX_IMAGES = 4;
const OCR_MIN_PIXELS = 3_072;
const OCR_MAX_PIXELS = 1_048_576;
const OCR_EXTERNAL_MODEL_DEFAULTS = ['claude-opus-4-6', 'claude-opus-4-6-thinking', 'claude-sonnet-4-6'];
let baiduOcrTokenCache: { token: string; expiresAt: number } | null = null;

async function getPdfParseClass() {
  const mod = await import('pdf-parse');
  if (!('PDFParse' in mod) || typeof mod.PDFParse !== 'function') {
    throw new Error('pdf-parse module did not expose PDFParse');
  }
  return mod.PDFParse;
}

function getPythonCandidates() {
  const cwd = process.cwd();

  return process.platform === 'win32'
    ? [
        path.join(cwd, '.venv-ocr', 'Scripts', 'python.exe'),
        path.join(cwd, '.venv-ocr', 'python.exe'),
        'python',
        'py',
      ]
    : [
        path.join(cwd, '.venv-ocr', 'bin', 'python'),
        'python3',
        'python',
      ];
}

async function resolvePythonCommand() {
  for (const candidate of getPythonCandidates()) {
    try {
      const args = candidate === 'py' ? ['-3', '--version'] : ['--version'];
      await execFileAsync(candidate, args, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      });
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('未找到可用的 Python 解释器。');
}

function inferFileType(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type.includes('pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt')) return 'txt';
  if (name.endsWith('.doc')) return 'doc';
  return 'unknown';
}

async function runPyMuPdf(buffer: Buffer, mode: 'text' | 'images') {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-pdf-'));
  const pdfPath = path.join(tmpDir, 'resume.pdf');
  await fs.writeFile(pdfPath, buffer);

  try {
    const pythonBin = await resolvePythonCommand();
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_to_images.py');
    const args =
      pythonBin === 'py'
        ? ['-3', scriptPath, pdfPath, String(OCR_MAX_PAGES), mode]
        : [scriptPath, pdfPath, String(OCR_MAX_PAGES), mode];
    const { stdout, stderr } = await execFileAsync(pythonBin, args, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });

    if (stderr?.trim()) {
      console.warn('[pdf_to_images stderr]', stderr);
    }

    return JSON.parse(stdout);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function extractPdfTextWithPyMuPDF(buffer: Buffer) {
  const payload = await runPyMuPdf(buffer, 'text');
  return typeof payload?.text === 'string' ? payload.text : '';
}

async function renderPdfPagesToImagesWithPyMuPDF(buffer: Buffer) {
  const payload = await runPyMuPdf(buffer, 'images');
  return Array.isArray(payload?.images) ? payload.images : [];
}

async function extractPdfTextWithNode(buffer: Buffer) {
  const PDFParse = await getPdfParseClass();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const payload = await parser.getText({ first: OCR_MAX_PAGES });
    return payload?.text || '';
  } finally {
    await parser.destroy();
  }
}

async function renderPdfPagesToImagesWithNode(buffer: Buffer) {
  const PDFParse = await getPdfParseClass();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const payload = await parser.getScreenshot({
      first: OCR_MAX_PAGES,
      scale: 0.8,
      imageDataUrl: false,
      imageBuffer: true,
    });

    return Array.isArray(payload?.pages)
      ? payload.pages
          .map((page) => {
            if (!page?.data) return null;
            return Buffer.from(page.data).toString('base64');
          })
          .filter((image): image is string => Boolean(image))
      : [];
  } finally {
    await parser.destroy();
  }
}

async function extractEmbeddedPdfImagesWithNode(buffer: Buffer) {
  const PDFParse = await getPdfParseClass();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const payload = await parser.getImage({
      first: OCR_MAX_PAGES,
      imageDataUrl: false,
      imageBuffer: true,
      imageThreshold: 50,
    });

    return Array.isArray(payload?.pages)
      ? payload.pages
          .flatMap((page) => page.images || [])
          .map((image) => {
            if (!image?.data) return null;
            return Buffer.from(image.data).toString('base64');
          })
          .filter((img): img is string => Boolean(img))
      : [];
  } finally {
    await parser.destroy();
  }
}

function getImagePayloadSize(images: string[]) {
  return images.reduce((total, image) => total + image.length, 0);
}

function pickBestPdfImages(renderedImages: string[], embeddedImages: string[]) {
  if (renderedImages.length && embeddedImages.length) {
    return getImagePayloadSize(embeddedImages) <= getImagePayloadSize(renderedImages)
      ? { source: 'embedded', images: embeddedImages }
      : { source: 'rendered', images: renderedImages };
  }

  if (embeddedImages.length) {
    return { source: 'embedded', images: embeddedImages };
  }

  if (renderedImages.length) {
    return { source: 'rendered', images: renderedImages };
  }

  return { source: 'none', images: [] as string[] };
}

function buildOcrVisionContent(image: string) {
  return [
    {
      type: 'text',
      text: '请对这一个简历 PDF 页面做 OCR，只输出提取出的纯文本内容，不要总结，不要解释，不要加 markdown。',
    },
    {
      type: 'image_url',
      image_url: {
        url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
      },
    },
  ];
}

async function ocrImageWithQwen(image: string) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法执行 PDF OCR 兜底。');
  }

  let resp: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.QWEN_OCR_MODEL || 'qwen-vl-ocr',
        temperature: 0,
        messages: [{ role: 'user', content: buildOcrVisionContent(image) }],
      }),
    });
  } catch (error) {
    // @ts-ignore legacy unreachable branch kept for safety
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OCR 请求超时，已等待 ${Math.round(OCR_TIMEOUT_MS / 1000)} 秒。请稍后重试，或改传 DOCX / TXT。`);
    }

    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(buildOcrErrorMessage(message));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OCR 请求失败：${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item: any) => item?.text || '').join('\n');
  }

  return '';
}

function normalizeOcrImage(image: string) {
  if (image.startsWith('data:')) {
    return image;
  }

  return `data:image/jpeg;base64,${image}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function getExternalOcrBaseCandidates(baseURL: string) {
  const trimmed = trimTrailingSlash(baseURL.trim());
  const candidates = [trimmed];

  if (!/\/v\d+(?:[a-z0-9.-]*)?$/i.test(trimmed)) {
    candidates.push(`${trimmed}/v1`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getExternalOcrModelCandidates() {
  const configured = process.env.OCR_EXTERNAL_MODEL_IDS
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return configured?.length ? configured : OCR_EXTERNAL_MODEL_DEFAULTS;
}

function extractOpenAiCompatibleText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => extractOpenAiCompatibleText(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
    if (Array.isArray(content.content)) {
      return extractOpenAiCompatibleText(content.content);
    }
  }

  return '';
}

function looksLikeNonOcrAnswer(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;

  return [
    /二维码/i,
    /无法.*解码/,
    /无法直接解码/,
    /建议您/,
    /很抱歉/,
    /I\s*(?:can|could).{0,20}(?:see|tell)/i,
    /unable to/i,
    /QR\s*Code/i,
  ].some((pattern) => pattern.test(normalized));
}

async function fetchExternalOcrModels(baseURL: string, apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6_000);

  try {
    const resp = await fetch(`${trimTrailingSlash(baseURL)}/models`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    return Array.isArray(data?.data)
      ? data.data
          .map((item: any) => (typeof item?.id === 'string' ? item.id.trim() : ''))
          .filter(Boolean)
      : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ocrImageWithExternalCompatible(image: string) {
  const baseURL = process.env.OCR_EXTERNAL_BASE_URL;
  const apiKey = process.env.OCR_EXTERNAL_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error('未配置 OCR_EXTERNAL_BASE_URL 或 OCR_EXTERNAL_API_KEY。');
  }

  let lastError: Error | null = null;

  for (const baseCandidate of getExternalOcrBaseCandidates(baseURL)) {
    const availableModels = await fetchExternalOcrModels(baseCandidate, apiKey);
    const modelsToTry = availableModels.length
      ? getExternalOcrModelCandidates().filter((modelId) => availableModels.includes(modelId))
      : getExternalOcrModelCandidates();

    for (const modelId of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_OCR_TIMEOUT_MS);

      try {
        const resp = await fetch(`${trimTrailingSlash(baseCandidate)}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            temperature: 0,
            messages: [{ role: 'user', content: buildOcrVisionContent(image) }],
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`external:${modelId}:${resp.status}:${body.slice(0, 160)}`);
        }

        const data = await resp.json();
        const text = extractOpenAiCompatibleText(data?.choices?.[0]?.message?.content).trim();

        if (!looksLikeNonOcrAnswer(text)) {
          return { text, modelId };
        }

        throw new Error(`external:${modelId}:non-ocr-answer`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('外部 OCR 请求失败');
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  throw lastError || new Error('外部 OCR 当前不可用。');
}

function readDashScopeOcrText(data: any) {
  const content = data?.output?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n');
  }

  if (typeof data?.output?.text === 'string') {
    return data.output.text;
  }

  return '';
}

function buildDashScopeOcrBody(image: string) {
  return {
    model: process.env.QWEN_OCR_MODEL || 'qwen-vl-ocr-latest',
    input: {
      messages: [
        {
          role: 'user',
          content: [
            {
              image: normalizeOcrImage(image),
              min_pixels: OCR_MIN_PIXELS,
              max_pixels: OCR_MAX_PIXELS,
              enable_rotate: true,
            },
          ],
        },
      ],
    },
    parameters: {
      ocr_options: {
        task: process.env.QWEN_OCR_TASK || 'text_recognition',
      },
    },
  };
}

async function ocrImageWithDashScopeNative(image: string) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法执行 PDF OCR 兜底。');
  }

  let resp: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildDashScopeOcrBody(image)),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OCR 请求超时，已等待 ${Math.round(OCR_TIMEOUT_MS / 1000)} 秒。请稍后重试，或改传 DOCX / TXT。`);
    }

    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(buildOcrErrorMessage(message));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OCR 请求失败：${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  return readDashScopeOcrText(data).trim();
}

function buildOcrErrorMessage(message: string) {
  if (/fetch failed/i.test(message)) {
    return 'OCR 网络请求失败，请稍后重试；如果持续失败，请检查 DASHSCOPE_API_KEY、QWEN_OCR_MODEL 或当前网络连通性。';
  }
  return message;
}

async function ocrPdfWithQwen(images: string[]) {
  if (!images.length) {
    throw new Error('OCR 兜底失败：PDF 页面图片为空。');
  }

  const selectedImages = images.slice(0, OCR_MAX_IMAGES);
  const chunks: string[] = [];
  let lastError: Error | null = null;

  for (let index = 0; index < selectedImages.length; index += 1) {
    const image = selectedImages[index];
    try {
      let text = '';
      let source = 'dashscope-native';

      try {
        const externalResult = await ocrImageWithExternalCompatible(image);
        text = externalResult.text.trim();
        source = `external:${externalResult.modelId}`;
      } catch (externalError) {
        const message = externalError instanceof Error ? externalError.message : 'external ocr failed';
        console.warn('[analyze] extract:ocr-page:external-fallback', {
          page: index + 1,
          message,
        });

        text = (await ocrImageWithDashScopeNative(image)).trim();
      }

      console.log('[analyze] extract:ocr-page', {
        page: index + 1,
        source,
        length: text.length,
      });

      if (text) {
        chunks.push(text);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OCR 请求失败');
      console.error('[analyze] extract:ocr-page:error', {
        page: index + 1,
        message: lastError.message,
      });
    }
  }

  const mergedText = chunks.join('\n\n').trim();
  if (mergedText) {
    return mergedText;
  }

  if (lastError) {
    throw lastError;
  }

  return '';

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法执行 PDF OCR 兜底。');
  }

  if (!images.length) {
    throw new Error('OCR 兜底失败：PDF 页面图片为空。');
  }

  const visionContent = [
    {
      type: 'text',
      text: '请对这些简历 PDF 页面做 OCR，只输出提取出的纯文本内容。不要总结，不要解释，不要加 markdown，按页面顺序输出。',
    },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: {
        url: img.startsWith('data:') ? img : `data:image/png;base64,${img}`,
      },
    })),
  ];

  let resp: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.QWEN_OCR_MODEL || 'qwen-vl-ocr',
        temperature: 0,
        messages: [{ role: 'user', content: visionContent }],
      }),
    });
  } catch (error: any) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OCR 请求超时，已等待 ${Math.round(OCR_TIMEOUT_MS / 1000)} 秒。请稍后重试，或改传 DOCX / TXT。`);
    }

    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(buildOcrErrorMessage(message));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OCR 请求失败：${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item: any) => item?.text || '').join('\n');
  }

  return '';
}

function normalizeOcrImageV2(image: string) {
  if (image.startsWith('data:')) {
    return image;
  }

  return `data:image/jpeg;base64,${image}`;
}

function stripDataUrlPrefixV2(image: string) {
  const normalized = normalizeOcrImageV2(image);
  const match = normalized.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match?.[1] || normalized;
}

function buildOcrVisionContentV2(image: string) {
  return [
    {
      type: 'text',
      text: '请对这一张简历页面图片做 OCR，只输出提取出的纯文本内容，不要总结，不要解释，也不要添加 markdown。',
    },
    {
      type: 'image_url',
      image_url: {
        url: normalizeOcrImageV2(image),
      },
    },
  ];
}

async function ocrImageWithExternalCompatibleV2(image: string) {
  const baseURL = process.env.OCR_EXTERNAL_BASE_URL;
  const apiKey = process.env.OCR_EXTERNAL_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error('未配置 OCR_EXTERNAL_BASE_URL 或 OCR_EXTERNAL_API_KEY。');
  }

  let lastError: Error | null = null;

  for (const baseCandidate of getExternalOcrBaseCandidates(baseURL)) {
    const availableModels = await fetchExternalOcrModels(baseCandidate, apiKey);
    const modelsToTry = availableModels.length
      ? getExternalOcrModelCandidates().filter((modelId) => availableModels.includes(modelId))
      : getExternalOcrModelCandidates();

    for (const modelId of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_OCR_TIMEOUT_MS);

      try {
        const resp = await fetch(`${trimTrailingSlash(baseCandidate)}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            temperature: 0,
            messages: [{ role: 'user', content: buildOcrVisionContentV2(image) }],
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`external:${modelId}:${resp.status}:${body.slice(0, 160)}`);
        }

        const data = await resp.json();
        const text = extractOpenAiCompatibleText(data?.choices?.[0]?.message?.content).trim();

        if (!looksLikeNonOcrAnswer(text)) {
          return { text, modelId };
        }

        throw new Error(`external:${modelId}:non-ocr-answer`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('外部 OCR 请求失败');
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  throw lastError || new Error('外部 OCR 当前不可用。');
}

async function getBaiduOcrAccessTokenV2() {
  if (baiduOcrTokenCache && Date.now() < baiduOcrTokenCache.expiresAt) {
    return baiduOcrTokenCache.token;
  }

  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('未配置 BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY。');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BAIDU_OCR_TIMEOUT_MS);

  try {
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`百度 OCR token 获取失败：${resp.status} ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    const token = typeof data?.access_token === 'string' ? data.access_token.trim() : '';
    const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : 0;

    if (!token) {
      throw new Error('百度 OCR token 响应缺少 access_token。');
    }

    baiduOcrTokenCache = {
      token,
      expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
    };

    return token;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readBaiduOcrTextV2(data: any) {
  const wordsResult = Array.isArray(data?.words_result) ? data.words_result : [];
  return wordsResult
    .map((item: any) => (typeof item?.words === 'string' ? item.words : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function ocrImageWithBaiduV2(image: string) {
  const token = await getBaiduOcrAccessTokenV2();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BAIDU_OCR_TIMEOUT_MS);

  try {
    const body = new URLSearchParams();
    body.set('image', stripDataUrlPrefixV2(image));

    const resp = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`百度 OCR 请求失败：${resp.status} ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    if (typeof data?.error_code === 'number') {
      throw new Error(`百度 OCR 返回错误：${data.error_code} ${data?.error_msg || ''}`.trim());
    }

    return readBaiduOcrTextV2(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`百度 OCR 请求超时，已等待 ${Math.round(BAIDU_OCR_TIMEOUT_MS / 1000)} 秒。`);
    }

    throw error instanceof Error ? error : new Error('百度 OCR 请求失败');
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildDashScopeOcrBodyV2(image: string) {
  return {
    model: process.env.QWEN_OCR_MODEL || 'qwen-vl-ocr-latest',
    input: {
      messages: [
        {
          role: 'user',
          content: [
            {
              image: normalizeOcrImageV2(image),
              min_pixels: OCR_MIN_PIXELS,
              max_pixels: OCR_MAX_PIXELS,
              enable_rotate: true,
            },
          ],
        },
      ],
    },
    parameters: {
      ocr_options: {
        task: process.env.QWEN_OCR_TASK || 'text_recognition',
      },
    },
  };
}

async function ocrImageWithDashScopeNativeV2(image: string) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法执行 DashScope OCR。');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildDashScopeOcrBodyV2(image)),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`DashScope OCR 请求失败：${resp.status} ${text.slice(0, 300)}`);
    }

    const data = await resp.json();
    return readDashScopeOcrText(data).trim();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`DashScope OCR 请求超时，已等待 ${Math.round(OCR_TIMEOUT_MS / 1000)} 秒。`);
    }

    const message = error instanceof Error ? error.message : '未知网络错误';
    if (/fetch failed/i.test(message)) {
      throw new Error('DashScope OCR 网络请求失败，请稍后重试。');
    }
    throw error instanceof Error ? error : new Error('DashScope OCR 请求失败');
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ocrPdfWithFallbackChain(images: string[]) {
  if (!images.length) {
    throw new Error('OCR 兜底失败：PDF 页面图片为空。');
  }

  const selectedImages = images.slice(0, OCR_MAX_IMAGES);
  const chunks: string[] = [];
  let lastError: Error | null = null;

  for (let index = 0; index < selectedImages.length; index += 1) {
    const image = selectedImages[index];

    try {
      let text = '';
      let source = '';

      try {
        const externalResult = await ocrImageWithExternalCompatibleV2(image);
        text = externalResult.text.trim();
        source = `external:${externalResult.modelId}`;
      } catch (externalError) {
        const externalMessage = externalError instanceof Error ? externalError.message : 'external ocr failed';
        console.warn('[analyze] extract:ocr-page:external-fallback', {
          page: index + 1,
          message: externalMessage,
        });

        try {
          text = (await ocrImageWithBaiduV2(image)).trim();
          source = 'baidu-ocr';
        } catch (baiduError) {
          const baiduMessage = baiduError instanceof Error ? baiduError.message : 'baidu ocr failed';
          console.warn('[analyze] extract:ocr-page:baidu-fallback', {
            page: index + 1,
            message: baiduMessage,
          });

          text = (await ocrImageWithDashScopeNativeV2(image)).trim();
          source = 'dashscope-native';
        }
      }

      console.log('[analyze] extract:ocr-page', {
        page: index + 1,
        source,
        length: text.length,
      });

      if (text) {
        chunks.push(text);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OCR 请求失败');
      console.error('[analyze] extract:ocr-page:error', {
        page: index + 1,
        message: lastError.message,
      });
    }
  }

  const mergedText = chunks.join('\n\n').trim();
  if (mergedText) {
    return mergedText;
  }

  if (lastError) {
    throw lastError;
  }

  return '';
}

async function extractTextFromPdf(buffer: Buffer, file: File) {
  console.log('[analyze] extract:start', {
    name: file.name,
    type: file.type,
    size: buffer.length,
    inferredType: 'pdf',
  });

  try {
    const nodeText = await extractPdfTextWithNode(buffer);
    console.log('[analyze] extract:pdf-parse-text', { length: nodeText.trim().length });
    if (nodeText.trim().length >= 30) {
      return nodeText;
    }
  } catch (error) {
    console.error('[analyze] extract:pdf-parse-text:error', error);
  }

  try {
    const localText = await extractPdfTextWithPyMuPDF(buffer);
    console.log('[analyze] extract:pymupdf-text', { length: localText.trim().length });
    if (localText.trim().length >= 30) {
      return localText;
    }
  } catch (error) {
    console.error('[analyze] extract:pymupdf-text:error', error);
  }

  let renderedImages: string[] = [];
  let embeddedImages: string[] = [];
  let images: string[] = [];

  try {
    renderedImages = await renderPdfPagesToImagesWithNode(buffer);
    console.log('[analyze] extract:pdf-parse-images', {
      count: renderedImages.length,
      payloadSize: getImagePayloadSize(renderedImages),
    });
  } catch (error) {
    console.error('[analyze] extract:pdf-parse-images:error', error);
  }

  try {
    embeddedImages = await extractEmbeddedPdfImagesWithNode(buffer);
    console.log('[analyze] extract:pdf-parse-embedded-images', {
      count: embeddedImages.length,
      payloadSize: getImagePayloadSize(embeddedImages),
    });
  } catch (error) {
    console.error('[analyze] extract:pdf-parse-embedded-images:error', error);
  }

  const selectedImages = pickBestPdfImages(renderedImages, embeddedImages);
  images = selectedImages.images;
  if (images.length) {
    console.log('[analyze] extract:image-source-selected', {
      source: selectedImages.source,
      count: images.length,
      payloadSize: getImagePayloadSize(images),
    });
  }

  if (!images.length) {
    try {
      images = await renderPdfPagesToImagesWithPyMuPDF(buffer);
      console.log('[analyze] extract:pymupdf-images', { count: images.length });
    } catch (error) {
      console.error('[analyze] extract:pymupdf-images:error', error);
      throw new Error('PDF 页面渲染失败：服务端无法将 PDF 转为 OCR 图片。请改传 DOCX / TXT，或改传带文本层的 PDF。');
    }
  }

  try {
    const ocrText = await ocrPdfWithFallbackChain(images);
    console.log('[analyze] extract:ocr', { length: ocrText.trim().length });
    if (ocrText.trim().length >= 30) {
      return ocrText;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('[analyze] extract:ocr:error', error);
    throw new Error(`这份 PDF 的文本层提取失败，OCR 兜底也失败了：${message}`);
  }

  throw new Error('这份 PDF 提取出的文本仍然过少。建议改传 DOCX / TXT，或上传一份可复制文字的 PDF。');
}

async function extractTextFromPdfWithClientImages(buffer: Buffer, file: File, clientImages: string[]) {
  console.log('[analyze] extract:client-images', { count: clientImages.length, payloadSize: getImagePayloadSize(clientImages) });

  try {
    const ocrText = await ocrPdfWithFallbackChain(clientImages);
    console.log('[analyze] extract:client-ocr', { length: ocrText.trim().length });
    if (ocrText.trim().length >= 30) {
      return ocrText;
    }
  } catch (error) {
    console.error('[analyze] extract:client-ocr:error', error);
  }

  try {
    const nodeText = await extractPdfTextWithNode(buffer);
    console.log('[analyze] extract:client-fallback-pdf-parse-text', { length: nodeText.trim().length });
    if (nodeText.trim().length >= 30) {
      return nodeText;
    }
  } catch (error) {
    console.error('[analyze] extract:client-fallback-pdf-parse-text:error', error);
  }

  try {
    const localText = await extractPdfTextWithPyMuPDF(buffer);
    console.log('[analyze] extract:client-fallback-pymupdf-text', { length: localText.trim().length });
    if (localText.trim().length >= 30) {
      return localText;
    }
  } catch (error) {
    console.error('[analyze] extract:client-fallback-pymupdf-text:error', error);
  }

  throw new Error('浏览器端已完成 PDF 图片渲染，但 OCR 仍未提取到足够文本。请优先改传 DOCX / TXT，或换一份更清晰的 PDF。');
}

async function extractTextFromFile(file: File, clientPdfImages: string[] = []) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileType = inferFileType(file);

  if (fileType === 'pdf') {
    if (clientPdfImages.length) {
      return extractTextFromPdfWithClientImages(buffer, file, clientPdfImages);
    }
    return extractTextFromPdf(buffer, file);
  }

  if (fileType === 'docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || '';
  }

  if (fileType === 'txt') {
    return buffer.toString('utf-8');
  }

  if (fileType === 'doc') {
    throw new Error('暂不支持 .doc 老版 Word，请另存为 .docx 或 PDF 后再上传。');
  }

  throw new Error('仅支持 PDF / DOCX / TXT 文件。');
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const fileType = formData.get('fileType');
    const model = formData.get('model');
    const apiBaseUrl = formData.get('apiBaseUrl');
    const apiKey = formData.get('apiKey');
    const modelId = formData.get('modelId');
    const extractedText = formData.get('extractedText');
    const clientPdfImages = formData
      .getAll('pdfImages')
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    const hasInlineExtractedText = typeof extractedText === 'string' && extractedText.trim().length >= 30;
    const effectiveFileName =
      typeof fileName === 'string' && fileName.trim()
        ? fileName.trim()
        : file instanceof File
          ? file.name
          : undefined;
    const effectiveFileType =
      typeof fileType === 'string' && fileType.trim()
        ? fileType.trim()
        : file instanceof File
          ? file.type
          : undefined;

    console.log('[analyze] request:start', {
      model,
      apiBaseUrl: typeof apiBaseUrl === 'string' ? apiBaseUrl : undefined,
      hasApiKey: Boolean(typeof apiKey === 'string' && apiKey),
      modelId: typeof modelId === 'string' ? modelId : undefined,
      hasExtractedText: hasInlineExtractedText,
      clientPdfImages: clientPdfImages.length,
      fileName: effectiveFileName,
      fileType: effectiveFileType,
      fileSize: file instanceof File ? file.size : undefined,
    });

    if (!hasInlineExtractedText && clientPdfImages.length === 0 && (!file || !(file instanceof File))) {
      return NextResponse.json({ error: '未检测到上传文件。' }, { status: 400 });
    }

    if (!model || typeof model !== 'string' || !SUPPORTED_MODELS.includes(model as SupportedModel)) {
      return NextResponse.json({ error: '请先选择分析模型。' }, { status: 400 });
    }

    let text = '';

    if (hasInlineExtractedText) {
      text = extractedText.trim();
    } else if (clientPdfImages.length && file instanceof File) {
      text = await extractTextFromFile(file, clientPdfImages);
    } else if (clientPdfImages.length) {
      console.log('[analyze] request:client-images-only');
      const ocrText = await ocrPdfWithFallbackChain(clientPdfImages);
      text = ocrText.trim();
    } else {
      text = await extractTextFromFile(file as File, clientPdfImages);
    }
    console.log('[analyze] extract:done', { length: text.trim().length });

    if (!text || text.trim().length < 30) {
      return NextResponse.json({ error: '简历文本提取失败，内容过少或为空。' }, { status: 400 });
    }

    const resume = parseResumeText(text);
    const knowledgeContext = buildKnowledgeContext(resume);
    const customConfig: CustomApiConfig = {
      baseURL: typeof apiBaseUrl === 'string' ? apiBaseUrl : undefined,
      apiKey: typeof apiKey === 'string' ? apiKey : undefined,
      modelId: typeof modelId === 'string' ? modelId : undefined,
    };

    const analysis = await analyzeResumeByModel(model as SupportedModel, resume, customConfig, knowledgeContext);
    console.log('[analyze] llm:done', analysis.meta || null);

    const strategyOptions = buildStrategyOptions(analysis.result, knowledgeContext, resume);
    const result = {
      ...analysis.result,
      knowledgeGuidance: knowledgeContext.guidance,
      strategyOptions,
    };

    return NextResponse.json({
      result,
      analysisMeta: analysis.meta,
      parsedResume: resume,
      knowledgeContext,
      model,
      usedCustomApi: Boolean(customConfig.baseURL || customConfig.apiKey || customConfig.modelId),
    });
  } catch (error) {
    console.error('[analyze] request:error', error);
    const message = error instanceof Error ? error.message : '分析失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
