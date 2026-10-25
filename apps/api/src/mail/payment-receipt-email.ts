import type { MailMessage } from './mail.service';
import { webPublicUrl } from './story-ready-email';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Sent after every paid credit-pack purchase — the parent's payment receipt (not a GST tax invoice). */
export function paymentReceiptEmail(p: {
  to: string;
  parentName: string;
  orderId: string;
  orderNumber: string;
  packName: string;
  /** e.g. "5 story credits", "3 Avatar Refreshes". */
  contents: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
  paidAt: Date;
}): MailMessage {
  const link = `${webPublicUrl()}/receipt/${p.orderId}`;
  const date = p.paidAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rows: Array<[string, string]> = [
    [`${p.packName} — ${p.contents}`, inr(p.subtotal)],
    ...(p.discount > 0 ? [[`Discount${p.couponCode ? ` (${p.couponCode})` : ''}`, `−${inr(p.discount)}`] as [string, string]] : []),
  ];
  return {
    to: p.to,
    subject: `Your HeroKids receipt — ${p.orderNumber}`,
    text: `Hi ${p.parentName},\n\nThank you for your purchase!\n\nReceipt: ${p.orderNumber}\nDate: ${date}\n${rows.map((r) => `${r[0]}: ${r[1]}`).join('\n')}\nTotal paid: ${inr(p.total)}\n\nView or print your receipt: ${link}\n\nHeroKids Universe · support@herokidsuniverse.com`,
    html: `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#6d28d9">HeroKids Universe</td></tr>
<tr><td style="padding-top:14px;font-size:15px;line-height:22px">Hi ${esc(p.parentName)}, thank you for your purchase! Your credits are ready to use.</td></tr>
<tr><td style="padding-top:16px;font-size:13px;color:#6b7280">Receipt ${esc(p.orderNumber)} · ${esc(date)}</td></tr>
<tr><td style="padding-top:8px"><table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${rows.map((r) => `<tr><td style="border-top:1px solid #eee">${esc(r[0])}</td><td style="border-top:1px solid #eee;text-align:right">${r[1]}</td></tr>`).join('')}
<tr><td style="border-top:2px solid #1e1b4b;font-weight:bold">Total paid</td><td style="border-top:2px solid #1e1b4b;text-align:right;font-weight:bold">${inr(p.total)}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:24px 0 8px"><a href="${link}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:999px">View or print receipt</a></td></tr>
<tr><td style="font-size:12px;line-height:18px;color:#6b7280">Questions? Reply to support@herokidsuniverse.com. This is a payment receipt, not a GST tax invoice.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

/** What a credit pack gives, in words: "5 story credits", "3 Avatar Refreshes", "2 character slots". */
export function packContents(pack: { credits: number; bonusCredits: number; avatarRefreshTokens: number; characterSlots: number }): string {
  const parts: string[] = [];
  const stories = pack.credits + pack.bonusCredits;
  if (stories > 0) parts.push(`${stories} story credit${stories === 1 ? '' : 's'}`);
  if (pack.avatarRefreshTokens > 0) parts.push(`${pack.avatarRefreshTokens} Avatar Refresh${pack.avatarRefreshTokens === 1 ? '' : 'es'}`);
  if (pack.characterSlots > 0) parts.push(`${pack.characterSlots} character slot${pack.characterSlots === 1 ? '' : 's'}`);
  return parts.join(' + ') || 'credits';
}
