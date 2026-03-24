export type PaymentEntryMode = 'wechat-manual';

const ADMIN_COOKIE_NAME = 'rg_paywall_admin';
const ADMIN_COOKIE_VALUE = 'verified';

export function getPaywallPriceLabel() {
  return process.env.NEXT_PUBLIC_PAYWALL_PRICE_LABEL?.trim() || '1 元';
}

export function getPaymentEntryMode(): PaymentEntryMode {
  return 'wechat-manual';
}

export function getPaywallAdminPassword() {
  return process.env.PAYWALL_ADMIN_PASSWORD?.trim() || 'RG-ADMIN-2026';
}

export function isValidAdminPassword(password: string) {
  return password.trim() === getPaywallAdminPassword();
}

export function getPaywallAdminCookieName() {
  return ADMIN_COOKIE_NAME;
}

export function getPaywallAdminCookieValue() {
  return ADMIN_COOKIE_VALUE;
}

export function isValidAdminSessionCookie(value: string | undefined) {
  return value === ADMIN_COOKIE_VALUE;
}

export function getPaymentEntrySummary() {
  return {
    mode: 'wechat-manual' as const,
    label: '微信扫码支付 + 人工发码',
    description:
      '当前先采用人工发码方式，确保每一份报告都能准确对应到付款用户，减少错发、漏发和解锁失败。',
  };
}
