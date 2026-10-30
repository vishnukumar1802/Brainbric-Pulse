import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentAuthorized } from '@/lib/agentAuth';
import { q } from '@/lib/db';
import { takeNotes } from '@/lib/chat';
import { BA_AGENT, docsQueue, recordDocs } from '@/lib/docs';
import { agentPaused } from '@/lib/lead';
import { addLiveEvents } from '@/lib/live';

export const dynamic = 'force-dynamic';

/**
 * The Business Analyst's first call each run:
 *   GET /api/docs   (Authorization: Bearer INGEST_TOKEN)
 * Replies {"run": true, "documents": [{doc_request_id, kind, kind_label, note, next_version, request, tasks, log, earlier_docs}], "instructions": [...]}
 * or {"run": false}.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await agentPaused(BA_AGENT)) return NextResponse.json({ run: false, reason: 'paused' }, { headers: { 'Cache-Control': 'no-store' } });
  const documents = await docsQueue();
  const instructions = documents.length ? await takeNotes(BA_AGENT) : [];
  if (documents.length) await addLiveEvents(BA_AGENT, [{ step: 'started', text: null }, { step: 'writing', text: `Writing ${documents[0].kind_label}` }]);
  return NextResponse.json({ run: documents.length > 0, documents, instructions }, { headers: { 'Cache-Control': 'no-store' } });
}

const httpsUrl = z.string().trim().url().max(2000).refine((v) => v.startsWith('https://'), 'must be https');

/**
 * Post the documents written (Word files already uploaded to OneDrive):
 *   POST /api/docs  {"documents": [{"doc_request_id": 3, "title": "...", "version": "1.0", "url": "https://...", "pdf_url": null, "summary": "..."}], "summary": "..."}
 */
export async function POST(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const parsed = z
    .object({
      documents: z
        .array(
          z.object({
            doc_request_id: z.number().int().positive(),
            title: z.string().trim().min(3).max(200),
            version: z.string().trim().regex(/^\d+\.\d+$/),
            url: httpsUrl,
            pdf_url: httpsUrl.nullish(),
            summary: z.string().trim().max(1500).nullish(),
          }),
        )
        .max(10),
      summary: z.string().trim().max(500).nullish(),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const errors = await recordDocs(parsed.data.documents);
  const summary = parsed.data.summary || `${parsed.data.documents.length - errors.length} documents written`;
  await q('INSERT INTO agent_runs (agent, status, summary, stats) VALUES ($1, $2, $3, $4::text::jsonb)', [
    BA_AGENT,
    errors.length ? 'warning' : 'ok',
    summary,
    JSON.stringify({ documents: parsed.data.documents.length, errors: errors.length }),
  ]);
  await addLiveEvents(BA_AGENT, [{ step: 'finished', text: summary }]);
  return NextResponse.json({ ok: errors.length === 0, errors });
}
