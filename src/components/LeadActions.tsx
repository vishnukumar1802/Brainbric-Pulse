'use client';

import { Check, CheckCheck, Copy, ExternalLink, Mail, MessageCircle, Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { markSentAction, trackActionAction } from '@/app/actions';
import { mailtoUrl, memberComposeUrl, outlookComposeUrl, safeHttpUrl, whatsappUrl, withSignature, type Sender } from '@/lib/links';
import { useSender } from './SenderContext';

type LeadLike = {
  id: string;
  status?: string;
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

/** Where the email button goes for this person: the agent's draft for admins, a new message in their own mailbox for team members. */
function mailLinks(lead: LeadLike, sender: Sender) {
  if (sender.isAdmin) {
    return {
      draft: safeHttpUrl(lead.outlook_link),
      compose: outlookComposeUrl(lead.email, lead.email_subject, lead.email_body),
      app: null as string | null,
    };
  }
  const body = withSignature(lead.email_body, sender.signature);
  return {
    draft: null as string | null,
    compose: memberComposeUrl(sender, lead.email, lead.email_subject, body),
    app: mailtoUrl(sender, lead.email, lead.email_subject, body),
  };
}

const SENDABLE: Record<string, string> = { new: 'Mark as sent', drafted: 'Mark as sent', sent: 'Mark follow-up 1 sent', followup1: 'Mark follow-up 2 sent' };

function MarkSentSubmit({ label, compact }: { label: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Record that you sent this email; the follow-ups come to you"
      className={
        compact
          ? 'inline-flex h-7 items-center gap-1 rounded-md border border-[#D9D5D1] bg-white px-1.5 text-xs font-medium text-ink-900 transition-colors hover:border-ink-400 hover:bg-paper disabled:opacity-50 xl:px-2'
          : 'btn-ghost'
      }
    >
      <CheckCheck size={compact ? 13 : 15} className="text-[#247B50]" />
      <span className={compact ? 'sr-only xl:not-sr-only' : ''}>{pending ? 'Saving…' : compact ? 'Sent' : label}</span>
    </button>
  );
}

export function MarkSentButton({ id, status, compact }: { id: string; status: string | undefined; compact?: boolean }) {
  const label = status ? SENDABLE[status] : undefined;
  if (!label) return null;
  return (
    <form action={markSentAction}>
      <input type="hidden" name="id" value={id} />
      <MarkSentSubmit label={label} compact={compact} />
    </form>
  );
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
  const sender = useSender();
  const { draft, compose, app } = mailLinks(lead, sender);
  const wa = whatsappUrl(lead.whatsapp || lead.phone, waText(lead));
  const waSelf = waText(lead) ? whatsappUrl(myWhatsapp, waText(lead)) : null;
  const source = safeHttpUrl(lead.source_url);
  const hasMail = Boolean(draft || compose);

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
          onClick={() => track(lead.id, sender.isAdmin ? 'outlook_compose' : 'outlook_member')}
          title={sender.isAdmin ? undefined : `Opens a new email in ${sender.email ?? 'your'} Outlook with your signature`}
        >
          <Mail size={15} className={draft ? 'text-[#0F6CBD]' : ''} />{' '}
          {sender.isAdmin ? (draft ? 'New email in Outlook' : 'Write email in Outlook') : 'Send from my Outlook'}
        </a>
      )}
      {app && (
        <a className="btn-ghost" href={app} onClick={() => track(lead.id, 'outlook_app')} title="Opens the same email in the Outlook app on this computer or phone">
          <Monitor size={15} className="text-ink-500" /> Outlook app
        </a>
      )}
      {wa && (
        <a className={hasMail ? 'btn-ghost' : 'btn-primary'} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'whatsapp')}>
          <MessageCircle size={15} className={hasMail ? 'text-[#1FA855]' : ''} /> Message on WhatsApp
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
      <MarkSentButton id={lead.id} status={lead.status} />
    </div>
  );
}

/** Compact buttons for lists. */
export function LeadQuickActions({ lead, compact = false }: { lead: LeadLike; myWhatsapp?: string | null; compact?: boolean }) {
  const sender = useSender();
  const { draft, compose } = mailLinks(lead, sender);
  const mail = draft || compose;
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
          onClick={() => track(lead.id, draft ? 'outlook_draft' : sender.isAdmin ? 'outlook_compose' : 'outlook_member')}
          className={icon}
          title={sender.isAdmin ? 'Open in Outlook' : 'Send from my Outlook'}
        >
          <Mail size={13} className="text-[#0F6CBD]" /> <span className={label}>Outlook</span>
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'whatsapp')} className={icon} title="Message on WhatsApp">
          <MessageCircle size={13} className="text-[#1FA855]" /> <span className={label}>WhatsApp</span>
        </a>
      )}
      {!mail && !wa && source && (
        <a href={source} target="_blank" rel="noopener noreferrer" onClick={() => track(lead.id, 'source')} className={icon} title="Open the post">
          <ExternalLink size={13} className="text-ink-500" /> <span className={label}>Open post</span>
        </a>
      )}
      {!sender.isAdmin && lead.status === 'drafted' && <MarkSentButton id={lead.id} status={lead.status} compact />}
    </div>
  );
}
