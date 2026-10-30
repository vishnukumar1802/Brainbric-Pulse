import { NextResponse } from 'next/server';
import { agentAuthorized } from '@/lib/agentAuth';
import { one } from '@/lib/db';
import { PORTAL_URL } from '@/lib/news';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const MAX = 4 * 1024 * 1024;

/**
 * The Business Analyst uploads a finished file (Word, PDF or Excel); the portal keeps it and returns the link people
 * open after signing in:
 *   POST /api/docs/upload?name=SRS%20-%20Salon%20site%20v1.0.docx   (binary body, Authorization: Bearer INGEST_TOKEN)
 *   -> {"ok": true, "url": "https://brainbric-pulse.vercel.app/files/doc/12/SRS%20-%20Salon%20site%20v1.0.docx"}
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const name = (new URL(req.url).searchParams.get('name') ?? '').trim().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 150);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!name || !TYPES[ext]) return NextResponse.json({ error: 'Pass ?name=<file name> ending in .docx, .pdf or .xlsx' }, { status: 400 });
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length < 100 || data.length > MAX) return NextResponse.json({ error: `File must be between 100 bytes and ${MAX / 1024 / 1024} MB` }, { status: 400 });
  // Office files and PDFs have fixed signatures: refuse anything else under those names.
  const zip = data[0] === 0x50 && data[1] === 0x4b;
  const pdf = data.subarray(0, 4).toString() === '%PDF';
  if ((ext === 'pdf' && !pdf) || (ext !== 'pdf' && !zip)) return NextResponse.json({ error: 'The file content does not match its type' }, { status: 400 });
  const row = await one<{ id: number }>('INSERT INTO doc_files (filename, mime, size, data) VALUES ($1, $2, $3, $4) RETURNING id', [name, TYPES[ext], data.length, data]);
  return NextResponse.json({ ok: true, url: `${PORTAL_URL}/files/doc/${row!.id}/${encodeURIComponent(name)}` });
}
