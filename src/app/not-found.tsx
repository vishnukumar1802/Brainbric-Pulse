import Link from 'next/link';
import { Brand } from '@/components/Brand';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <Brand dark={false} />
      <h1 className="mt-4 text-2xl font-semibold text-ink-950">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-ink-500">The lead or report may have been removed, or the link is incomplete.</p>
      <Link href="/" className="btn-primary">
        Back to overview
      </Link>
    </div>
  );
}
