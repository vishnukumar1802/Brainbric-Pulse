/** Digits only, with country code. Indian 10-digit mobiles get 91 added. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Opens WhatsApp (app or web) with the message typed in, ready for you to review and send. */
export function whatsappUrl(phone: string | null | undefined, text: string | null | undefined): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  const t = text?.trim();
  return `https://wa.me/${n}${t ? `?text=${encodeURIComponent(t)}` : ''}`;
}

/** Opens a new Outlook on the web message with recipient, subject and body filled in. */
export function outlookComposeUrl(to: string | null | undefined, subject?: string | null, body?: string | null): string | null {
  if (!to) return null;
  const params = new URLSearchParams();
  params.set('to', to);
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, '%20')}`;
}

export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function hostOf(raw: string | null | undefined): string {
  const u = safeHttpUrl(raw);
  if (!u) return '';
  return new URL(u).hostname.replace(/^www\./, '');
}

export type Sender = {
  /** Admins open the agent's draft in the connected mailbox; team members compose in their own. */
  isAdmin: boolean;
  email: string | null;
  signature: string | null;
  bcc: string | null;
};

const SIGN_OFF = /^(warm(est)? regards|best regards|kind regards|regards|thanks( and regards)?|thank you|sincerely|cheers),?$/i;

/** The agent's email with its sign-off replaced by the sender's own signature (kept as is when they have none). */
export function withSignature(body: string | null | undefined, signature: string | null | undefined): string {
  const text = (body ?? '').replace(/\r\n/g, '\n').trimEnd();
  const sig = signature?.replace(/\r\n/g, '\n').trim();
  if (!sig) return text;
  const lines = text.split('\n');
  let cut = -1;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 12); i--) {
    if (SIGN_OFF.test(lines[i].trim()) || /\[TODO: signature\]/i.test(lines[i])) {
      cut = i;
      break;
    }
  }
  const kept = (cut >= 0 ? lines.slice(0, cut) : lines).join('\n').trimEnd();
  return `${kept}\n\n${sig}`;
}

/** A new message in the sender's own Outlook on the web; login_hint picks their account when several are signed in. */
export function memberComposeUrl(sender: Sender, to: string | null | undefined, subject?: string | null, body?: string | null): string | null {
  if (!to) return null;
  const params = new URLSearchParams();
  params.set('to', to);
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  if (sender.bcc && sender.bcc.toLowerCase() !== sender.email?.toLowerCase()) params.set('bcc', sender.bcc);
  if (sender.email) params.set('login_hint', sender.email);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, '%20')}`;
}

/** The same message for the Outlook desktop or phone app (or whatever mail app is the default). */
export function mailtoUrl(sender: Sender, to: string | null | undefined, subject?: string | null, body?: string | null): string | null {
  if (!to) return null;
  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  if (sender.bcc && sender.bcc.toLowerCase() !== sender.email?.toLowerCase()) parts.push(`bcc=${encodeURIComponent(sender.bcc)}`);
  return `mailto:${encodeURIComponent(to)}${parts.length ? `?${parts.join('&')}` : ''}`;
}
