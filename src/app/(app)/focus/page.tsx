import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { focusHistory, getFocus } from '@/lib/focus';
import { fmtAgo, fmtDateTime, fmtNum } from '@/lib/format';
import { nichesList } from '@/lib/leads';
import { can } from '@/lib/permissions';
import { focusLabel, serviceInfo } from '@/lib/services';
import { FocusForm } from './FocusForm';

export const metadata = { title: 'Focus' };

export default async function FocusPage() {
  const user = await requirePermission('leads');
  const [focus, history, niches] = await Promise.all([getFocus(), focusHistory(), nichesList()]);
  const s = serviceInfo(focus.service);
  const canEdit = can(user, 'focus');

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="Choose the one service the Lead Hunter and Requirement Hunter work on. They keep hunting only this, every hour, until you change it or pause them. College programs are separate and not affected."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] xl:items-start">
        <Card title={canEdit ? 'Set the focus' : 'Current focus'} note={canEdit ? 'Saved changes apply from the next agent run.' : 'Ask your admin for access to change the focus.'}>
          {canEdit ? (
            <FocusForm current={focus} />
          ) : (
            <div className="text-sm text-ink-700">
              <div className="text-lg font-semibold text-ink-950">{focusLabel(focus)}</div>
              <p className="mt-1">{s.target}</p>
            </div>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Now hunting">
            <div className="text-lg font-semibold text-ink-950">{focusLabel(focus)}</div>
            {focus.product_details && <p className="mt-1 text-sm text-ink-700">{focus.product_details}</p>}
            <dl className="mt-3 grid gap-2 text-sm">
              {focus.regions && (
                <div>
                  <dt className="text-xs text-ink-500">Where</dt>
                  <dd className="text-ink-900">{focus.regions}</dd>
                </div>
              )}
              {focus.notes && (
                <div>
                  <dt className="text-xs text-ink-500">Instructions</dt>
                  <dd className="text-ink-900">{focus.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-500">Set</dt>
                <dd className="text-ink-900">{focus.set_at ? `${fmtAgo(focus.set_at)} by ${focus.set_by ?? 'an admin'}` : 'Not set yet: agents hunt all services'}</dd>
              </div>
            </dl>
          </Card>

          <Card flush title="Leads by niche" note="Leads the agents tagged with the focus they were found under.">
            {niches.length ? (
              <ul className="border-t border-paper-line">
                {niches.map((n) => (
                  <li key={n.niche} className="flex items-baseline justify-between gap-3 border-b border-paper-rule px-5 py-2 last:border-b-0">
                    <Link href={`/leads?niche=${encodeURIComponent(n.niche)}`} className="truncate text-sm text-ink-900 hover:underline">
                      {n.niche}
                    </Link>
                    <span className="num text-xs text-ink-500">{fmtNum(n.n)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-500">No tagged leads yet. New leads are tagged from the next run.</p>
            )}
          </Card>

          {history.length > 1 && (
            <Card flush title="Recent focus changes">
              <ul className="border-t border-paper-line">
                {history.slice(0, 6).map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 border-b border-paper-rule px-5 py-2 last:border-b-0">
                    <span className="truncate text-sm text-ink-900">{focusLabel(h)}</span>
                    <span className="shrink-0 text-xs text-ink-500">{h.set_at ? fmtDateTime(h.set_at) : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
