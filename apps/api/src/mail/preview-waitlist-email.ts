import type { MailMessage } from './mail.service';
import { webPublicUrl } from './story-ready-email';

/** Sent to parents on the free-preview waiting list once free stories open up again. */
export function previewWaitlistEmail(params: { to: string; parentName: string }): MailMessage {
  const link = `${webPublicUrl()}/create`;
  const name = params.parentName.replace(/[&<>"']/g, '');
  return {
    to: params.to,
    subject: 'Your free story is ready to create ✨',
    text: `Hi ${params.parentName},\n\nGood news — free stories are open again, and yours is waiting. Make your child the hero of their very first adventure:\n${link}\n\nHeroKids Universe`,
    html: `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#6d28d9">HeroKids Universe</td></tr>
<tr><td style="padding-top:16px;font-size:18px;font-weight:bold">Your free story is waiting ✨</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px">Hi ${name}, free stories are open again — make your child the hero of their very first adventure.</td></tr>
<tr><td align="center" style="padding:24px 0"><a href="${link}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px">Create my free story</a></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6b7280">You're getting this because you asked for a free story when today's were all taken.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
