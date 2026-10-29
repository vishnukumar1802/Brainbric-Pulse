import Link from 'next/link';
import { AgentFace } from '@/components/AgentFace';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { fmtAgo } from '@/lib/format';
import { listProjects, listRequests, REQUEST_STATUS } from '@/lib/lead';
import { ProjectForm } from './ProjectForm';
import { RequestForm } from './RequestForm';
import { StatusPill } from './StatusPill';

export const metadata = { title: 'Team Lead' };

export default async function LeadPage({ searchParams }: { searchParams: { show?: string; project?: string } }) {
  const user = await requirePermission('projects');
  const show = searchParams.show === 'done' ? 'done' : 'open';
  const [requests, projects] = await Promise.all([listRequests(show), listProjects()]);

  return (
    <>
      <PageHeader
        title="Team Lead"
        subtitle="Tell Arvind what you need: a change to a project or a whole new one. He plans it, you approve the plan, Nikhil builds, Pooja tests, and you approve before anything goes live."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <Card
          title={
            <span className="flex items-center gap-2">
              <AgentFace slug="team-lead" name="Arvind" size={24} /> New request for Arvind
            </span>
          }
          note="Write it the way you would brief a person. Arvind asks if anything is unclear."
        >
          <RequestForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProject={Number(searchParams.project) || null} />
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card
            flush
            title="Requests"
            action={
              <span className="flex gap-1 text-xs">
                <Link href="/lead" className={`rounded px-2 py-0.5 ${show === 'open' ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-500 hover:text-ink-950'}`}>
                  Open
                </Link>
                <Link href="/lead?show=done" className={`rounded px-2 py-0.5 ${show === 'done' ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-500 hover:text-ink-950'}`}>
                  Finished
                </Link>
              </span>
            }
          >
            {requests.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty title={show === 'open' ? 'No open requests' : 'Nothing finished yet'}>{show === 'open' ? 'Send Arvind your first request with the form.' : null}</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-paper-rule">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/lead/${r.id}`} className="block px-5 py-3 transition-colors hover:bg-paper/50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-ink-950">{r.title}</span>
                        <StatusPill status={r.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {r.kind === 'new' ? 'New project' : r.project_name ?? 'Change'} · {REQUEST_STATUS[r.status].hint} · {fmtAgo(r.updated_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card flush title="Projects" note="What the team can work on. Arvind adds the new projects he creates.">
            <ul className="divide-y divide-paper-rule">
              {projects.map((p) => (
                <li key={p.id} className="px-5 py-2.5 text-sm">
                  <div className="font-medium text-ink-950">{p.name}</div>
                  <div className="text-xs text-ink-500">
                    {p.repo ? (
                      <a href={`https://github.com/${p.repo}`} target="_blank" rel="noreferrer" className="hover:text-ink-950">
                        {p.repo}
                      </a>
                    ) : (
                      'No repository yet'
                    )}
                    {p.live_url && (
                      <>
                        {' · '}
                        <a href={p.live_url} target="_blank" rel="noreferrer" className="hover:text-ink-950">
                          {p.live_url.replace(/^https:\/\//, '')}
                        </a>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {user.role === 'admin' && (
              <details className="border-t border-paper-rule px-5 py-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-950">Add or update a project</summary>
                <div className="pt-3">
                  <ProjectForm />
                </div>
              </details>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
