import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateOrderUnlockCode } from '@/lib/paywall-proof-store';
import { getPaywallAdminCookieName, isValidAdminSessionCookie } from '@/lib/paywall';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(getPaywallAdminCookieName())?.value;

  if (!isValidAdminSessionCookie(adminCookie)) {
    return NextResponse.json({ ok: false, error: '未登录后台，无法执行操作。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  const reportFileName = typeof body?.reportFileName === 'string' ? body.reportFileName.trim() : '';

  if (!orderId) {
    return NextResponse.json({ ok: false, error: '请先输入订单号。' }, { status: 400 });
  }

  const record = generateOrderUnlockCode({
    orderId,
    reportFileName: reportFileName || '未命名报告',
  });

  if (!record) {
    return NextResponse.json({ ok: false, error: '生成一次性解锁码失败，请稍后重试。' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    record,
    message: '已生成新的“一次性解锁码”。用户输入成功后会立即失效。',
  });
}
