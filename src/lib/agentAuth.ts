import 'server-only';
import { timingSafeEqual } from 'crypto';

/** True when the request carries the INGEST_TOKEN the cloud agents use. */
export function agentAuthorized(req: Request): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected || expected.length < 24) return false;
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
