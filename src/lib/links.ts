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
