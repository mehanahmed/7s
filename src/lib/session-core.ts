import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/mysql';
import { getSyncLicenseProof } from '@/lib/license-service';

// Signed, httpOnly cookies. The client can no longer forge its own identity.
// Short-lived signed access token + long-lived rotating refresh token (opaque, stored hashed in DB).
export const ACCESS_COOKIE = 'sv-access';
export const REFRESH_COOKIE = 'sv-refresh';
const PENDING_COOKIE = 'sv-2fa-pending';
const ACCESS_TTL = 15 * 60; // seconds
const REFRESH_TTL = 7 * 24 * 60 * 60;
const PENDING_TTL = 5 * 60;
const REUSE_GRACE_MS = 10_000; // two tabs refreshing at once must not look like theft

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET must be set (16+ chars).');
  const proof = getSyncLicenseProof();
  return crypto.createHmac('sha256', s).update(proof).digest('hex');
}

const sign = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

function makeToken(userId: string, ttl: number): string {
  const body = Buffer.from(JSON.stringify({ id: userId, exp: Math.floor(Date.now() / 1000) + ttl })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof id === 'string' && exp > Date.now() / 1000 ? id : null;
  } catch {
    return null;
  }
}

async function put(name: string, userId: string, ttl: number) {
  (await cookies()).set(name, makeToken(userId, ttl), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttl,
  });
}

export const startPending2FA = (userId: string) => put(PENDING_COOKIE, userId, PENDING_TTL);

// ---- refresh token store ----
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    family_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_token_hash (token_hash),
    KEY idx_family (family_id),
    KEY idx_user (user_id)
  )`);
  tableReady = true;
}

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

async function issueRefresh(userId: string, familyId: string) {
  const raw = crypto.randomBytes(32).toString('base64url');
  await query(
    'INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
    [crypto.randomUUID(), familyId, userId, hashToken(raw), REFRESH_TTL],
  );
  (await cookies()).set(REFRESH_COOKIE, raw, cookieOpts(REFRESH_TTL));
}

/** New login: fresh token family + access cookie + refresh cookie. */
export async function startSession(userId: string) {
  await ensureTable();
  await query('DELETE FROM refresh_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'); // housekeeping
  await put(ACCESS_COOKIE, userId, ACCESS_TTL);
  await issueRefresh(userId, crypto.randomUUID());
}

export type RefreshResult = 'ok' | 'retry' | 'invalid';

/**
 * Exchange the refresh cookie for a new access token AND a new refresh token (rotation).
 * A refresh token works once; presenting an already-used one revokes the whole family.
 */
export async function rotateRefresh(): Promise<RefreshResult> {
  const jar = await cookies();
  const raw = jar.get(REFRESH_COOKIE)?.value;
  if (!raw) return 'invalid';
  await ensureTable();

  const rows = await query<any[]>(
    'SELECT id, family_id, user_id, used_at, revoked_at, expires_at > NOW() AS valid, TIMESTAMPDIFF(MICROSECOND, used_at, NOW()) / 1000 AS used_ms_ago FROM refresh_tokens WHERE token_hash = ?',
    [hashToken(raw)],
  );
  const row = rows[0];
  if (!row || row.revoked_at || !row.valid) return 'invalid';

  let result: 'ok' | 'retry' = 'ok';
  if (row.used_at) {
    if (Number(row.used_ms_ago) < REUSE_GRACE_MS) {
      result = 'retry';
    } else {
      // Token reuse: assume theft, kill every token of this login.
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL', [row.family_id]);
      return 'invalid';
    }
  } else {
    // Atomic claim: only one concurrent request may consume the token.
    const claim: any = await query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [row.id]);
    if (!claim.affectedRows) result = 'retry';
  }

  const user = await query<any[]>('SELECT id FROM users WHERE id = ?', [row.user_id]);
  if (!user[0]) return 'invalid';

  await put(ACCESS_COOKIE, row.user_id, ACCESS_TTL);
  // Each request needs its own access cookie so guard() and getActionScope() agree.
  // Only the winner rotates the refresh cookie; losers must not overwrite its successor.
  if (result === 'ok') await issueRefresh(row.user_id, row.family_id);
  return result;
}

export async function clearSession() {
  const c = await cookies();
  const raw = c.get(REFRESH_COOKIE)?.value;
  if (raw) {
    try {
      await ensureTable();
      await query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = (SELECT family_id FROM (SELECT family_id FROM refresh_tokens WHERE token_hash = ?) t) AND revoked_at IS NULL',
        [hashToken(raw)],
      );
    } catch (e) {
      console.error('clearSession: revoke failed', e);
    }
  }
  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
  c.delete(PENDING_COOKIE);
}

export async function clearPending2FA() {
  (await cookies()).delete(PENDING_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  return readToken((await cookies()).get(ACCESS_COOKIE)?.value);
}

export async function getPending2FAUserId(): Promise<string | null> {
  return readToken((await cookies()).get(PENDING_COOKIE)?.value);
}

// ponytail: in-memory attempt limiter, per-process only. Use Redis/DB if running multiple instances.
const attempts = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function isRateLimited(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (a.until && a.until < Date.now()) { attempts.delete(key); return false; }
  return a.n >= MAX_FAILS;
}

export function recordFail(key: string) {
  const a = attempts.get(key) ?? { n: 0, until: 0 };
  a.n += 1;
  a.until = Date.now() + LOCK_MS;
  attempts.set(key, a);
}

export const clearFails = (key: string) => { attempts.delete(key); };
