'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setFocusAction } from '@/app/actions';
import { SERVICES, type Focus } from '@/lib/services';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save focus'}
    </button>
  );
}

export function FocusForm({ current }: { current: Focus }) {
  const [state, action] = useFormState(setFocusAction, undefined);
  const [service, setService] = useState(current.service);
  const picked = SERVICES.find((s) => s.slug === service);

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset>
        <legend className="label">Service to hunt for</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SERVICES.map((s) => (
            <label
              key={s.slug}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors ${
                service === s.slug ? 'border-ink-900 bg-white ring-1 ring-ink-900' : 'border-paper-line bg-white hover:border-ink-400'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink-950">
                <input
                  type="radio"
                  name="service"
                  value={s.slug}
                  checked={service === s.slug}
                  onChange={() => setService(s.slug)}
                  className="accent-ink-900"
                />
                {s.label}
              </span>
              <span className="text-xs text-ink-500">{s.target}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {picked?.needsProduct && (
        <div className="grid gap-3 rounded-md border border-paper-line bg-paper/60 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <label htmlFor="product" className="label">
              Which SaaS product or industry? <span className="text-[#C4242A]">*</span>
            </label>
            <input
              id="product"
              name="product"
              required
              defaultValue={current.product ?? ''}
              placeholder="e.g. Facility Management"
              className="input"
            />
            <p className="mt-1 text-xs text-ink-500">The agents look only for businesses that need this software.</p>
          </div>
          <div>
            <label htmlFor="product_details" className="label">
              What the product does (optional, helps the pitch)
            </label>
            <textarea
              id="product_details"
              name="product_details"
              rows={3}
              defaultValue={current.product_details ?? ''}
              placeholder="e.g. Work orders, staff attendance, asset maintenance and client complaints in one app. ₹2,999/month per site. Link: …"
              className="input"
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="regions" className="label">
            Where to look (optional)
          </label>
          <input id="regions" name="regions" defaultValue={current.regions ?? ''} placeholder="e.g. Tamil Nadu, Bengaluru, UAE" className="input" />
        </div>
        <div>
          <label htmlFor="notes" className="label">
            Extra instructions (optional)
          </label>
          <input id="notes" name="notes" defaultValue={current.notes ?? ''} placeholder="e.g. companies with 20–200 staff; skip hospitals" className="input" />
        </div>
      </div>

      {picked && (
        <div className="rounded-md border border-paper-rule bg-white p-4 text-sm">
          <div className="text-xs font-medium text-ink-700">What the agents will look for</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700">
            {picked.signals.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="mt-2 text-ink-700">
            <span className="text-ink-500">Offer:</span> {picked.offer}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Save />
        {state?.error && <span className="text-sm text-[#C4242A]">{state.error}</span>}
        {state?.ok && <span className="text-sm text-[#247B50]">{state.ok}</span>}
      </div>
    </form>
  );
}
