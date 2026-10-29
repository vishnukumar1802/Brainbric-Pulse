import { Card, Empty, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { one } from '@/lib/db';
import { DEVOPS_AGENT, latestChecks, recentProblems, watchedSites, type SiteCheck } from '@/lib/devops';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import { SitesForm } from './SitesForm';

export const metadata = { title: 'DevOps' };

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-[#247B50]' : 'bg-[#C4242A]'}`} aria-label={ok ? 'OK' : 'Problem'} />;
}

function CheckList({ items, empty }: { items: SiteCheck[]; empty: string }) {
  if (!items.length) return <p className="px-5 pb-5 text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="divide-y divide-paper-rule">
      {items.map((c) => (
        <li key={`${c.kind}:${c.target}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
          <Dot ok={c.ok} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink-950">{c.target.replace(/^https?:\/\//, '')}</div>
            {c.note && <div className={`text-xs ${c.ok ? 'text-ink-500' : 'text-[#A32A2D]'}`}>{c.note}</div>}
          </div>
          <div className="num text-xs text-ink-500">
            {c.status_code ? `${c.status_code} · ` : ''}
            {c.ms != null ? `${(c.ms / 1000).toFixed(1)} s · ` : ''}
            {fmtAgo(c.checked_at)}
          </div>
          {c.link && (
            <a href={c.link} target="_blank" rel="noreferrer" className="text-xs font-medium text-ink-500 hover:text-ink-950">
              Open
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function DevopsPage() {
  const user = await requirePermission('support');
  const [latest, problems, sites, run] = await Promise.all([
    latestChecks(),
    recentProblems(),
    watchedSites(),
    one<{ summary: string | null; created_at: string }>('SELECT summary, created_at FROM agent_runs WHERE agent = $1 ORDER BY created_at DESC LIMIT 1', [DEVOPS_AGENT]),
  ]);
  const siteChecks = latest.filter((c) => c.kind === 'site');
  const deploys = latest.filter((c) => c.kind === 'deploy');
  const down = latest.filter((c) => !c.ok).length;

  return (
    <>
      <PageHeader
        title="DevOps"
        subtitle="Aditya (DevOps Watch) checks the live sites and the latest Vercel deployments at 9 AM, 1 PM and 6 PM, and flags anything down or failing. He only looks; fixing is for the team."
        meta={run ? `Last check ${fmtAgo(run.created_at)}` : 'No check yet'}
      />

      {latest.length === 0 ? (
        <Empty title="No checks yet">The first results appear after Aditya&apos;s next run.</Empty>
      ) : (
        <div className={`mb-6 rounded-card border px-5 py-4 ${down ? 'border-[#F2C4C0] bg-[#FFF5F3]' : 'border-paper-line bg-white'}`}>
          <div className="text-[15px] font-semibold text-ink-950">{down ? `${down} ${down === 1 ? 'problem' : 'problems'} to look at` : 'All systems OK'}</div>
          {run?.summary && <div className="mt-0.5 text-sm text-ink-500">{run.summary}</div>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card flush title="Websites" note="Is each site up, and how fast it answered.">
          <CheckList items={siteChecks} empty="No website checks yet." />
        </Card>
        <Card flush title="Vercel deployments" note="The latest production deployment of each project.">
          <CheckList items={deploys} empty="No deployment checks yet." />
        </Card>
      </div>

      {problems.length > 0 && (
        <Card flush className="mt-6" title="Problems this week" note="Every check that found something wrong, newest first.">
          <ul className="divide-y divide-paper-rule">
            {problems.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <Dot ok={false} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink-950">{c.target.replace(/^https?:\/\//, '')}</span>
                  {c.note && <span className="text-ink-500"> · {c.note}</span>}
                </span>
                <span className="num text-xs text-ink-500">{fmtDateTime(c.checked_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {user.role === 'admin' && (
        <Card className="mt-8" title="Websites to watch" note="One address per line. Vercel projects are found automatically.">
          <SitesForm sites={sites.join('\n')} />
        </Card>
      )}
    </>
  );
}
