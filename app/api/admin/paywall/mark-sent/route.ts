import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPaymentProofRecordByReceipt, markPaymentProofSent } from '@/lib/paywall-proof-store';
import { getPaywallAdminCookieName, isValidAdminSessionCookie } from '@/lib/paywall';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(getPaywallAdminCookieName())?.value;

  if (!isValidAdminSessionCookie(adminCookie)) {
    return NextResponse.json({ ok: false, error: '未登录后台，无法执行操作。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const receiptId = typeof body?.receiptId === 'string' ? body.receiptId.trim() : '';

  if (!receiptId) {
    return NextResponse.json({ ok: false, error: '缺少回执编号。' }, { status: 400 });
  }

  const existing = await getPaymentProofRecordByReceipt(receiptId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: '没有找到对应回执。' }, { status: 404 });
  }

  if (!existing.unlockCode?.trim()) {
    return NextResponse.json({ ok: false, error: '请先生成一次性解锁码，再标记已发送。' }, { status: 409 });
  }

  try {
    const record = await markPaymentProofSent(receiptId);
    if (!record) {
      return NextResponse.json({ ok: false, error: '没有找到对应回执。' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      sentAt: record.sentAt,
      message: '已标记为手动发送。',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '标记发送失败，请稍后重试。' },
      { status: 500 }
    );
  }
}
