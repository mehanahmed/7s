import { getSystemLicenseStatus } from '@/lib/license-service';
import { AsyncLocalStorage } from 'async_hooks';
import { headers } from 'next/headers';
import { getSessionUserId, rotateRefresh } from '@/lib/session-core';
import { query } from '@/lib/mysql';

const publicCtx = new AsyncLocalStorage<boolean>();

/** Mark the current request as an intentionally public entry point (login, public tracking page, ...). */
export function markPublic() {
  publicCtx.enterWith(true);
}

/**
 * Every exported server action/service calls this first.
 * Calls coming from the browser (Next-Action header) need a valid session unless marked public.
 * Internal calls (route handlers, page rendering, cron) have no such header and pass through.
 */
export async function guard(): Promise<void> {
  let fromBrowser = false;
  let host = 'localhost';
  try {
    const h = await headers();
    fromBrowser = !!h.get('next-action');
    host = h.get('x-forwarded-host') || h.get('host') || 'localhost';
  } catch {
    return; // no request scope (cron, startup)
  }
  if (!fromBrowser || publicCtx.getStore()) return;

  const lic = await getSystemLicenseStatus(host);
  if (!lic.valid) {
    throw new Error('System Unlicensed: Please activate your license at /license');
  }
  if (await getSessionUserId()) return;
  // The 15 minute access token is gone (idle tab, background throttling) but a refresh token may still be valid:
  // renew it right here instead of failing the action. Server actions are allowed to set cookies.
  const renewed = await rotateRefresh();
  if (renewed === 'invalid') throw new Error('Unauthorized');
  // Both successful outcomes issue this request's access cookie; only 'ok' rotates the refresh cookie.
}

/**
 * Role gate for privileged server actions. Same entry-point rule as guard():
 * only calls coming from the browser are checked; internal calls pass through.
 */
export async function requireRole(roles: string[]): Promise<void> {
  let fromBrowser = false;
  try {
    fromBrowser = !!(await headers()).get('next-action');
  } catch {
    return;
  }
  if (!fromBrowser) return;
  const id = await getSessionUserId();
  if (!id) throw new Error('Unauthorized');
  const rows = await query<any[]>('SELECT role FROM users WHERE id = ?', [id]);
  if (!rows[0] || !roles.includes(rows[0].role)) throw new Error('Forbidden');
}

/**
 * Who is calling, when the call comes from the browser. Used to force "assigned only" data scope
 * for production roles no matter what role/userId the client sent. null for internal calls.
 */
export async function getActionScope(): Promise<{ role: string; userId: string } | null> {
  let fromBrowser = false;
  try {
    fromBrowser = !!(await headers()).get('next-action');
  } catch {
    return null;
  }
  if (!fromBrowser) return null;
  const id = await getSessionUserId();
  // Browser call without an identity (e.g. it only got through guard() because a parallel request was renewing the cookies):
  // never fall back to unscoped data, make the client retry.
  if (!id) { if (publicCtx.getStore()) return null; throw new Error('Unauthorized'); }
  const rows = await query<any[]>('SELECT role FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw new Error('Unauthorized');
  return { role: rows[0].role, userId: id };
}
