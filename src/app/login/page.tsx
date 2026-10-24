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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 p-12 lg:flex lg:flex-col">
        <div className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-flame opacity-20 blur-3xl" aria-hidden />
        <Brand size={40} />
        <div className="relative mt-auto max-w-md">
          <p className="eyebrow !text-flame-amber">Brainbric Innovations</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-white">
            Your AI team works around the clock. This is where you steer it.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
            Every lead, requirement post, draft and report your agents produce, in one place, with one click to Outlook or WhatsApp.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand dark={false} size={36} />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-950">Sign in</h2>
          <p className="mt-1 text-sm text-ink-500">Use the email and password your admin gave you.</p>
          <LoginForm next={searchParams.next ?? '/'} />
        </div>
      </section>
    </div>
  );
}
