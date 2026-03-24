'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, KeyRound, RotateCcw, Send } from 'lucide-react';

interface PaywallAdminActionsProps {
  receiptId: string;
  orderId: string;
  reportFileName: string;
  unlockCode: string | null;
  sentAt: string | null;
}

export default function PaywallAdminActions(props: PaywallAdminActionsProps) {
  const { receiptId, orderId, reportFileName, sentAt } = props;
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [localUnlockCode, setLocalUnlockCode] = useState(props.unlockCode || '');
  const [localSentAt, setLocalSentAt] = useState(sentAt);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const copyUnlockCode = async () => {
    if (!localUnlockCode) {
      setFeedback('请先生成一次性解锁码。');
      return;
    }

    try {
      await navigator.clipboard.writeText(localUnlockCode);
      setCopied(true);
      setFeedback('解锁码已复制。');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setFeedback('复制失败，请手动复制。');
    }
  };

  const generateCode = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/paywall/generate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, reportFileName }),
        });
        const payload = await response.json();

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || '生成一次性解锁码失败。');
        }

        setLocalUnlockCode(payload.record?.unlockCode || '');
        setLocalSentAt(null);
        setFeedback(payload.message || '已生成一次性解锁码。');
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : '生成一次性解锁码失败。');
      }
    });
  };

  const markSent = () => {
    if (!localUnlockCode) {
      setFeedback('请先生成一次性解锁码。');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/paywall/mark-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId }),
        });
        const payload = await response.json();

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || '标记失败。');
        }

        setLocalSentAt(payload.sentAt || new Date().toISOString());
        setFeedback(payload.message || '已标记为手动发送。');
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : '标记失败。');
      }
    });
  };

  const hasUnlockCode = Boolean(localUnlockCode);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={generateCode}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasUnlockCode ? <RotateCcw className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          {isPending ? '处理中...' : hasUnlockCode ? '重新生成新码' : '生成一次性解锁码'}
        </button>

        <button
          type="button"
          onClick={copyUnlockCode}
          disabled={!hasUnlockCode}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? '已复制' : '复制解锁码'}
        </button>

        <button
          type="button"
          onClick={markSent}
          disabled={!hasUnlockCode || Boolean(localSentAt) || isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {localSentAt ? '已标记发送' : isPending ? '处理中...' : '标记已手动发送'}
        </button>
      </div>

      {localSentAt ? <div className="text-xs leading-6 text-emerald-100/80">已手动发送：{localSentAt}</div> : null}
      {feedback ? <div className="text-xs leading-6 text-white/55">{feedback}</div> : null}
    </div>
  );
}
