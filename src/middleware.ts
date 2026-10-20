import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Access cookie expired (15 min) but a refresh cookie is still there: rotate it, then come back to this page.
  const { pathname, search } = request.nextUrl;
  const isPage = request.method === 'GET'
    && !pathname.startsWith('/api') && !pathname.startsWith('/_next') && !pathname.startsWith('/uploads')
    && !pathname.includes('.') && request.headers.get('rsc') === null && request.headers.get('next-router-prefetch') === null;
  if (isPage && request.cookies.has('sv-refresh') && !request.cookies.has('sv-access')) {
    const url = new URL('/api/auth/refresh', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const xForwardedHost = request.headers.get('x-forwarded-host');

  let needsRewrite = false;
  const requestHeaders = new Headers(request.headers);

  // Fix duplicated Origin header from proxies like LiteSpeed / Cloudflare
  if (origin && origin.includes(',')) {
    requestHeaders.set('origin', origin.split(',')[0].trim());
    needsRewrite = true;
  }

  // Fix duplicated Host header
  if (host && host.includes(',')) {
    requestHeaders.set('host', host.split(',')[0].trim());
    needsRewrite = true;
  }

  // Fix duplicated X-Forwarded-Host header
  if (xForwardedHost && xForwardedHost.includes(',')) {
    requestHeaders.set('x-forwarded-host', xForwardedHost.split(',')[0].trim());
    needsRewrite = true;
  }

  if (needsRewrite) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}
