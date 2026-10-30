import 'server-only';
import { one, q } from './db';
import { addLog } from './lead';
import { addLiveEvents } from './live';
import { PORTAL_URL, postNews } from './news';

/**
 * Project documents, written by the Business Analyst (Ananya) as branded Word (and PDF) files kept by the portal. They are asked for
 * by people (portal or Teams) or queued automatically: SRS and project plan when a plan is ready, a progress report
 * every week while building, a test report when testing is done and a final report when the project goes live.
 */
export const BA_AGENT = 'business-analyst';

export const DOC_KINDS = ['srs', 'plan', 'progress', 'test', 'final'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABEL: Record<DocKind, string> = {
  srs: 'Software Requirements Specification (SRS)',
  plan: 'Project Plan',
  progress: 'Progress Report',
  test: 'Test Report',
  final: 'Final Report',
};
export const DOC_SHORT: Record<DocKind, string> = { srs: 'SRS', plan: 'Project plan', progress: 'Progress report', test: 'Test report', final: 'Final report' };
/** The document's name inside a sentence ("the SRS", "the progress report"). */
export const docName = (k: DocKind) => (k === 'srs' ? 'SRS' : DOC_SHORT[k].toLowerCase());

export type ProjectDoc = { id: number; request_id: number; kind: DocKind; title: string; version: string; url: string; pdf_url: string | null; summary: string | null; created_at: string };
export type DocRequest = { id: number; request_id: number; kind: DocKind; note: string | null; requested_by: string | null; status: string; created_at: string };

/** Ask Ananya for a document (skipped when the same one is already waiting). */
export async function queueDoc(requestId: number, kind: DocKind, by: string, note?: string | null): Promise<{ id: number; queued: boolean }> {
  const waiting = await one<{ id: number }>("SELECT id FROM doc_requests WHERE request_id = $1 AND kind = $2 AND status = 'pending'", [requestId, kind]);
  if (waiting) return { id: waiting.id, queued: false };
  const row = await one<{ id: number }>('INSERT INTO doc_requests (request_id, kind, note, requested_by) VALUES ($1, $2, $3, $4) RETURNING id', [requestId, kind, note?.slice(0, 1000) || null, by]);
  await addLog(requestId, by, `Asked Ananya for the ${docName(kind)}.`);
  return { id: row!.id, queued: true };
}

export async function docsFor(requestId: number): Promise<{ docs: ProjectDoc[]; pending: DocRequest[] }> {
  const [docs, pending] = await Promise.all([
    q<ProjectDoc>('SELECT * FROM project_docs WHERE request_id = $1 ORDER BY created_at DESC', [requestId]),
    q<DocRequest>("SELECT * FROM doc_requests WHERE request_id = $1 AND status = 'pending' ORDER BY created_at", [requestId]),
  ]);
  return { docs, pending };
}

/** Milestone documents, queued by the request's status change. */
export async function queueMilestoneDocs(requestId: number, status: string): Promise<void> {
  const kinds: DocKind[] = status === 'plan_ready' ? ['srs', 'plan'] : status === 'ready' ? ['test'] : status === 'live' ? ['final'] : [];
  for (const k of kinds) await queueDoc(requestId, k, 'Auto (milestone)');
}

/** Ananya's work: documents waiting, each with everything she needs to write it. A weekly progress report is added for every build without one in the last 7 days. */
export async function docsQueue() {
  const stale = await q<{ id: number }>(
    `SELECT r.id FROM lead_requests r WHERE r.status = 'building'
       AND NOT EXISTS (SELECT 1 FROM project_docs d WHERE d.request_id = r.id AND d.kind = 'progress' AND d.created_at > now() - interval '7 days')
       AND NOT EXISTS (SELECT 1 FROM doc_requests x WHERE x.request_id = r.id AND x.kind = 'progress' AND (x.status = 'pending' OR x.created_at > now() - interval '7 days'))`,
  );
  for (const r of stale) await queueDoc(r.id, 'progress', 'Auto (weekly)');

  const pending = await q<DocRequest>("SELECT * FROM doc_requests WHERE status = 'pending' ORDER BY created_at LIMIT 4");
  const out = [];
  for (const d of pending) {
    const request = await one<Record<string, unknown>>(
      `SELECT r.id, r.kind, r.title, r.brief, r.deadline, r.status, r.plan, r.questions, r.reply, r.summary, r.preview_url, r.pr_url, r.live_url,
              r.created_by, r.approved_by, r.approved_at, r.live_approved_at, r.created_at, p.name AS project_name, p.repo, p.live_url AS project_live_url
         FROM lead_requests r LEFT JOIN projects p ON p.id = r.project_id WHERE r.id = $1`,
      [d.request_id],
    );
    if (!request) {
      await q("UPDATE doc_requests SET status = 'cancelled' WHERE id = $1", [d.id]);
      continue;
    }
    const [tasks, log, docs] = await Promise.all([
      q('SELECT id, seq, title, details, role, status, report, attempts, updated_at FROM dev_tasks WHERE request_id = $1 ORDER BY seq, id', [d.request_id]),
      q('SELECT who, text, created_at FROM lead_log WHERE request_id = $1 ORDER BY created_at LIMIT 200', [d.request_id]),
      q<ProjectDoc>('SELECT kind, title, version, url, created_at FROM project_docs WHERE request_id = $1 ORDER BY created_at DESC', [d.request_id]),
    ]);
    const lastSame = docs.find((x) => x.kind === d.kind);
    out.push({
      doc_request_id: d.id,
      kind: d.kind,
      kind_label: DOC_LABEL[d.kind],
      note: d.note,
      requested_by: d.requested_by,
      next_version: lastSame ? bump(lastSame.version) : '1.0',
      request,
      tasks,
      log,
      earlier_docs: docs,
    });
  }
  return out;
}

const bump = (v: string) => {
  const [a, b] = v.split('.').map((n) => Number(n) || 0);
  return `${a}.${b + 1}`;
};

export type DocIn = { doc_request_id: number; title: string; version: string; url: string; pdf_url?: string | null; summary?: string | null };

/** Ananya posts the documents she wrote: they are listed on the request and announced in Teams. */
export async function recordDocs(items: DocIn[]): Promise<string[]> {
  const errors: string[] = [];
  for (const d of items.slice(0, 10)) {
    const dr = await one<DocRequest & { title: string }>(
      'SELECT x.*, r.title FROM doc_requests x JOIN lead_requests r ON r.id = x.request_id WHERE x.id = $1',
      [d.doc_request_id],
    );
    if (!dr || dr.status !== 'pending') {
      errors.push(`document request ${d.doc_request_id} is not waiting`);
      continue;
    }
    await q('INSERT INTO project_docs (request_id, kind, title, version, url, pdf_url, summary) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
      dr.request_id,
      dr.kind,
      d.title.slice(0, 200),
      d.version.slice(0, 20),
      d.url,
      d.pdf_url ?? null,
      d.summary?.slice(0, 1500) ?? null,
    ]);
    await q("UPDATE doc_requests SET status = 'done', done_at = now() WHERE id = $1", [dr.id]);
    await addLog(dr.request_id, 'Ananya', `Wrote the ${docName(dr.kind)} v${d.version}.`);
    await addLiveEvents(BA_AGENT, [{ step: 'drafted', text: `${DOC_SHORT[dr.kind]}: ${dr.title}` }]);
    await postNews(BA_AGENT, `📄 ${DOC_SHORT[dr.kind]} v${d.version} for #${dr.request_id} "${dr.title}" is ready: ${d.url}${d.pdf_url ? `\nPDF: ${d.pdf_url}` : ''}${d.summary ? `\n${d.summary}` : ''}\nAll documents: ${PORTAL_URL}/lead/${dr.request_id}`);
  }
  return errors;
}
