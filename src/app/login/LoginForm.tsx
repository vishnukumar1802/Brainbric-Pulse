'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/app/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full py-2.5" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-flame-red/10 px-3 py-2 text-sm text-flame-deep">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}
