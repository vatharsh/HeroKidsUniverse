/**
 * Influencer share links: herokidsuniverse.com/?coupon=CODE.
 * The code is remembered on whatever page the parent lands on, so it survives sign-up and email
 * verification and is applied automatically when they open Top Up.
 */
export const COUPON_STORAGE_KEY = "hk_coupon_code";

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;

export function rememberCouponFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get("coupon")?.trim();
    if (code && CODE_PATTERN.test(code)) localStorage.setItem(COUPON_STORAGE_KEY, code.toUpperCase());
  } catch { /* storage unavailable — Top Up still reads ?coupon= from its own URL */ }
}

export function couponShareLink(code: string): string {
  return `${window.location.origin}/?coupon=${encodeURIComponent(code)}`;
}
