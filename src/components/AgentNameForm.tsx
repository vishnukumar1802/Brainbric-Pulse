'use client';

import { Check } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';
import { renameAgentAction } from '@/app/actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-ghost h-8 px-2.5 text-xs" aria-label="Save name">
      {pending ? 'Saving…' : <Check size={14} />}
    </button>
  );
}

/** Inline name box for one agent on the AI team page. Only admins see it. */
export function AgentNameForm({ slug, nickname, role }: { slug: string; nickname: string | null; role: string }) {
  const [state, action] = useFormState(renameAgentAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-center gap-1.5">
        <input
          name="nickname"
          defaultValue={nickname ?? ''}
          maxLength={24}
          placeholder="Give a name, e.g. Arjun"
          aria-label={`Name for ${role}`}
          className="input h-8 w-[11rem] text-sm"
        />
        <Save />
      </div>
      {state?.error && <p className="text-xs text-[#C4242A]">{state.error}</p>}
      {state?.ok && <p className="text-xs text-[#247B50]">{state.ok}</p>}
    </form>
  );
}
