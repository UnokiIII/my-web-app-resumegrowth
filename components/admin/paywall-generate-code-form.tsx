'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, KeyRound } from 'lucide-react';

export default function PaywallGenerateCodeForm() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [reportFileName, setReportFileName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    if (!orderId.trim()) {
      setFeedback('请先输入订单号。');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/paywall/generate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId.trim(),
            reportFileName: reportFileName.trim(),
          }),
        });
        const payload = await response.json();

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || '生成一次性解锁码失败。');
        }

        setGeneratedCode(payload.record?.unlockCode || '');
        setFeedback(payload.message || '已生成一次性解锁码。');
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : '生成一次性解锁码失败。');
      }
    });
  };

  const copyGeneratedCode = async () => {
    if (!generatedCode) return;

    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setFeedback('解锁码已复制。');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setFeedback('复制失败，请手动复制。');
    }
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
        <KeyRound className="h-3.5 w-3.5" />
        手动生成一次性解锁码
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_auto]">
        <div>
          <div className="mb-2 text-sm text-white/65">订单号</div>
          <input
            type="text"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="例如：RG-吴亿豪1-标准化服务"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>

        <div>
          <div className="mb-2 text-sm text-white/65">关联报告名（可选）</div>
          <input
            type="text"
            value={reportFileName}
            onChange={(event) => setReportFileName(event.target.value)}
            placeholder="例如：吴亿豪简历.pdf"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {isPending ? '生成中...' : '生成解锁码'}
          </button>
        </div>
      </div>

      {generatedCode ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-amber-200/75">最新生成的一次性解锁码</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-lg font-semibold text-amber-100">{generatedCode}</div>
            <button
              type="button"
              onClick={copyGeneratedCode}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-200/10 px-3 py-2 text-sm text-amber-50 transition hover:bg-amber-200/15"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? '已复制' : '复制解锁码'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? <div className="mt-4 text-sm leading-6 text-white/60">{feedback}</div> : null}
    </div>
  );
}
