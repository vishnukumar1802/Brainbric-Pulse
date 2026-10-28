import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin, toUser, USER_COLUMNS } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtAgo } from '@/lib/format';
import { PERMISSIONS } from '@/lib/permissions';
import { CreateUserForm } from './forms';

export const metadata = { title: 'Team and access' };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = (await q(`SELECT ${USER_COLUMNS} FROM users ORDER BY active DESC, role, name`)).map((r) => toUser(r as never));
  const label = (k: string) => PERMISSIONS.find((p) => p.key === k)?.label ?? k;

  return (
    <>
      <PageHeader
        title="Team and access"
        subtitle="People sign in with the User ID and password you give them. Only admins can add people, change User IDs, set passwords and choose what each team member can open."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <Card flush title="People" note={`${users.filter((u) => u.active).length} of ${users.length} can sign in`}>
          <ul className="border-t border-paper-line">
            {users.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-paper-rule px-5 py-3 last:border-b-0 ${u.active ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink-950">{u.name}</span>
                    {u.id === me.id && <span className="text-xs text-ink-500">(you)</span>}
                    <span className="font-mono text-xs text-ink-700">{u.username}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.role === 'admin' ? (
                      <span className="rounded bg-ink-900 px-1.5 py-0.5 text-xs font-medium text-white">Admin: everything</span>
                    ) : u.permissions.length ? (
                      u.permissions.map((p) => (
                        <span key={p} className="rounded bg-[#F0EEEB] px-1.5 py-0.5 text-xs text-ink-700">
                          {label(p)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#C4242A]">No access ticked</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    {u.active ? 'Can sign in' : 'Turned off'} · last sign-in {u.last_login ? fmtAgo(u.last_login) : 'never'}
                    {u.email ? ` · ${u.email}` : ''}
                  </div>
                </div>
                <Link href={`/admin/users/${u.id}`} className="btn-ghost h-7 px-2.5 text-xs">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Add a person" note="They sign in with this User ID and password.">
          <CreateUserForm />
        </Card>
      </div>
    </>
  );
}
