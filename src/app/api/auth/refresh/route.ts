import { NextRequest, NextResponse } from 'next/server';
import { rotateRefresh, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/session-core';

export const dynamic = 'force-dynamic';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

// Called by the client timer (POST) and by middleware when the access cookie expired (GET + ?next=).
export async function POST() {
  const result = await rotateRefresh();
  return NextResponse.json({ ok: result === 'ok', retry: result === 'retry' }, { status: result === 'invalid' ? 401 : 200 });
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const result = await rotateRefresh();
  const res = NextResponse.redirect(new URL(next, req.url));
  if (result === 'invalid') {
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
  }
  return res;
}
