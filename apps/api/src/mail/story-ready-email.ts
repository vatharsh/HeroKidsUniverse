import type { MailMessage } from './mail.service';

/** Where links in emails point. WEB_PUBLIC_URL overrides; dev falls back to the local web app. */
export function webPublicUrl(): string {
  const configured = process.env.WEB_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? 'https://herokidsuniverse.com' : 'http://localhost:3001';
}

/** "Your story is ready" — sent when a story finishes, so parents don't have to wait on the page. */
export function storyReadyEmail(params: {
  to: string;
  parentName: string;
  heroName: string;
  storyTitle: string;
  storyId: string;
  coverImageUrl?: string | null;
}): MailMessage {
  const link = `${webPublicUrl()}/stories/${params.storyId}`;
  const name = escapeHtml(params.parentName);
  const hero = escapeHtml(params.heroName);
  const title = escapeHtml(params.storyTitle);
  const cover = params.coverImageUrl && /^https:\/\//.test(params.coverImageUrl)
    ? `<tr><td style="padding-top:20px"><img src="${escapeHtml(params.coverImageUrl)}" alt="" width="416" style="width:100%;max-width:416px;border-radius:12px;display:block"></td></tr>`
    : '';

  return {
    to: params.to,
    subject: `${params.heroName}'s new story is ready ✨`,
    text: `Hi ${params.parentName},\n\n"${params.storyTitle}" is ready to read. ${params.heroName}'s adventure is waiting for you:\n${link}\n\nHappy reading!\nHeroKids Universe`,
    html: `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#6d28d9">HeroKids Universe</td></tr>
<tr><td style="padding-top:16px;font-size:18px;font-weight:bold">${hero}'s new story is ready ✨</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px">Hi ${name}, <strong>"${title}"</strong> is ready to read.</td></tr>
${cover}
<tr><td align="center" style="padding:24px 0"><a href="${link}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px">Read the story</a></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6b7280">You're getting this because you created a story on HeroKids Universe.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
