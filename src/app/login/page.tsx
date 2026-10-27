import { redirect } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { currentUser, ensureBootstrapAdmin } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  await ensureBootstrapAdmin();
  if (await currentUser()) redirect('/');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[360px]">
        <Brand size={32} />
        <div className="card mt-8 p-6">
          <h1 className="text-xl font-semibold text-ink-950">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Use the email and password your admin gave you.</p>
          <LoginForm next={searchParams.next ?? '/'} />
        </div>
        <p className="mt-4 text-xs text-ink-500">Leads, drafts and reports from the Brainbric AI team. Private to the team.</p>
      </div>
    </div>
  );
}
