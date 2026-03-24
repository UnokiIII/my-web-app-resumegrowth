import { NextResponse } from 'next/server';
import {
  getPaywallAdminCookieName,
  getPaywallAdminCookieValue,
  isValidAdminPassword,
} from '@/lib/paywall';

function buildRedirectUrl(request: Request, error?: string) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/admin/paywall';
  const redirect = new URL(next, url.origin);
  if (error) {
    redirect.searchParams.set('error', error);
  }
  return redirect;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  let password = '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    password = typeof body?.password === 'string' ? body.password : '';
  } else {
    const formData = await request.formData().catch(() => null);
    password = typeof formData?.get('password') === 'string' ? String(formData.get('password')) : '';
  }

  if (!isValidAdminPassword(password)) {
    if (contentType.includes('application/json')) {
      return NextResponse.json({ ok: false, error: '后台密码错误。' }, { status: 401 });
    }
    return NextResponse.redirect(buildRedirectUrl(request, 'invalid-password'));
  }

  if (contentType.includes('application/json')) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getPaywallAdminCookieName(), getPaywallAdminCookieValue(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return response;
  }

  const response = NextResponse.redirect(buildRedirectUrl(request));
  response.cookies.set(getPaywallAdminCookieName(), getPaywallAdminCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
