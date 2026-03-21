import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseResumeText } from '@/lib/resume-parser';
import { analyzeResumeByModel, CustomApiConfig, SupportedModel } from '@/lib/llm-analysis';
import { buildKnowledgeContext } from '@/lib/knowledge-engine';
import { buildStrategyOptions } from '@/lib/strategy-options';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const SUPPORTED_MODELS: SupportedModel[] = ['qwen3.5-flash', 'claude-4.6-opus', 'gpt-5.4', 'gemini-3.1'];

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

  throw new Error('未找到可用的 Python 解释器。请先安装 Python，或在项目内创建 .venv-ocr 环境。');
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
    const args = pythonBin === 'py' ? ['-3', scriptPath, pdfPath, '3', mode] : [scriptPath, pdfPath, '3', mode];
    const { stdout, stderr } = await execFileAsync(pythonBin, args, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });

    if (stderr && stderr.trim()) {
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

async function renderPdfPagesToImages(buffer: Buffer) {
  const payload = await runPyMuPdf(buffer, 'images');
  return Array.isArray(payload?.images) ? payload.images : [];
}

function buildOcrErrorMessage(message: string) {
  if (/fetch failed/i.test(message)) {
    return 'OCR 网络请求失败，请稍后重试；如果持续失败，请检查 DASHSCOPE_API_KEY、QWEN_OCR_MODEL 或当前网络连通性。';
  }
  return message;
}

async function ocrPdfWithQwen(images: string[]) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法执行 PDF OCR 兜底');
  }

  if (!images.length) {
    throw new Error('OCR 兜底失败：PDF 页面图片为空');
  }

  const visionContent = [
    {
      type: 'text',
      text: '请对这些简历 PDF 页面做 OCR，只输出提取出的纯文本内容。不要总结，不要解释，不要加 markdown。按页面顺序输出。',
    },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${img}`,
      },
    })),
  ];

  let resp: Response;
  try {
    resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.QWEN_OCR_MODEL || 'qwen2.5-vl-72b-instruct',
        temperature: 0,
        messages: [{ role: 'user', content: visionContent }],
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(buildOcrErrorMessage(message));
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

async function extractTextFromFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileType = inferFileType(file);

  if (fileType === 'pdf') {
    console.log('[analyze] extract:start', {
      name: file.name,
      type: file.type,
      size: buffer.length,
      inferredType: fileType,
    });

    try {
      const localText = await extractPdfTextWithPyMuPDF(buffer);
      console.log('[analyze] extract:pymupdf-text', { length: localText.trim().length });
      if (localText.trim().length >= 30) {
        return localText;
      }
    } catch (error) {
      console.error('[analyze] extract:pymupdf-text:error', error);
    }

    let images: string[] = [];
    try {
      images = await renderPdfPagesToImages(buffer);
      console.log('[analyze] extract:pymupdf-images', { count: images.length });
    } catch (error) {
      console.error('[analyze] extract:pymupdf-images:error', error);
      throw new Error('PDF 页面渲染失败：无法将 PDF 转为图片进行 OCR。请改传 DOCX / TXT，或检查本地 PyMuPDF / OCR 依赖。');
    }

    try {
      const ocrText = await ocrPdfWithQwen(images);
      console.log('[analyze] extract:ocr', { length: ocrText.trim().length });
      if (ocrText.trim().length >= 30) {
        return ocrText;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error('[analyze] extract:ocr:error', err);
      throw new Error(`这份 PDF 文本层提取失败，OCR 兜底也失败了：${message}`);
    }

    throw new Error('这份 PDF 提取出的文本仍然过少。建议改传 DOCX / TXT，或换一份可复制文字的 PDF。');
  }

  if (fileType === 'docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || '';
  }

  if (fileType === 'txt') {
    return buffer.toString('utf-8');
  }

  if (fileType === 'doc') {
    throw new Error('暂不支持 .doc（老版 Word）。请另存为 .docx 或 PDF 后再上传。');
  }

  throw new Error('仅支持 PDF / DOCX / TXT 文件。');
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const model = formData.get('model');
    const apiBaseUrl = formData.get('apiBaseUrl');
    const apiKey = formData.get('apiKey');
    const modelId = formData.get('modelId');

    console.log('[analyze] request:start', {
      model,
      apiBaseUrl: typeof apiBaseUrl === 'string' ? apiBaseUrl : undefined,
      hasApiKey: Boolean(typeof apiKey === 'string' && apiKey),
      modelId: typeof modelId === 'string' ? modelId : undefined,
      fileName: file instanceof File ? file.name : undefined,
      fileType: file instanceof File ? file.type : undefined,
      fileSize: file instanceof File ? file.size : undefined,
    });

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '未检测到上传文件' }, { status: 400 });
    }

    if (!model || typeof model !== 'string' || !SUPPORTED_MODELS.includes(model as SupportedModel)) {
      return NextResponse.json({ error: '请先选择分析模型' }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    console.log('[analyze] extract:done', { length: text?.trim().length || 0 });
    if (!text || text.trim().length < 30) {
      return NextResponse.json({ error: '简历文本提取失败，内容过少或为空' }, { status: 400 });
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
