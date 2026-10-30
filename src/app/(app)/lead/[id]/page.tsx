import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { Card, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { fmtAgo, fmtDate, fmtDateTime } from '@/lib/format';
import { getRequest, REQUEST_STATUS, TASK_STATUS_LABEL, type RequestStatus } from '@/lib/lead';
import { Decision } from '../Decision';
import { Documents } from '../Documents';
import { docsFor } from '@/lib/docs';
import { StatusPill } from '../StatusPill';

export const metadata = { title: 'Request' };

const STAGES: { label: string; statuses: RequestStatus[] }[] = [
  { label: 'Plan', statuses: ['new', 'planning', 'questions'] },
  { label: 'Your OK', statuses: ['plan_ready'] },
  { label: 'Build & test', statuses: ['approved', 'building'] },
  { label: 'Your OK', statuses: ['ready'] },
  { label: 'Live', statuses: ['going_live', 'live'] },
];

const TASK_TONE: Record<string, string> = {
  passed: 'text-[#0B6B34]',
  done: 'text-[#0B6B34]',
  changes_needed: 'text-[#A32A2D]',
  testing: 'text-[#2F4058]',
  in_progress: 'text-[#2F4058]',
};

export default async function RequestPage({ params }: { params: { id: string } }) {
  const user = await requirePermission('projects');
  const data = await getRequest(Number(params.id));
  if (!data) notFound();
  const { request: r, tasks, log, project } = data;
  const docs = await docsFor(r.id);
  const stage = r.status === 'cancelled' ? -1 : STAGES.findIndex((s) => s.statuses.includes(r.status));
  const admin = user.role === 'admin';
  const builds = tasks.filter((t) => t.role === 'developer');
  const passed = builds.filter((t) => t.status === 'passed' || t.status === 'done').length;

  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={
          <>
            {r.kind === 'new' ? 'New project' : `Change to ${project?.name ?? 'a project'}`} · asked by {r.created_by ?? 'someone'} {fmtAgo(r.created_at)}
            {r.deadline ? ` · deadline ${fmtDate(r.deadline)}` : ''}
          </>
        }
        actions={
          <>
            <StatusPill status={r.status} />
            <Link href="/lead" className="btn-ghost">
              All requests
            </Link>
          </>
        }
      />

      {stage >= 0 && (
        <ol className="mb-6 grid grid-cols-5 gap-1" aria-label="Progress">
          {STAGES.map((s, i) => (
            <li key={i} className="min-w-0">
              <div className={`h-1.5 rounded-full ${i < stage || r.status === 'live' ? 'bg-[#247B50]' : i === stage ? 'bg-flame-deep' : 'bg-paper-line'}`} />
              <div className={`mt-1.5 truncate text-xs ${i === stage ? 'font-medium text-ink-950' : 'text-ink-500'}`}>{s.label}</div>
            </li>
          ))}
        </ol>
      )}

      {/* What needs you now. */}
      {(r.status === 'plan_ready' || r.status === 'questions' || r.status === 'ready') && (
        <div className="mb-6 rounded-card border border-[#F3D9A4] bg-[#FFF9EC] px-5 py-4">
          <div className="text-[15px] font-semibold text-ink-950">
            {r.status === 'plan_ready' ? 'Checkpoint 1: approve the plan' : r.status === 'questions' ? 'Arvind has a question' : 'Checkpoint 2: try it, then approve going live'}
          </div>
          {r.status === 'questions' && r.questions && (
            <div className="mt-2 text-sm text-ink-800">
              <Markdown>{r.questions}</Markdown>
            </div>
          )}
          {r.status === 'plan_ready' && r.questions && (
            <div className="mt-2 text-sm text-ink-700">
              <div className="text-xs font-medium text-ink-500">Arvind also asks:</div>
              <Markdown>{r.questions}</Markdown>
            </div>
          )}
          {r.status === 'ready' && (
            <div className="mt-1 text-sm text-ink-700">
              {r.summary && <Markdown>{r.summary}</Markdown>}
              <div className="mt-2 flex flex-wrap gap-3">
                {r.preview_url && (
                  <a href={r.preview_url} target="_blank" rel="noreferrer" className="btn-dark">
                    Open the preview
                  </a>
                )}
                {r.pr_url && (
                  <a href={r.pr_url} target="_blank" rel="noreferrer" className="btn">
                    See the code changes
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="mt-3">
            {admin ? <Decision id={r.id} status={r.status} /> : <p className="text-sm text-ink-500">An admin approves this step.</p>}
          </div>
        </div>
      )}

      {r.status === 'live' && (
        <div className="mb-6 rounded-card border border-[#BFE7CC] bg-[#F1FBF4] px-5 py-4">
          <div className="text-[15px] font-semibold text-ink-950">Live</div>
          {r.summary && (
            <div className="mt-1 text-sm text-ink-700">
              <Markdown>{r.summary}</Markdown>
            </div>
          )}
          {(r.live_url || project?.live_url) && (
            <a href={r.live_url ?? project!.live_url!} target="_blank" rel="noreferrer" className="btn-dark mt-2 inline-flex">
              Open the live site
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Your request">
            <p className="whitespace-pre-wrap text-sm text-ink-800">{r.brief}</p>
            {r.reply && r.status !== 'live' && (
              <p className="mt-3 rounded-md bg-paper/70 px-3 py-2 text-sm text-ink-700">
                <span className="text-xs font-medium text-ink-500">Your latest answer: </span>
                {r.reply}
              </p>
            )}
          </Card>

          <Card title="Arvind's plan" note={r.plan ? undefined : REQUEST_STATUS[r.status].hint}>
            {r.plan ? <Markdown>{r.plan}</Markdown> : <p className="text-sm text-ink-500">The plan appears here after Arvind&apos;s next check (every hour, 9 AM to 7 PM).</p>}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card flush title="Tasks" note={builds.length ? `${passed} of ${builds.length} built and passed testing` : 'Arvind splits the work into tasks in the plan.'}>
            {tasks.length > 0 && (
              <ol className="divide-y divide-paper-rule">
                {tasks.map((t) => (
                  <li key={t.id} className="px-5 py-2.5">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink-950">
                        <span className="num mr-1.5 text-xs text-ink-400">{t.seq}.</span>
                        {t.title}
                      </span>
                      <span className={`shrink-0 text-xs font-medium ${TASK_TONE[t.status] ?? 'text-ink-500'}`}>{TASK_STATUS_LABEL[t.status]}</span>
                    </div>
                    {t.report && (t.status === 'changes_needed' || t.status === 'passed') && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-950">Pooja&apos;s test report</summary>
                        <div className="mt-1 text-sm text-ink-700">
                          <Markdown>{t.report}</Markdown>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-3 border-t border-paper-rule px-5 py-3 text-xs">
              {project?.repo && (
                <a href={`https://github.com/${project.repo}`} target="_blank" rel="noreferrer" className="font-medium text-ink-500 hover:text-ink-950">
                  Repository
                </a>
              )}
              {r.pr_url && (
                <a href={r.pr_url} target="_blank" rel="noreferrer" className="font-medium text-ink-500 hover:text-ink-950">
                  Pull request
                </a>
              )}
              {r.preview_url && (
                <a href={r.preview_url} target="_blank" rel="noreferrer" className="font-medium text-ink-500 hover:text-ink-950">
                  Preview
                </a>
              )}
            </div>
          </Card>

          <Documents requestId={r.id} docs={docs.docs} pending={docs.pending} />

          <Card flush title="Timeline">
            <ol className="divide-y divide-paper-rule">
              {log.map((l) => (
                <li key={l.id} className="px-5 py-2 text-sm">
                  <span className="font-medium text-ink-950">{l.who}</span> <span className="text-ink-700">{l.text}</span>
                  <div className="num text-xs text-ink-400">{fmtDateTime(l.created_at)}</div>
                </li>
              ))}
            </ol>
          </Card>

          {admin && !['live', 'cancelled'].includes(r.status) && (
            <details className="text-xs text-ink-500">
              <summary className="cursor-pointer hover:text-ink-950">Cancel this request</summary>
              <div className="pt-2">
                <Decision id={r.id} status={r.status} cancelOnly />
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
