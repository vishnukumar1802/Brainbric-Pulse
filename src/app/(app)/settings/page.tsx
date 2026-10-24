import { headers } from 'next/headers';
import { Card, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { OwnPasswordForm, WorkspaceForm } from './forms';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const myWhatsapp = await getSetting('my_whatsapp');
  const host = headers().get('host') ?? 'your-portal.vercel.app';
  const proto = host.startsWith('localhost') ? 'http' : 'https';

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Your password" note={`Signed in as ${user.email}`}>
          <OwnPasswordForm />
        </Card>

        {user.role === 'admin' && (
          <Card title="Workspace" note="Used across the portal for everyone.">
            <WorkspaceForm myWhatsapp={myWhatsapp ?? ''} />
          </Card>
        )}

        {user.role === 'admin' && (
          <Card title="Agent feed" note="Where your AI agents send their results." className="xl:col-span-2">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="eyebrow mb-1">Feed address</dt>
                <dd>
                  <code className="break-all rounded bg-ink-800/5 px-1.5 py-0.5">{`${proto}://${host}/api/ingest`}</code>
                </dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Security</dt>
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
