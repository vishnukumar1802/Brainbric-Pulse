import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Download a project document Ananya wrote. Signed-in people with the Team Lead permission only. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', _req.url));
  if (!can(user, 'projects')) return new NextResponse('Not allowed', { status: 403 });
  const file = await one<{ filename: string; mime: string; data: Buffer | Uint8Array }>('SELECT filename, mime, data FROM doc_files WHERE id = $1', [Number(params.id)]);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(Buffer.from(file.data), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `${file.mime === 'application/pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
