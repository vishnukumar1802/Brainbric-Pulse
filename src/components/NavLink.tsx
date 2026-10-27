'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavLink({
  href,
  children,
  exact = false,
  count,
  sub = false,
  notWhen,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  /** Only for a queue that needs action. */
  count?: number;
  sub?: boolean;
  /** Not active when the current URL has this query, e.g. "status=drafted" has its own nav item. */
  notWhen?: string;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const [base, query] = href.split('?');
  const want = new URLSearchParams(query ?? '');
  const queryMatches = Array.from(want.entries()).every(([k, v]) => params.get(k) === v);
  const excluded = notWhen ? Array.from(new URLSearchParams(notWhen).entries()).every(([k, v]) => params.get(k) === v) : false;
  const pathMatches = exact ? path === base : path === base || path.startsWith(base + '/');
  const active = pathMatches && queryMatches && !excluded;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 ${sub ? 'text-[13px]' : 'text-sm'} transition-colors ${
        active ? 'bg-paper-active font-medium text-ink-950' : 'text-ink-700 hover:bg-paper-active/60 hover:text-ink-950'
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5 truncate [&>svg]:shrink-0 [&>svg]:text-ink-500">{children}</span>
      {count ? <span className="num text-xs font-medium text-flame-ink">{count}</span> : null}
    </Link>
  );
}
