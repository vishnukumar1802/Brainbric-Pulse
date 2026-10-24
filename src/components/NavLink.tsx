'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({
  href,
  children,
  exact = false,
  badge,
  sub = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  badge?: number;
  sub?: boolean;
}) {
  const path = usePathname();
  const base = href.split('?')[0];
  const active = exact ? path === base : path === base || path.startsWith(base + '/');
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-3 ${sub ? 'py-1.5 text-[13px]' : 'py-2 text-sm'} font-medium transition ${
        active ? 'bg-white/10 text-white' : 'text-ink-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {active && !sub && <span className="-ml-3 mr-0.5 h-5 w-1 rounded-r bg-flame" aria-hidden />}
      <span className="flex min-w-0 flex-1 items-center gap-2.5 truncate">{children}</span>
      {badge ? (
        <span className="rounded-full bg-flame-x px-1.5 text-[11px] font-bold tabular-nums text-white">{badge}</span>
      ) : null}
    </Link>
  );
}
