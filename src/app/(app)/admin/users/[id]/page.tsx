import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin, toUser, USER_COLUMNS } from '@/lib/auth';
import { one } from '@/lib/db';
import { fmtAgo } from '@/lib/format';
import { EditUserForm, SetPasswordForm } from '../forms';

export const metadata = { title: 'Edit person' };

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const me = await requireAdmin();
  const row = await one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [Number(params.id) || 0]);
  if (!row) notFound();
  const user = toUser(row as never);
  const isSelf = user.id === me.id;

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Team and access
      </Link>
      <PageHeader
        title={user.name}
        subtitle={`User ID ${user.username} · ${user.role === 'admin' ? 'Admin' : 'Team member'} · last sign-in ${user.last_login ? fmtAgo(user.last_login) : 'never'}`}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <Card title="Details and access">
          <EditUserForm
            isSelf={isSelf}
            user={{ id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, permissions: user.permissions, signature: user.signature, active: user.active }}
          />
        </Card>
        <Card title="Set a new password" note="Passwords are stored securely and cannot be viewed. Set a new one any time; it is shown once to copy.">
          <SetPasswordForm id={user.id} />
        </Card>
      </div>
    </>
  );
}
