'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { changeOwnPasswordAction, saveSettingsAction, type FormState } from '@/app/actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary self-start" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.error ? 'bg-flame-red/10 text-flame-deep' : 'bg-emerald-50 text-emerald-800'}`}>
      {state.error || state.ok}
    </p>
  );
}

export function OwnPasswordForm() {
  const [state, action] = useFormState(changeOwnPasswordAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="current" className="label">
          Current password
        </label>
        <input id="current" name="current" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="next" className="label">
          New password
        </label>
        <input id="next" name="next" type="password" minLength={8} required className="input" autoComplete="new-password" />
      </div>
      <Message state={state} />
      <Submit label="Change password" />
    </form>
  );
}

export function WorkspaceForm({ myWhatsapp }: { myWhatsapp: string }) {
  const [state, action] = useFormState(saveSettingsAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="my_whatsapp" className="label">
          Your WhatsApp number
        </label>
        <input id="my_whatsapp" name="my_whatsapp" defaultValue={myWhatsapp} placeholder="+91 98765 43210" className="input" inputMode="tel" />
        <p className="mt-1 text-xs text-ink-500">
          Adds a &ldquo;Send to my WhatsApp to review&rdquo; button on each lead, so you can read the message on your phone before sending it on.
        </p>
      </div>
      <Message state={state} />
      <Submit label="Save settings" />
    </form>
  );
}
