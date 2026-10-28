import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FilePlus } from "lucide-react";
import { createProposalAction, updateLeadAction } from "@/app/actions";
import { CopyButton, LeadActions } from "@/components/LeadActions";
import { Markdown } from "@/components/Markdown";
import { CompanyMark, StageTrack } from "@/components/rich";
import {
  Card,
  Field,
  FitScore,
  KindBadge,
  StatusBadge,
  TierBadge,
} from "@/components/ui";
import { getAgent } from "@/lib/agents";
import { requireUser } from "@/lib/auth";
import { can, homeFor } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getSetting, q } from "@/lib/db";
import {
  estValue,
  fmtRupees,
  INSTITUTION_TYPES,
  MIN_BATCH,
  programInfo,
  PROPOSAL_URL,
  TIERS,
} from "@/lib/colleges";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { getLead, leadActivities } from "@/lib/leads";
import { fmtRange } from "@/lib/pricing";
import { listProposals } from "@/lib/proposals";
import { hostOf, normalizePhone, safeHttpUrl } from "@/lib/links";
import { STATUSES } from "@/lib/status";
import { NoteForm } from "./NoteForm";

export const metadata = { title: "Lead" };

function ExtLink({
  href,
  children,
}: {
  href: string | null | undefined;
  children?: React.ReactNode;
}) {
  const url = safeHttpUrl(href);
  if (!url) return <>{children || href || null}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link">
      {children || hostOf(url)}
    </a>
  );
}

function defaultApproach(
  l: NonNullable<Awaited<ReturnType<typeof getLead>>>,
): string {
  const lines: string[] = [];
  if (l.kind === "college") {
    const t = l.tier ? TIERS[l.tier] : null;
    if (t)
      return [
        `**${t.label} playbook.** Pitch: ${t.pitch}`,
        "",
        ...t.approach.map((a) => `- ${a}`),
      ].join("\n");
    lines.push(
      "Write to the Principal, Placement Officer or HoD with the proposal attached.",
    );
    lines.push(
      "Offer the complimentary Industry Insight Talk as a no-risk first step.",
    );
    lines.push(
      "If there is no reply in 4 days, follow up by phone or WhatsApp.",
    );
  } else if (l.kind === "requirement") {
    lines.push(
      `They publicly asked for help${l.source_platform ? ` on ${l.source_platform}` : ""}. Reply quickly: early, specific answers win.`,
    );
    lines.push(
      "Restate their requirement in one line so they know you read it, then explain how Brainbric would build it and the first milestone.",
    );
    lines.push(
      "Ask one or two clarifying questions and offer a 15-minute call.",
    );
  } else {
    if (l.pain_point)
      lines.push(`Open with what you noticed: ${l.pain_point}.`);
    if (l.service_fit)
      lines.push(`Offer the best-fit service: ${l.service_fit}.`);
    lines.push(
      "Keep it short and ask for a 15-minute call. If there is no reply in 4 days, send one follow-up with a new angle.",
    );
  }
  return lines.map((s) => `- ${s}`).join("\n");
}

