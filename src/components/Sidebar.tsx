import Link from "next/link";
import {
  Crosshair,
  FileText,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { can } from "@/lib/permissions";
import type { Agent } from "@/lib/agents";
import type { User } from "@/lib/auth";
import { AgentFace } from "./AgentFace";
import { Brand } from "./Brand";
import { NavLink } from "./NavLink";

function agentDot(a: Agent) {
  if (a.paused) return "#B4B2A9";
  if (a.last_status === "error") return "#C4242A";
  if (a.last_status === "warning") return "#FCB216";
  return a.last_run_at ? "#247B50" : "#D9D5D1";
}

export function SidebarContent({
  user,
  agents,
  counts,
  focus,
}: {
  user: User;
  agents: Agent[];
  counts: { drafted: number; hot: number; colleges: number };
  focus: string;
}) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="px-2 pb-5">
        <Brand />
      </div>

      {can(user, "leads") && (
        <Link
          href="/focus"
          className="mb-4 block rounded-md border border-paper-line bg-white px-3 py-2 transition-colors hover:border-ink-400"
          title="Change what the agents hunt for"
        >
          <span className="flex items-center gap-1.5 text-xs text-ink-500">
            <Crosshair size={12} strokeWidth={2} /> Hunting for
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium text-ink-950">
            {focus}
          </span>
        </Link>
      )}

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {can(user, "leads") && (
          <>
            <NavLink href="/" exact>
              <LayoutGrid size={16} strokeWidth={1.75} /> Overview
            </NavLink>
            <NavLink href="/leads?status=drafted" exact count={counts.drafted}>
              <Send size={16} strokeWidth={1.75} /> Ready to send
            </NavLink>
            <NavLink href="/leads" notWhen="status=drafted">
              <Target size={16} strokeWidth={1.75} /> All leads
            </NavLink>
            <NavLink href="/focus">
              <Crosshair size={16} strokeWidth={1.75} /> Focus
            </NavLink>
          </>
        )}
        {can(user, "reports") && (
          <NavLink href="/reports">
            <FileText size={16} strokeWidth={1.75} /> Reports
          </NavLink>
        )}
      </nav>

      {can(user, "colleges") && (
        <div className="mt-7">
          <div className="mb-1.5 px-2.5 text-xs text-ink-500">
            College programs
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="College programs">
            <NavLink href="/colleges" count={counts.colleges}>
              <GraduationCap size={16} strokeWidth={1.75} /> Colleges
            </NavLink>
          </nav>
        </div>
      )}

      {can(user, "agents") && (
        <div className="mt-7">
          <div className="mb-1.5 flex items-baseline justify-between px-2.5">
            <Link
              href="/agents"
              className="text-xs text-ink-500 hover:text-ink-950"
            >
              AI team
            </Link>
            <span className="num text-xs text-ink-400">
              {agents.filter((a) => !a.paused).length}/{agents.length} on
            </span>
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="AI agents">
            {agents.map((a) => (
              <NavLink key={a.slug} href={`/agents/${a.slug}`} sub>
                <AgentFace slug={a.slug} name={a.nickname ?? a.name} size={22} ring={agentDot(a)} className={a.paused ? "opacity-60" : ""} />
                <span className={`truncate ${a.paused ? "text-ink-400" : ""}`} title={a.nickname ? a.name : undefined}>
                  {a.nickname ?? a.name}
                </span>
                {a.paused && (
                  <span className="ml-auto text-xs text-ink-400">Paused</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        {user.role === "admin" && (
          <NavLink href="/admin/users">
            <Users size={16} strokeWidth={1.75} /> Team and access
          </NavLink>
        )}
        <NavLink href="/settings">
          <Settings size={16} strokeWidth={1.75} /> Settings
        </NavLink>
        <div className="mt-3 flex items-center gap-2.5 border-t border-paper-line px-2 pt-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flame-tint text-[11px] font-semibold text-flame-ink">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-ink-950">
              {user.name}
            </div>
            <div className="truncate text-xs text-ink-500">
              {user.role === "admin" ? "Admin" : "Team member"}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-ink-500 hover:bg-paper-active hover:text-ink-950"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
