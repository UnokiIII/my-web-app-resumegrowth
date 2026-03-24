import { NextResponse } from 'next/server';
import { ensureUnlockOrderRecord } from '@/lib/paywall-proof-store';
import { getPaywallPriceLabel, getPaymentEntrySummary } from '@/lib/paywall';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const reportFileName = typeof body?.reportFileName === 'string' ? body.reportFileName.trim() : '';

    if (!orderId) {
      return NextResponse.json({ ok: false, error: '缺少订单号，无法初始化解锁订单。' }, { status: 400 });
    }

    const record = ensureUnlockOrderRecord({
      orderId,
      reportFileName: reportFileName || '未命名报告',
    });

    return NextResponse.json({
      ok: true,
      enabled: true,
      stage: 'manual-wechat',
      orderId: record?.orderId,
      receiptId: record?.receiptId,
      priceLabel: getPaywallPriceLabel(),
      paymentEntry: getPaymentEntrySummary(),
      adminPagePath: '/admin/paywall',
      message: '订单已创建。付款后添加微信并发送订单号，我会在后台为这笔订单生成一次性解锁码，再手动发给你。',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '初始化解锁订单失败，请稍后重试。' },
      { status: 500 }
    );
  }
}
