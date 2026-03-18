import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { parseResumeText } from '@/lib/resume-parser';
import { analyzeResumeByModel, SupportedModel } from '@/lib/llm-analysis';

export const runtime = 'nodejs';

function inferFileType(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type.includes('pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt')) return 'txt';
  if (name.endsWith('.doc')) return 'doc';
  return 'unknown';
}

async function extractTextFromFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = inferFileType(file);

  if (fileType === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text || '';
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

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '未检测到上传文件' }, { status: 400 });
    }

    if (!model || (model !== 'qwen3-max' && model !== 'claude-4-opus')) {
      return NextResponse.json({ error: '请先选择分析模型（Qwen 3 Max / Claude 4 Opus）' }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    if (!text || text.trim().length < 30) {
      return NextResponse.json({ error: '简历文本提取失败，内容过少或为空' }, { status: 400 });
    }

    const resume = parseResumeText(text);
    const result = await analyzeResumeByModel(model as SupportedModel, resume);

    return NextResponse.json({ result, parsedResume: resume, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
