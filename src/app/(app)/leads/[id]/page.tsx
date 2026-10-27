import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { updateLeadAction } from '@/app/actions';
import { CopyButton, LeadActions } from '@/components/LeadActions';
import { Markdown } from '@/components/Markdown';
import { Card, Field, FitScore, KindBadge, StatusBadge } from '@/components/ui';
import { getAgent } from '@/lib/agents';
import { requireUser } from '@/lib/auth';
import { getSetting, q } from '@/lib/db';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { getLead, leadActivities } from '@/lib/leads';
import { hostOf, normalizePhone, safeHttpUrl } from '@/lib/links';
import { STATUSES } from '@/lib/status';
import { NoteForm } from './NoteForm';

export const metadata = { title: 'Lead' };

function ExtLink({ href, children }: { href: string | null | undefined; children?: React.ReactNode }) {
  const url = safeHttpUrl(href);
  if (!url) return <>{children || href || null}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link">
      {children || hostOf(url)}
    </a>
  );
}

function defaultApproach(l: NonNullable<Awaited<ReturnType<typeof getLead>>>): string {
  const lines: string[] = [];
  if (l.kind === 'requirement') {
    lines.push(`They publicly asked for help${l.source_platform ? ` on ${l.source_platform}` : ''}. Reply quickly: early, specific answers win.`);
    lines.push('Restate their requirement in one line so they know you read it, then explain how Brainbric would build it and the first milestone.');
    lines.push('Ask one or two clarifying questions and offer a 15-minute call.');
  } else {
    if (l.pain_point) lines.push(`Open with what you noticed: ${l.pain_point}.`);
    if (l.service_fit) lines.push(`Offer the best-fit service: ${l.service_fit}.`);
    lines.push('Keep it short and ask for a 15-minute call. If there is no reply in 4 days, send one follow-up with a new angle.');
  }
  return lines.map((s) => `- ${s}`).join('\n');
}