export default async function LeadPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const id = decodeURIComponent(params.id);
  const lead = await getLead(id);
  if (!lead) notFound();
  if (!can(me, lead.kind === "college" ? "colleges" : "leads")) redirect(homeFor(me));
  const [activities, users, agent, myWhatsapp, proposals] = await Promise.all([
    leadActivities(id),
    q<{ id: number; name: string }>(
      "SELECT id, name FROM users WHERE active ORDER BY name",
    ),
    lead.agent ? getAgent(lead.agent) : Promise.resolve(null),
    getSetting("my_whatsapp"),
    listProposals(id),
  ]);
  const wa = normalizePhone(lead.whatsapp || lead.phone);
  const title =
    lead.company || lead.requirement?.slice(0, 80) || "Untitled lead";
  const isCollege = lead.kind === "college";
  const program = programInfo(lead.program);
  const value = estValue(lead);

  return (
    <>
      <Link
        href={isCollege ? "/colleges" : "/leads"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={15} /> {isCollege ? "All colleges" : "All leads"}
      </Link>

      <div className="card mb-4 grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyMark name={lead.company} post={!lead.company} size={52} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusBadge status={lead.status} />
              {isCollege && <TierBadge tier={lead.tier} />}
              <KindBadge kind={lead.kind} />
              {lead.niche && <span className="text-xs text-ink-500">· {lead.niche}</span>}
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                Fit <FitScore score={lead.fit_score} />
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.01em] text-ink-950">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-ink-500">
              {(isCollege
                ? [
                    INSTITUTION_TYPES[lead.institution_type ?? ""],
                    lead.district,
                    lead.accreditation,
                    lead.contact_name &&
                      `${lead.contact_name}${lead.contact_role ? `, ${lead.contact_role}` : ""}`,
                  ]
                : [
                    lead.contact_name &&
                      `${lead.contact_name}${lead.contact_role ? `, ${lead.contact_role}` : ""}`,
                    lead.country,
                    lead.segment,
                  ]
              )
                .filter(Boolean)
                .join(" · ") || "Contact person not known yet"}
            </p>
          </div>
        </div>
        <StageTrack status={lead.status} kind={lead.kind} />
        <div className="lg:col-span-2 border-t border-paper-rule pt-4">
          <div className="flex flex-wrap items-start gap-2">
            <LeadActions lead={lead} myWhatsapp={myWhatsapp} />
            {isCollege && (
              <a href={PROPOSAL_URL} download className="btn-ghost">
                <Download size={15} className="text-ink-500" /> Proposal PDF
              </a>
            )}
          </div>
          {!lead.email && !wa && !lead.source_url && (
            <p className="mt-2 text-sm text-ink-500">
              No email, WhatsApp number or post link is known for this lead yet.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {isCollege ? (
            <>
              <Card title="Institution">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="College">{lead.company}</Field>
                  <Field label="Website">
                    {lead.website && <ExtLink href={lead.website} />}
                  </Field>
                  <Field label="Type">
                    {INSTITUTION_TYPES[lead.institution_type ?? ""]}
                  </Field>
                  <Field label="Tier">
                    {lead.tier ? (
                      <span className="flex flex-col items-start gap-1">
                        <TierBadge tier={lead.tier} />
                        {lead.tier_reason && (
                          <span className="text-xs text-ink-500">
                            {lead.tier_reason}
                          </span>
                        )}
                      </span>
                    ) : null}
                  </Field>
                  <Field label="University or board">{lead.university}</Field>
                  <Field label="Accreditation">{lead.accreditation}</Field>
                  <Field label="District">
                    {[lead.district, lead.state].filter(Boolean).join(", ")}
                  </Field>
                  <Field label="Department">{lead.department}</Field>
                  <Field label="Contact person">{lead.contact_name}</Field>
                  <Field label="Role">{lead.contact_role}</Field>
                  <Field label="Students in reach">
                    {lead.student_strength
                      ? `About ${fmtNum(lead.student_strength)}`
                      : null}
                  </Field>
                  <Field label="Assigned to">{lead.assignee_name}</Field>
                </dl>
              </Card>

              <Card
                title="What to pitch"
                note={
                  lead.tier
                    ? `${TIERS[lead.tier].label}: ${TIERS[lead.tier].pitch}`
                    : undefined
                }
              >
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Program">
                    {program ? `${program.label} (${program.duration})` : null}
                  </Field>
                  <Field label="Estimated value">
                    {value != null ? (
                      <span className="num">
                        <span className="font-semibold">
                          {fmtRupees(value)}
                        </span>
                        {program && !("flat" in program && program.flat) && (
                          <span className="text-ink-500">
                            {" "}
                            = {fmtRupees(program.fee)} ×{" "}
                            {fmtNum(
                              Math.max(
                                MIN_BATCH,
                                lead.student_strength ?? MIN_BATCH,
                              ),
                            )}{" "}
                            students
                          </span>
                        )}
                      </span>
                    ) : program && program.fee === 0 ? (
                      "Complimentary first step"
                    ) : null}
                  </Field>
                  <Field label="Domain">{lead.domain}</Field>
                  <Field label="Best time to approach">{lead.best_time}</Field>
                  <div className="sm:col-span-2">
                    <Field label="Why now">{lead.pain_point}</Field>
                  </div>
                </dl>
              </Card>
            </>
          ) : (
            <>
              <Card title="Who they are">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company">{lead.company}</Field>
                  <Field label="Website">
                    {lead.website && <ExtLink href={lead.website} />}
                  </Field>
                  <Field label="Contact person">{lead.contact_name}</Field>
                  <Field label="Role">{lead.contact_role}</Field>
                  <Field label="Country">{lead.country}</Field>
                  <Field label="Segment">{lead.segment}</Field>
                  <Field label="LinkedIn">
                    {lead.linkedin_url && (
                      <ExtLink href={lead.linkedin_url}>Profile</ExtLink>
                    )}
                  </Field>
                  <Field label="Assigned to">{lead.assignee_name}</Field>
                </dl>
              </Card>

              <Card
                title={
                  lead.kind === "requirement"
                    ? "What they asked for"
                    : "Why they are a lead"
                }
              >
                <dl className="grid gap-4">
                  {lead.requirement && (
                    <Field label="Their requirement">{lead.requirement}</Field>
                  )}
                  {lead.pain_point && (
                    <Field label="Buying signal">{lead.pain_point}</Field>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Budget">{lead.budget}</Field>
                    <Field label="Best-fit Brainbric service">
                      {lead.service_fit}
                    </Field>
                  </div>
                </dl>
              </Card>
            </>
          )}

          <Card
            title="How to approach them"
            note={
              lead.approach
                ? "Written by the agent from its research."
                : isCollege
                  ? "The tier playbook. The agent adds a plan for this college on its next run."
                  : "General guidance. The agent adds a tailored plan on its next run."
            }
          >
            <Markdown>{lead.approach || defaultApproach(lead)}</Markdown>
          </Card>

          {(lead.email_body || lead.whatsapp_message || lead.bid_text) && (
            <Card
              title="Messages ready to send"
              note="Read them first. Nothing is sent until you press Send in Outlook or WhatsApp."
            >
              <div className="flex flex-col gap-5">
                {lead.email_body && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">
                        Email{lead.email ? ` to ${lead.email}` : ""}
                      </div>
                      <CopyButton
                        text={`${lead.email_subject ? `Subject: ${lead.email_subject}\n\n` : ""}${lead.email_body}`}
                        label="Copy email"
                        leadId={lead.id}
                        type="copy_email"
                      />
                    </div>
                    {lead.email_subject && (
                      <div className="mb-1 text-sm font-semibold text-ink-950">
                        {lead.email_subject}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap rounded-md border border-paper-rule bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">
                      {lead.email_body}
                    </pre>
                  </div>
                )}
                {lead.whatsapp_message && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">
                        WhatsApp message
                      </div>
                      <CopyButton
                        text={lead.whatsapp_message}
                        label="Copy message"
                      />
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md border border-paper-rule bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">
                      {lead.whatsapp_message}
                    </pre>
                  </div>
                )}
                {lead.bid_text && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-ink-700">
                        Bid or reply for {lead.source_platform || "the post"}
                      </div>
                      <CopyButton
                        text={lead.bid_text}
                        label="Copy bid"
                        leadId={lead.id}
                        type="copy_bid"
                      />
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg bg-paper p-4 font-sans text-sm leading-relaxed text-ink-800">
                      {lead.bid_text}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            flush
            title="Proposals"
            note={
              isCollege
                ? "A personalised version of the Industry Readiness proposal for this college."
                : "A branded proposal with scope, timeline and a tentative price range."
            }
            action={
              <form action={createProposalAction}>
                <input type="hidden" name="lead_id" value={lead.id} />
                <button type="submit" className="btn-ghost h-7 px-2.5 text-xs">
                  <FilePlus size={13} className="text-ink-500" />{" "}
                  {proposals.length ? "New version" : "Create proposal"}
                </button>
              </form>
            }
          >
            {proposals.length ? (
              <ul className="border-t border-paper-line">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 border-b border-paper-rule px-5 py-2.5 last:border-b-0"
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      className="min-w-0 hover:underline"
                    >
                      <span className="block truncate text-sm font-medium text-ink-950">
                        {p.title}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {fmtRange(p.price_min, p.price_max, p.currency)} ·{" "}
                        {p.source === "agent" ? "by the agent" : p.prepared_by} ·{" "}
                        {fmtDate(p.created_at)}
                      </span>
                    </Link>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${p.status === "sent" ? "bg-[#DCFAE5] text-[#0B3D1C]" : "bg-flame-tint text-flame-ink"}`}
                    >
                      {p.status === "sent" ? "Sent" : "Draft"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-500">
                No proposal yet. Create one, check it, then download the PDF.
              </p>
            )}
          </Card>

          <Card title="Where this lead came from">
            <dl className="grid gap-4">
              <Field label="Source">
                {lead.source_platform || "Web research"}
              </Field>
              <Field label="Original post or page">
                {lead.source_url && (
                  <ExtLink href={lead.source_url}>
                    {hostOf(lead.source_url) || "Open"}
                  </ExtLink>
                )}
              </Field>
              <Field label="Email found on">
                {lead.email_source_url && (
                  <ExtLink href={lead.email_source_url} />
                )}
              </Field>
              <Field label="Found by">
                {agent ? (
                  <Link href={`/agents/${agent.slug}`} className="link">
                    {agent.name}
                  </Link>
                ) : (
                  lead.agent
                )}
              </Field>
              <Field label="Found on">{fmtDate(lead.created_at)}</Field>
            </dl>
          </Card>

          <Card title="Contact details">
            <dl className="grid gap-4">
              <Field label="Email">{lead.email}</Field>
              <Field label="WhatsApp">
                {lead.whatsapp || (lead.phone && wa ? lead.phone : null)}
              </Field>
              <Field label="Phone">{lead.phone}</Field>
              <Field label="First contacted">
                {lead.first_contacted ? fmtDate(lead.first_contacted) : null}
              </Field>
              <Field label="Last touch">
                {lead.last_touch ? fmtDate(lead.last_touch) : null}
              </Field>
            </dl>
          </Card>

          <Card title="Status and owner">
            <form action={updateLeadAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label htmlFor="status" className="label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={lead.status}
                  className="input"
                >
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
                <select
                  id="assigned_to"
                  name="assigned_to"
                  defaultValue={lead.assigned_to ?? ""}
                  className="input"
                >
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
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${a.type === "note" ? "bg-ink-900" : "bg-[#CFCAC5]"}`}
                    aria-hidden
                  />
                  <div className="text-sm text-ink-900">{a.note || a.type}</div>
                  <div className="text-xs text-ink-500">
                    {a.actor || "System"} · {fmtDateTime(a.created_at)}
                  </div>
                </li>
              ))}
              {activities.length === 0 && (
                <li className="text-sm text-ink-500">No activity yet.</li>
              )}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
