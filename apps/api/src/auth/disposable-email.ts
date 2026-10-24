/**
 * Temporary / throwaway email services, blocked at sign-up so the free preview story can't be farmed
 * with endless fake accounts. Matches the domain and any subdomain of it.
 */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "10minutemail.net", "10minemail.com", "20minutemail.com", "33mail.com", "anonaddy.me",
  "binkmail.com", "bobmail.info", "burnermail.io", "chacuo.net", "cool.fr.nf", "courriel.fr.nf", "crazymailing.com",
  "cuvox.de", "dayrep.com", "deadaddress.com", "discard.email", "discardmail.com", "dispostable.com", "dropmail.me",
  "einrot.com", "emailondeck.com", "emailtemporanea.net", "emailfake.com", "emltmp.com", "fakeinbox.com",
  "fakemail.net", "fakemailgenerator.com", "fleckens.hu", "getairmail.com", "getnada.com", "gishpuppy.com",
  "grr.la", "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de", "guerrillamail.info", "guerrillamail.net",
  "guerrillamail.org", "guerrillamailblock.com", "gustr.com", "harakirimail.com", "hmamail.com", "inboxbear.com",
  "inboxkitten.com", "incognitomail.org", "jetable.org", "jourrapide.com", "kasmail.com", "linshiyouxiang.net",
  "mail-temp.com", "mail.tm", "mail7.io", "mailcatch.com", "maildrop.cc", "mailforspam.com", "mailinator.com",
  "mailinator.net", "mailinator2.com", "mailnesia.com", "mailnull.com", "mailpoof.com", "mailsac.com",
  "mailtemp.net", "mailtothis.com", "mintemail.com", "moakt.com", "mohmal.com", "mt2015.com", "mytemp.email",
  "mytrashmail.com", "nada.email", "nowmymail.com", "nwytg.net", "one-time.email", "owlymail.com", "pokemail.net",
  "proxymail.eu", "rcpt.at", "rhyta.com", "sharklasers.com", "sharkmail.org", "smashmail.de", "snapmail.cc",
  "spam4.me", "spambog.com", "spambox.us", "spamgourmet.com", "spamex.com", "spamfree24.org", "superrito.com",
  "teleworm.us", "temp-mail.io", "temp-mail.org", "temp-mail.ru", "tempail.com", "tempinbox.com", "tempm.com",
  "tempmail.com", "tempmail.dev", "tempmail.net", "tempmail.plus", "tempmailo.com", "tempmailaddress.com",
  "tempr.email", "temporary-mail.net", "temporarymail.com", "throwam.com", "throwawaymail.com", "tmail.ws",
  "tmailor.com", "tmpmail.net", "tmpmail.org", "trash-mail.com", "trashmail.com", "trashmail.de", "trashmail.net",
  "trashmail.io", "trbvm.com", "tyldd.com", "wegwerfmail.de", "wegwerfmail.net", "yopmail.com", "yopmail.fr",
  "yopmail.net", "zetmail.com", "emailnator.com", "smailpro.com", "luxusmail.org", "byom.de", "fexpost.com",
  "fexbox.org", "inbox.lv.temp", "minuteinbox.com", "tempemail.net", "mvrht.net", "vomoto.com", "xojxe.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return false;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