export default async function LeadPage({ params }: { params: { id: string } }) {
  await requireUser();
  const id = decodeURIComponent(params.id);
  const lead = await getLead(id);
  if (!lead) notFound();
  const [activities, users, agent, myWhatsapp] = await Promise.all([
    leadActivities(id),
    q<{ id: number; name: string }>('SELECT id, name FROM users WHERE active ORDER BY name'),
    lead.agent ? getAgent(lead.agent) : Promise.resolve(null),
    getSetting('my_whatsapp'),
  ]);
  const wa = normalizePhone(lead.whatsapp || lead.phone);
  const title = lead.company || lead.requirement?.slice(0, 80) || 'Untitled lead';

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> All leads
      </Link>

      <div className="mb-6 border-b border-paper-line pb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusBadge status={lead.status} />
          <KindBadge kind={lead.kind} />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            Fit <FitScore score={lead.fit_score} />
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink-950">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {[lead.contact_name && `${lead.contact_name}${lead.contact_role ? `, ${lead.contact_role}` : ''}`, lead.country, lead.segment]
            .filter(Boolean)
            .join(' · ') || 'Contact person not known yet'}
        </p>
        <div className="mt-4">
          <LeadActions lead={lead} myWhatsapp={myWhatsapp} />
          {!lead.email && !wa && !lead.source_url && (
            <p className="mt-2 text-sm text-ink-500">No email, WhatsApp number or post link is known for this lead yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Who they are">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">{lead.company}</Field>
              <Field label="Website">{lead.website && <ExtLink href={lead.website} />}</Field>
              <Field label="Contact person">{lead.contact_name}</Field>
              <Field label="Role">{lead.contact_role}</Field>
              <Field label="Country">{lead.country}</Field>
              <Field label="Segment">{lead.segment}</Field>
              <Field label="LinkedIn">{lead.linkedin_url && <ExtLink href={lead.linkedin_url}>Profile</ExtLink>}</Field>
              <Field label="Assigned to">{lead.assignee_name}</Field>
            </dl>
          </Card>

          <Card title={lead.kind === 'requirement' ? 'What they asked for' : 'Why they are a lead'}>
            <dl className="grid gap-4">
              {lead.requirement && <Field label="Their requirement">{lead.requirement}</Field>}
              {lead.pain_point && <Field label="Buying signal">{lead.pain_point}</Field>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget">{lead.budget}</Field>
                <Field label="Best-fit Brainbric service">{lead.service_fit}</Field>
              </div>
            </dl>
          </Card>

          <Card title="How to approach them" note={lead.approach ? 'Written by the agent from its research.' : 'General guidance. The agent adds a tailored plan on its next run.'}>
            <Markdown>{lead.approach || defaultApproach(lead)}</Markdown>
          </Card>

          {(lead.email_body || lead.whatsapp_message || lead.bid_text) && (
            <Card title="Messages ready to send" note="Read them first. Nothing is sent until you press Send in Outlook or WhatsApp.">
              <div className="flex flex-col gap-5">
                {lead.email_body && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">Email{lead.email ? ` to ${lead.email}` : ''}</div>
                      <CopyButton text={`${lead.email_subject ? `Subject: ${lead.email_subject}\n\n` : ''}${lead.email_body}`} label="Copy email" leadId={lead.id} type="copy_email" />
                    </div>
                    {lead.email_subject && <div className="mb-1 text-sm font-semibold text-ink-950">{lead.email_subject}</div>}
                    <pre className="whitespace-pre-wrap rounded-md border border-paper-rule bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">{lead.email_body}</pre>
                  </div>
                )}
                {lead.whatsapp_message && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">WhatsApp message</div>
                      <CopyButton text={lead.whatsapp_message} label="Copy message" />
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md border border-paper-rule bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">{lead.whatsapp_message}</pre>
                  </div>
                )}
                {lead.bid_text && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">Bid or reply for {lead.source_platform || 'the post'}</div>
                      <CopyButton text={lead.bid_text} label="Copy bid" leadId={lead.id} type="copy_bid" />
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">{lead.bid_text}</pre>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Where this lead came from">
            <dl className="grid gap-4">
              <Field label="Source">{lead.source_platform || 'Web research'}</Field>
              <Field label="Original post or page">{lead.source_url && <ExtLink href={lead.source_url}>{hostOf(lead.source_url) || 'Open'}</ExtLink>}</Field>
              <Field label="Email found on">{lead.email_source_url && <ExtLink href={lead.email_source_url} />}</Field>
              <Field label="Found by">{agent ? <Link href={`/agents/${agent.slug}`} className="link">{agent.name}</Link> : lead.agent}</Field>
              <Field label="Found on">{fmtDate(lead.created_at)}</Field>
            </dl>
          </Card>

          <Card title="Contact details">
            <dl className="grid gap-4">
              <Field label="Email">{lead.email}</Field>
              <Field label="WhatsApp">{lead.whatsapp || (lead.phone && wa ? lead.phone : null)}</Field>
              <Field label="Phone">{lead.phone}</Field>
              <Field label="First contacted">{lead.first_contacted ? fmtDate(lead.first_contacted) : null}</Field>
              <Field label="Last touch">{lead.last_touch ? fmtDate(lead.last_touch) : null}</Field>
            </dl>
          </Card>

          <Card title="Status and owner">
            <form action={updateLeadAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label htmlFor="status" className="label">
                  Status
                </label>
                <select id="status" name="status" defaultValue={lead.status} className="input">
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assigned_to" className="label">
                  Assigned to
                </label>
                <select id="assigned_to" name="assigned_to" defaultValue={lead.assigned_to ?? ''} className="input">
                  <option value="">Nobody</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-dark">
                Save
              </button>
            </form>
          </Card>

          <Card title="Notes and history">
            <NoteForm id={lead.id} />
            <ol className="mt-4 flex flex-col gap-3 border-l border-paper-line pl-4">
              {activities.map((a) => (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${a.type === 'note' ? 'bg-ink-900' : 'bg-[#CFCAC5]'}`} aria-hidden />
                  <div className="text-sm text-ink-900">{a.note || a.type}</div>
                  <div className="text-xs text-ink-500">
                    {a.actor || 'System'} · {fmtDateTime(a.created_at)}
                  </div>
                </li>
              ))}
              {activities.length === 0 && <li className="text-sm text-ink-500">No activity yet.</li>}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
