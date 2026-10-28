'use client';

import { Check, Copy, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createUserAction, resetPasswordAction, updateUserAction, type FormState } from '@/app/actions';
import { DEFAULT_PERMISSIONS, PERMISSIONS, type Permission } from '@/lib/permissions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary self-start" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state || (!state.error && !state.ok)) return null;
  return (
    <p role="status" className={`rounded-md px-3 py-2 text-sm ${state.error ? 'bg-[#FFEDEA] text-[#831C1E]' : 'bg-[#DCFAE5] text-[#0B3D1C]'}`}>
      {state.error || state.ok}
    </p>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-paper-line bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-ink-500">{label}</div>
        <div className="truncate font-mono text-sm text-ink-950">{value}</div>
      </div>
      <button
        type="button"
        className="btn-ghost h-7 px-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* the value stays visible to select by hand */
          }
        }}
      >
        {done ? <Check size={13} /> : <Copy size={13} className="text-ink-500" />} {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Shown once after an admin creates a person or sets a password. Passwords are stored hashed, so this is the only time it is visible. */
function Credentials({ state }: { state: FormState }) {
  if (!state?.credentials) return null;
  const { username, password } = state.credentials;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-flame-amber/50 bg-flame-tint p-3">
      <div className="text-xs font-medium text-flame-ink">Give these to the person now. The password will not be shown again.</div>
      <CopyField label="User ID" value={username} />
      <CopyField label="Password" value={password} />
      <CopyField label="Both, ready to send" value={`Brainbric Pulse sign-in\nUser ID: ${username}\nPassword: ${password}`} />
    </div>
  );
}

function generatePassword(): string {
  // 14 characters without look-alikes (0/O, 1/l/I), from the browser's secure random source.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function PasswordField({ id, name, label }: { id: string; name: string; label: string }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type="text"
          minLength={8}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input font-mono"
          autoComplete="new-password"
          spellCheck={false}
          placeholder="At least 8 characters"
        />
        <button type="button" className="btn-ghost shrink-0" onClick={() => setValue(generatePassword())}>
          <RefreshCw size={13} className="text-ink-500" /> Generate
        </button>
      </div>
    </div>
  );
}

function PermissionChecks({ defaults, disabled = false }: { defaults: Permission[]; disabled?: boolean }) {
  return (
    <fieldset>
      <legend className="label">Access (team members)</legend>
      <div className="grid gap-1.5">
        {PERMISSIONS.map((p) => (
          <label key={p.key} className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${disabled ? 'opacity-50' : 'hover:bg-paper'}`}>
            <input type="checkbox" name="permissions" value={p.key} defaultChecked={defaults.includes(p.key)} disabled={disabled} className="mt-0.5 accent-ink-900" />
            <span>
              <span className="block text-sm text-ink-900">{p.label}</span>
              <span className="block text-xs text-ink-500">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RoleAndAccess({ role, permissions, lockRole }: { role: 'admin' | 'member'; permissions: Permission[]; lockRole?: boolean }) {
  const [r, setR] = useState(role);
  return (
    <>
      <div>
        <label htmlFor="role" className="label">
          Role
        </label>
        <select id="role" name="role" value={r} onChange={(e) => setR(e.target.value as 'admin' | 'member')} disabled={lockRole} className="input">
          <option value="member">Team member: only the parts ticked below</option>
          <option value="admin">Admin: everything, plus people, passwords and settings</option>
        </select>
        {lockRole && <input type="hidden" name="role" value={r} />}
      </div>
      {r === 'admin' ? (
        <p className="rounded-md bg-paper px-3 py-2 text-xs text-ink-500">Admins can open everything, so no access ticks are needed.</p>
      ) : (
        <PermissionChecks defaults={permissions} />
      )}
    </>
  );
}

export function CreateUserForm() {
  const [state, action] = useFormState(createUserAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setKey((k) => k + 1);
    }
  }, [state]);
  return (
    <div className="flex flex-col gap-3">
      <Credentials state={state} />
      <form ref={ref} key={key} action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-name" className="label">
              Name
            </label>
            <input id="new-name" name="name" required className="input" />
          </div>
          <div>
            <label htmlFor="new-username" className="label">
              User ID
            </label>
            <input
              id="new-username"
              name="username"
              required
              className="input font-mono"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. sales01"
            />
          </div>
        </div>
        <PasswordField id="new-password" name="password" label="Password" />
        <div>
          <label htmlFor="new-email" className="label">
            Email (optional)
          </label>
          <input id="new-email" name="email" type="email" className="input" autoComplete="off" />
        </div>
        <RoleAndAccess role="member" permissions={DEFAULT_PERMISSIONS} />
        <Message state={state?.credentials ? undefined : state} />
        <Submit label="Add person" />
      </form>
    </div>
  );
}

export function EditUserForm({
  user,
  isSelf,
}: {
  user: { id: number; name: string; username: string; email: string | null; role: 'admin' | 'member'; permissions: Permission[]; active: boolean };
  isSelf: boolean;
}) {
  const [state, action] = useFormState(updateUserAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={user.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input id="name" name="name" required defaultValue={user.name} className="input" />
        </div>
        <div>
          <label htmlFor="username" className="label">
            User ID
          </label>
          <input
            id="username"
            name="username"
            required
            defaultValue={user.username}
            className="input font-mono"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email (optional)
        </label>
        <input id="email" name="email" type="email" defaultValue={user.email ?? ''} className="input" autoComplete="off" />
      </div>
      <RoleAndAccess role={user.role} permissions={user.permissions} lockRole={isSelf} />
      <div>
        <span className="label">Sign-in</span>
        {isSelf ? (
          <>
            <input type="hidden" name="active" value="true" />
            <p className="text-sm text-ink-500">You cannot turn off your own access.</p>
          </>
        ) : (
          <div className="flex gap-4 text-sm text-ink-900">
            <label className="flex items-center gap-2">
              <input type="radio" name="active" value="true" defaultChecked={user.active} className="accent-ink-900" /> Allowed
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="active" value="false" defaultChecked={!user.active} className="accent-ink-900" /> Turned off
            </label>
          </div>
        )}
      </div>
      <Message state={state} />
      <Submit label="Save changes" />
    </form>
  );
}

export function SetPasswordForm({ id }: { id: number }) {
  const [state, action] = useFormState(resetPasswordAction, undefined);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.credentials) setKey((k) => k + 1);
  }, [state]);
  return (
    <div className="flex flex-col gap-3">
      <Credentials state={state} />
      <form key={key} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <PasswordField id="set-password" name="password" label="New password" />
        <Message state={state?.credentials ? undefined : state} />
        <Submit label="Set password" />
      </form>
    </div>
  );
}
