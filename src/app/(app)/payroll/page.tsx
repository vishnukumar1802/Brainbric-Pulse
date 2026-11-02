import Link from 'next/link';
import { AgentFace } from '@/components/AgentFace';
import { Card, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { fmtAgo } from '@/lib/format';
import { dailyCost, inr, MODEL_LABEL, MODELS, payroll, payrollConfig, tokensText, type Payslip } from '@/lib/payroll';
import { PayrollForm } from './PayrollForm';

export const metadata = { title: 'Payroll' };
export const dynamic = 'force-dynamic';

const monthLabel = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m: string, by: number) => {
  const d = new Date(m + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.01em] text-ink-950">{value}</div>
      {note && <div className="mt-0.5 truncate text-xs text-ink-500">{note}</div>}
    </div>
  );
}

function BudgetBar({ s }: { s: Payslip }) {
  if (!s.budget) return <span className="text-xs text-ink-500">No limit</span>;
  const used = s.inr / s.budget;
  const tone = used >= 1 ? 'bg-[#B42318]' : used >= 0.8 ? 'bg-[#D97706]' : 'bg-[#16A34A]';
  return (
    <div className="w-28">
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800/10">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
      </div>
      <div className="mt-1 text-xs tabular-nums text-ink-500">
        {Math.round(used * 100)}% of {inr(s.budget)}
      </div>
    </div>
  );
}

export default async function PayrollPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requirePermission('agents');
  const admin = user.role === 'admin';
  const [p, days, cfg] = await Promise.all([payroll(searchParams.month), dailyCost(searchParams.month), payrollConfig()]);
  const current = new Date().toISOString().slice(0, 7);
  const working = p.slips.filter((s) => s.shifts > 0);
  const top = working[0];
  const maxDay = Math.max(...days.map((d) => d.inr), 0.01);

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="What each AI agent costs, like salaries. Estimated from every shift the agents work; your Claude plan's price stays fixed."
        actions={
          <div className="flex items-center gap-1 text-sm">
            <Link href={`/payroll?month=${shiftMonth(p.month, -1)}`} className="btn h-8 px-2.5" aria-label="Previous month">
              ‹
            </Link>
            <span className="min-w-[8.5rem] text-center font-medium text-ink-950">{monthLabel(p.month)}</span>
            {p.month < current ? (
              <Link href={`/payroll?month=${shiftMonth(p.month, 1)}`} className="btn h-8 px-2.5" aria-label="Next month">
                ›
              </Link>
            ) : (
              <span className="btn h-8 px-2.5 opacity-40" aria-hidden>
                ›
              </span>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Team salary this month" value={inr(p.totalInr)} note={`About US$${p.totalUsd.toFixed(2)} at list prices`} />
        <Stat label="Tokens used" value={tokensText(p.totalTokens)} note="Estimated, mostly cached reads" />
        <Stat label="Shifts worked" value={working.reduce((n, s) => n + s.shifts, 0).toLocaleString('en-IN')} note={`${working.length} of ${p.slips.length} agents worked`} />
        <Stat label="Highest paid" value={top ? top.name : '-'} note={top ? `${inr(top.inr)} · ${Math.round(top.share * 100)}% of the total` : 'No shifts yet'} />
      </div>

      <Card title="Payslips" note="Most expensive first. Cost per piece of work shows value for money." flush className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-paper-rule text-left text-xs text-ink-500">
                <th className="px-5 pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 text-right font-medium">Shifts</th>
                <th className="pb-2 text-right font-medium">Hours on duty</th>
                <th className="pb-2 text-right font-medium">Tokens</th>
                <th className="pb-2 text-right font-medium">Salary</th>
                <th className="pb-2 pl-5 font-medium">Budget</th>
                <th className="px-5 pb-2 font-medium">Work done</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-rule">
              {p.slips.map((s) => (
                <tr key={s.agent} className={s.shifts ? '' : 'text-ink-500'}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <AgentFace slug={s.agent} name={s.name} size={28} />
                      <div className="min-w-0">
                        <div className="font-medium text-ink-950">
                          {s.name}
                          {s.paused && <span className="ml-1.5 rounded bg-[#F0EEEB] px-1 text-[11px] font-normal text-ink-500">paused</span>}
                        </div>
                        <div className="truncate text-xs text-ink-500">
                          {s.role}
                          {s.last ? ` · last shift ${fmtAgo(s.last)}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-ink-700">{MODEL_LABEL[s.model]}</td>
                  <td className="py-2.5 text-right tabular-nums">{s.shifts}</td>
                  <td className="py-2.5 text-right tabular-nums">{s.hours.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{tokensText(s.tokens)}</td>
                  <td className="py-2.5 text-right">
                    <div className="font-semibold tabular-nums text-ink-950">{inr(s.inr)}</div>
                    <div className="text-xs tabular-nums text-ink-500">{Math.round(s.share * 100)}%</div>
                  </td>
                  <td className="py-2.5 pl-5">
                    <BudgetBar s={s} />
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="tabular-nums text-ink-800">
                      {s.work} {s.workLabel}
                    </div>
                    {s.work > 0 && <div className="text-xs tabular-nums text-ink-500">{inr(s.inr / s.work)} each</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Daily cost" note={`Whole team, ${monthLabel(p.month)}, India time.`}>
          <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Daily team cost bar chart">
            {days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end">
                <div className="w-full rounded-t-sm bg-flame-orange group-hover:bg-flame-red" style={{ height: `${Math.max(d.inr > 0 ? 3 : 0, (d.inr / maxDay) * 100)}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-950 px-1.5 py-0.5 text-[11px] text-white group-hover:block">
                  {Number(d.day.slice(8))}: {inr(d.inr)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
            <span>1</span>
            <span>{days.length}</span>
          </div>
        </Card>

        <Card title="How salaries are worked out">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink-700">
            <li>Every call an agent makes to the portal is clocked. Calls less than 20 minutes apart make one shift.</li>
            <li>Each shift is turned into agent turns, then tokens (about 34K per turn, mostly read from cache), then rupees at Claude list prices.</li>
            <li>Sonnet costs about 20 times more per token than Haiku, so the model matters more than the hours.</li>
            <li>These are estimates for comparing agents and setting budgets. Agents on your Claude plan do not add to a bill per token.</li>
          </ul>
        </Card>

        {admin && (
          <Card title="Models and budgets" note="Admin only." className="xl:col-span-2">
            <PayrollForm
              rows={p.slips.map((s) => ({ agent: s.agent, name: s.name, model: s.model, budget: s.budget })).sort((a, b) => a.name.localeCompare(b.name))}
              usdInr={cfg.usd_inr}
              models={MODELS.map((m) => ({ value: m, label: MODEL_LABEL[m] }))}
            />
          </Card>
        )}
      </div>
    </>
  );
}
