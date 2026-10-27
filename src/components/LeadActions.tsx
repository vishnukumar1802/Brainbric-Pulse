'use client';

import { Check, Copy, ExternalLink, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { trackActionAction } from '@/app/actions';
import { outlookComposeUrl, safeHttpUrl, whatsappUrl } from '@/lib/links';

type LeadLike = {
  id: string;
  email: string | null;
  email_subject: string | null;
  email_body: string | null;
  outlook_link: string | null;
  whatsapp: string | null;
  phone: string | null;
  whatsapp_message: string | null;
  bid_text: string | null;
  source_url: string | null;
  source_platform: string | null;
};

function track(id: string, type: string) {
  // Fire and forget: the link opens immediately, the click is logged for the team.
  void trackActionAction(id, type).catch(() => undefined);
}

function waText(l: LeadLike): string {
  return l.whatsapp_message || l.email_body || '';
}

export function CopyButton({ text, label, leadId, type, className = 'btn-ghost' }: { text: string; label: string; leadId?: string; type?: string; className?: string }) {
  const [done, setDone] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone('ok');
          if (leadId && type) track(leadId, type);
        } catch {
          setDone('fail');
        }
        setTimeout(() => setDone('idle'), 1800);
      }}
    >
      {done === 'ok' ? <Check size={14} /> : <Copy size={14} className="text-ink-500" />}
      {done === 'ok' ? 'Copied' : done === 'fail' ? 'Select and copy manually' : label}
    </button>
  );
}

/** Full set of actions for the lead page. */
export function LeadActions({ lead, myWhatsapp }: { lead: LeadLike; myWhatsapp: string | null }) {
  const draft = safeHttpUrl(lead.outlook_link);
  const compose = outlookComposeUrl(lead.email, lead.email_subject, lead.email_body);
  const wa = whatsappUrl(lead.whatsapp || lead.phone, waText(lead));
  const waSelf = waText(lead) ? whatsappUrl(myWhatsapp, waText(lead)) : null;
  const source = safeHttpUrl(lead.source_url);

  return (
    <div className="flex flex-wrap gap-2">
      {draft && (
        <a className="btn-primary" href={draft} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'outlook_draft')}>
          <Mail size={15} /> Open draft in Outlook
        </a>
      )}
      {compose && (
        <a
          className={draft ? 'btn-ghost' : 'btn-primary'}
          href={compose}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(lead.id, 'outlook_compose')}
        >
          <Mail size={15} className={draft ? 'text-[#0F6CBD]' : ''} /> {draft ? 'New email in Outlook' : 'Write email in Outlook'}
        </a>
      )}
      {wa && (
        <a className={draft || compose ? 'btn-ghost' : 'btn-primary'} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'whatsapp')}>
          <MessageCircle size={15} className={draft || compose ? 'text-[#1FA855]' : ''} /> Message on WhatsApp
        </a>
      )}
      {waSelf && (
        <a className="btn-ghost" href={waSelf} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'whatsapp_self')}>
          <Smartphone size={15} className="text-ink-500" /> Send to my WhatsApp to review
        </a>
      )}
      {source && (
        <a className="btn-ghost" href={source} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'source')}>
          <ExternalLink size={15} className="text-ink-500" /> Open {lead.source_platform ? `on ${lead.source_platform}` : 'source'}
        </a>
      )}
      {lead.bid_text && <CopyButton text={lead.bid_text} label="Copy bid" leadId={lead.id} type="copy_bid" />}
    </div>
  );
}

/** Compact icon buttons for lists. */
export function LeadQuickActions({ lead, compact = false }: { lead: LeadLike; myWhatsapp?: string | null; compact?: boolean }) {
  const mail = safeHttpUrl(lead.outlook_link) || outlookComposeUrl(lead.email, lead.email_subject, lead.email_body);
  const wa = whatsappUrl(lead.whatsapp || lead.phone, waText(lead));
  const source = safeHttpUrl(lead.source_url);
  const icon = `inline-flex h-7 items-center gap-1.5 rounded-md border border-[#D9D5D1] bg-white text-xs font-medium text-ink-900 transition-colors hover:border-ink-400 hover:bg-paper ${compact ? 'px-1.5 xl:px-2' : 'px-2'}`;
  // In compact mode the label hides below xl; the icon, tooltip and screen-reader text stay.
  const label = compact ? 'sr-only xl:not-sr-only' : '';
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {mail && (
        <a
          href={mail}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(lead.id, lead.outlook_link ? 'outlook_draft' : 'outlook_compose')}
          className={icon}
          title="Open in Outlook"
        >
          <Mail size={13} className="text-[#0F6CBD]" /> <span className={label}>Outlook</span>
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(lead.id, 'whatsapp')}
          className={icon}
          title="Message on WhatsApp"
        >
          <MessageCircle size={13} className="text-[#1FA855]" /> <span className={label}>WhatsApp</span>
        </a>
      )}
      {!mail && !wa && source && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(lead.id, 'source')}
          className={icon}
          title="Open the post"
        >
          <ExternalLink size={13} className="text-ink-500" /> <span className={label}>Open post</span>
        </a>
      )}
    </div>
  );
}
