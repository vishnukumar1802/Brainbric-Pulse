'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createUserAction, resetPasswordAction, type FormState } from '@/app/actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
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

export function CreateUserForm() {
  const [state, action] = useFormState(createUserAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="new-name" className="label">
          Name
        </label>
        <input id="new-name" name="name" required className="input" />
      </div>
      <div>
        <label htmlFor="new-email" className="label">
          Email
        </label>
        <input id="new-email" name="email" type="email" required className="input" autoComplete="off" />
      </div>
      <div>
        <label htmlFor="new-password" className="label">
          Password
        </label>
        <input id="new-password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
      </div>
      <div>
        <label htmlFor="new-role" className="label">
          Role
        </label>
        <select id="new-role" name="role" defaultValue="member" className="input">
          <option value="member">Team member: works leads, sees reports</option>
          <option value="admin">Admin: also manages people and settings</option>
        </select>
      </div>
      <Message state={state} />
      <Submit label="Add person" />
    </form>
  );
}

export function ResetPasswordForm({ users }: { users: { id: number; name: string }[] }) {
  const [state, action] = useFormState(resetPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="reset-user" className="label">
          Person
        </label>
        <select id="reset-user" name="id" className="input">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reset-password" className="label">
          New password
        </label>
        <input id="reset-password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
      </div>
      <Message state={state} />
      <Submit label="Set password" />
    </form>
  );
}
