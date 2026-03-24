import { NextResponse } from 'next/server';
import { redeemOrderUnlockCode } from '@/lib/paywall-proof-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code : '';
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';

    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: '请输入解锁码。' }, { status: 400 });
    }

    if (!orderId.trim()) {
      return NextResponse.json({ ok: false, error: '缺少订单号，无法兑换解锁码。' }, { status: 400 });
    }

    const redeemed = await redeemOrderUnlockCode(orderId, code);

    if (!redeemed.ok) {
      if (redeemed.reason === 'not_found') {
        return NextResponse.json(
          { ok: false, error: '没有找到对应订单，请先确认订单号是否正确。' },
          { status: 404 }
        );
      }

      if (redeemed.reason === 'code_not_generated') {
        return NextResponse.json(
          { ok: false, error: '这份订单还没有生成解锁码，请先联系我领取一次性解锁码。' },
          { status: 409 }
        );
      }

      if (redeemed.reason === 'already_redeemed') {
        return NextResponse.json(
          { ok: false, error: '这个解锁码已经使用过了，需要重新联系领取新码。' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { ok: false, error: '解锁码无效，请检查订单号和解锁码。' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      unlocked: true,
      source: 'unlock-code',
      message: '解锁码验证成功，当前报告已解锁。',
    });
  } catch {
    return NextResponse.json({ ok: false, error: '解锁码验证失败，请稍后重试。' }, { status: 500 });
  }
}
