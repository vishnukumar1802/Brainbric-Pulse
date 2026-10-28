'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { savePriceGuideAction } from '@/app/actions';
import type { PriceRow } from '@/lib/pricing';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save price guide'}
    </button>
  );
}

function Pair({ name, value, prefix }: { name: string; value: [number, number] | undefined; prefix: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-ink-500">{prefix}</span>
      <input name={`${name}0`} defaultValue={value?.[0] ?? ''} inputMode="numeric" className="input num h-7 w-[84px] px-1.5 text-right text-xs" aria-label={`${name} from`} />
      <span className="text-xs text-ink-400">–</span>
      <input name={`${name}1`} defaultValue={value?.[1] ?? ''} inputMode="numeric" className="input num h-7 w-[84px] px-1.5 text-right text-xs" aria-label={`${name} to`} />
    </div>
  );
}

export function PriceGuideForm({ rows, terms }: { rows: PriceRow[]; terms: string }) {
  const [state, action] = useFormState(savePriceGuideAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-paper-line text-left text-xs font-medium text-ink-500">
              <th className="py-2 pr-3">Service</th>
              <th className="py-2 pr-3">India (₹)</th>
              <th className="py-2 pr-3">International ($)</th>
              <th className="py-2">Timeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-rule">
            {rows.map((r) => (
              <tr key={r.slug} className="align-top">
                <td className="py-2 pr-3 text-ink-900">
                  {r.label}
                  {r.unit === 'month' && <span className="block text-xs text-ink-500">per month</span>}
                  {r.monthly_inr && <span className="block text-xs text-ink-500">setup, then monthly below</span>}
                </td>
                <td className="py-2 pr-3">
                  <Pair name={`${r.slug}.inr`} value={r.inr} prefix="₹" />
                  {r.monthly_inr && (
                    <div className="mt-1">
                      <Pair name={`${r.slug}.minr`} value={r.monthly_inr} prefix="₹/mo" />
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Pair name={`${r.slug}.usd`} value={r.usd} prefix="$" />
                  {r.monthly_usd && (
                    <div className="mt-1">
                      <Pair name={`${r.slug}.musd`} value={r.monthly_usd} prefix="$/mo" />
                    </div>
                  )}
                </td>
                <td className="py-2">
                  <input name={`${r.slug}.timeline`} defaultValue={r.timeline} className="input h-7 w-[150px] text-xs" aria-label={`${r.label} timeline`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label htmlFor="terms" className="label">
          Payment and price terms (one per line, shown in every client proposal)
        </label>
        <textarea id="terms" name="terms" rows={6} defaultValue={terms} className="input leading-relaxed" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Save />
        {state?.error && <span className="text-sm text-[#C4242A]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-[#247B50]">{state.ok}</span>}
      </div>
    </form>
  );
}
