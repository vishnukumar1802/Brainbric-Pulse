'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveProposalAction } from '@/app/actions';

type Section = { key: string; heading: string; body: string };

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save proposal'}
    </button>
  );
}

export function ProposalForm({
  proposal,
}: {
  proposal: {
    id: number;
    kind: 'software' | 'college';
    title: string;
    sections: Section[];
    currency: 'INR' | 'USD';
    price_min: number | null;
    price_max: number | null;
    monthly_min: number | null;
    monthly_max: number | null;
  };
}) {
  const [state, action] = useFormState(saveProposalAction, undefined);
  const college = proposal.kind === 'college';
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={proposal.id} />
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input id="title" name="title" defaultValue={proposal.title} required className="input" />
      </div>

      <fieldset className="rounded-md border border-paper-line p-4">
        <legend className="px-1 text-xs font-medium text-ink-700">{college ? 'Program fee' : 'Price range (tentative)'}</legend>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
          <div>
            <label htmlFor="currency" className="label">
              Currency
            </label>
            <select id="currency" name="currency" defaultValue={proposal.currency} className="input">
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
          <div>
            <label htmlFor="price_min" className="label">
              {college ? 'Estimated total' : 'From'}
            </label>
            <input id="price_min" name="price_min" inputMode="numeric" defaultValue={proposal.price_min ?? ''} className="input num" />
          </div>
          <div>
            <label htmlFor="price_max" className="label">
              {college ? 'Up to (optional)' : 'To'}
            </label>
            <input id="price_max" name="price_max" inputMode="numeric" defaultValue={proposal.price_max ?? ''} className="input num" />
          </div>
        </div>
        {!college && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
            <div className="text-xs text-ink-500 sm:pt-7">Monthly (optional)</div>
            <div>
              <label htmlFor="monthly_min" className="label">
                From
              </label>
              <input id="monthly_min" name="monthly_min" inputMode="numeric" defaultValue={proposal.monthly_min ?? ''} className="input num" />
            </div>
            <div>
              <label htmlFor="monthly_max" className="label">
                To
              </label>
              <input id="monthly_max" name="monthly_max" inputMode="numeric" defaultValue={proposal.monthly_max ?? ''} className="input num" />
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-500">
          {college
            ? 'Worked out from the program fee and the batch size. Change it if you agreed a different batch.'
            : 'Taken from the price guide for this kind of project. Keep it a range; the final quote follows the scoping call.'}
        </p>
      </fieldset>

      {proposal.sections.map((s) => (
        <div key={s.key}>
          <label htmlFor={`section_${s.key}`} className="label">
            {s.heading}
          </label>
          <textarea
            id={`section_${s.key}`}
            name={`section_${s.key}`}
            defaultValue={s.body}
            rows={Math.min(14, Math.max(3, s.body.split('\n').length + 1))}
            className="input leading-relaxed"
          />
        </div>
      ))}
      <p className="-mt-2 text-xs text-ink-500">Start a line with "- " for a bullet point, or "1. " for a numbered step.</p>

      <div className="flex flex-wrap items-center gap-3">
        <Save />
        {state?.error && <span className="text-sm text-[#C4242A]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-[#247B50]">{state.ok}</span>}
      </div>
    </form>
  );
}
