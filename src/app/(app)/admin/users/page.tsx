import { updateUserAction } from '@/app/actions';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin, type User } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtAgo } from '@/lib/format';
import { CreateUserForm, ResetPasswordForm } from './forms';

export const metadata = { title: 'Team & access' };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await q<User>('SELECT id, name, email, role, active, created_at, last_login FROM users ORDER BY active DESC, name');

  return (
    <>
      <PageHeader title="Team and access" subtitle="Give people their own login. Admins can manage users and settings; team members can work leads." />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="People" note={`${users.filter((u) => u.active).length} active`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-paper-line text-left text-xs font-semibold text-ink-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2 pr-3">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-ink-950">
                        {u.name} {u.id === me.id && <span className="text-xs font-normal text-ink-500">(you)</span>}
                      </div>
                      <div className="text-xs text-ink-500">{u.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <form action={updateUserAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <select name="role" defaultValue={u.role} className="input w-auto py-1" disabled={u.id === me.id} aria-label={`Role for ${u.name}`}>
                          <option value="member">Team member</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.id !== me.id && (
                          <button type="submit" className="text-xs font-medium text-ink-900 underline decoration-ink-400/50 underline-offset-2 hover:decoration-ink-900">
                            Save
                          </button>
                        )}
                      </form>
                    </td>
                    <td className="py-3 pr-3 text-ink-500">{u.last_login ? fmtAgo(u.last_login) : 'Never'}</td>
                    <td className="py-3 pr-3">
                      {u.id === me.id ? (
                        <span className="text-xs text-ink-500">Active</span>
                      ) : (
                        <form action={updateUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? 'false' : 'true'} />
                          <button type="submit" className={`text-xs font-medium underline underline-offset-2 ${u.active ? 'text-[#C4242A] decoration-[#C4242A]/40' : 'text-ink-900 decoration-ink-400/50'}`}>
                            {u.active ? 'Turn off access' : 'Turn on access'}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Add a person" note="They sign in with this email and password.">
            <CreateUserForm />
          </Card>
          <Card title="Reset a password" note="Use when someone forgets theirs.">
            <ResetPasswordForm users={users.map((u) => ({ id: u.id, name: u.name }))} />
          </Card>
        </div>
      </div>
    </>
  );
}
