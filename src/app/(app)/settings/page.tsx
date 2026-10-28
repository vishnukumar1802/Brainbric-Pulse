import { headers } from 'next/headers';
import { Card, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { OwnPasswordForm, WorkspaceForm } from './forms';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const [myWhatsapp, teamBcc] = await Promise.all([getSetting('my_whatsapp'), getSetting('team_bcc')]);
  const host = headers().get('host') ?? 'your-portal.vercel.app';
  const proto = host.startsWith('localhost') ? 'http' : 'https';

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Your password" note={`Signed in as ${user.username}`}>
          {user.role === 'admin' ? (
            <OwnPasswordForm />
          ) : (
            <p className="text-sm text-ink-700">Your User ID and password are managed by your admin. Ask them if you need a new password.</p>
          )}
        </Card>

        {user.role === 'admin' && (
          <Card title="Workspace" note="Used across the portal for everyone.">
            <WorkspaceForm myWhatsapp={myWhatsapp ?? ''} teamBcc={teamBcc ?? ''} />
          </Card>
        )}

        {user.role === 'admin' && (
          <Card title="Agent feed" note="Where your AI agents send their results." className="xl:col-span-2">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="mb-1 text-xs text-ink-500">Feed address</dt>
                <dd>
                  <code className="break-all rounded bg-ink-800/5 px-1.5 py-0.5">{`${proto}://${host}/api/ingest`}</code>
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-ink-500">Security</dt>
                <dd className="text-ink-700">
                  Agents must send the secret <code className="rounded bg-ink-800/5 px-1">INGEST_TOKEN</code> set in Vercel. Without it the feed refuses
                  everything.
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </>
  );
}
