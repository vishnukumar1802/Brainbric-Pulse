// Session token helpers shared by middleware (edge) and server code.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'pulse_session';
export const SESSION_DAYS = 7;

export type SessionClaims = {
  uid: number;
  role: 'admin' | 'member';
  name: string;
  username: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set to at least 32 characters.');
    }
    return new TextEncoder().encode('local-development-secret-not-for-production-use');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (typeof payload.uid !== 'number') return null;
    return {
      uid: payload.uid,
      role: payload.role === 'admin' ? 'admin' : 'member',
      name: String(payload.name ?? ''),
      username: String(payload.username ?? ''),
    };
  } catch {
    return null;
  }
}
