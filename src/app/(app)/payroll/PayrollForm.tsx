'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { savePayrollAction } from '@/app/actions';

type Row = { agent: string; name: string; model: string; budget: number | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary self-start" disabled={pending}>
      {pending ? 'Saving…' : 'Save payroll settings'}
    </button>
  );
}

/** Each agent's model and monthly budget, and the dollar rate (admin only). */
export function PayrollForm({ rows, usdInr, models }: { rows: Row[]; usdInr: number; models: { value: string; label: string }[] }) {
  const [state, action] = useFormState(savePayrollAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium">Monthly budget (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-rule">
            {rows.map((r) => (
              <tr key={r.agent}>
                <td className="py-1.5 pr-3 text-ink-800">{r.name}</td>
                <td className="py-1.5 pr-3">
                  <select name={`model_${r.agent}`} defaultValue={r.model} className="input h-8 py-0 text-sm" aria-label={`${r.name} model`}>
                    {models.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5">
                  <input
                    name={`budget_${r.agent}`}
                    defaultValue={r.budget ?? ''}
                    inputMode="numeric"
                    placeholder="No limit"
                    className="input h-8 w-32 text-sm"
                    aria-label={`${r.name} monthly budget`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label htmlFor="usd_inr" className="label">
          Dollar rate (₹ per US$)
        </label>
        <input id="usd_inr" name="usd_inr" defaultValue={usdInr} inputMode="decimal" className="input w-32" />
      </div>
      <p className="text-xs text-ink-500">
        At 80% of a budget Lakshmi posts a warning in Teams; at 100% the agent is paused until you raise the budget or start it again.
        Changing a model affects new shifts only.
      </p>
      {state && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${state.error ? 'bg-[#FFEDEA] text-[#831C1E]' : 'bg-[#DCFAE5] text-[#0B3D1C]'}`}>
          {state.error || state.ok}
        </p>
      )}
      <Submit />
    </form>
  );
}
