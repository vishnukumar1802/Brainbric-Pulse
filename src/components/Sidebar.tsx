import { Bot, FileText, Gauge, LogOut, Megaphone, Settings, Target, Users, Zap } from 'lucide-react';
import { logoutAction } from '@/app/actions';
import type { Agent } from '@/lib/agents';
import type { User } from '@/lib/auth';
import { Brand } from './Brand';
import { NavLink } from './NavLink';

export function SidebarContent({ user, agents, counts }: { user: User; agents: Agent[]; counts: { drafted: number; hot: number } }) {
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-2">
        <Brand />
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        <NavLink href="/" exact>
          <Gauge size={17} /> Overview
        </NavLink>
        <NavLink href="/leads" badge={counts.drafted}>
          <Target size={17} /> Leads
        </NavLink>
        <NavLink href="/hot">
          <Zap size={17} /> Hot leads {counts.hot ? <span className="ml-auto text-[11px] text-flame-amber">{counts.hot}</span> : null}
        </NavLink>
        <NavLink href="/reports">
          <FileText size={17} /> Reports
        </NavLink>
      </nav>

      <div>
        <div className="mb-1.5 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          <span>AI team</span>
          <Bot size={13} />
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="AI agents">
          <NavLink href="/agents" exact sub>
            <Megaphone size={14} /> All agents
          </NavLink>
          {agents.map((a) => (
            <NavLink key={a.slug} href={`/agents/${a.slug}`} sub>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.paused ? 'bg-flame-amber' : a.last_status === 'error' ? 'bg-flame-red' : a.last_run_at ? 'bg-emerald-400' : 'bg-ink-500'}`}
                aria-hidden
              />
              <span className="truncate">{a.name}</span>
              {a.paused && <span className="ml-auto text-[10px] font-semibold uppercase text-flame-amber">Paused</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        {user.role === 'admin' && (
          <NavLink href="/admin/users">
            <Users size={17} /> Team & access
          </NavLink>
        )}
        <NavLink href="/settings">
          <Settings size={17} /> Settings
        </NavLink>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flame-x text-xs font-bold text-white">
            {user.name
              .split(/\s+/)
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="truncate text-[11px] text-ink-400">{user.role === 'admin' ? 'Admin' : 'Team member'}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md p-1.5 text-ink-400 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
