import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/config';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * THIS MIDDLEWARE IS NOT A SECURITY BOUNDARY. IT IS A REDIRECT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Next.js middleware runs on the Edge runtime, where firebase-admin cannot
 * run. So it can check that a cookie is PRESENT, but it cannot verify that the
 * cookie is VALID. A forged cookie sails straight through here.
 *
 * That is fine, because it is not doing any security work. Every page and
 * every route independently calls requireUid(), which verifies the cookie
 * properly in the Node runtime. This exists only so a signed-out visitor lands
 * on the sign-in page instead of a flash of empty app shell.
 *
 * If you ever find yourself tempted to put an authorisation decision in here,
 * that is the bug this comment exists to prevent.
 */
export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has(SESSION_COOKIE_NAME);
  const { pathname } = req.nextUrl;

  if (!hasCookie && pathname !== '/sign-in') {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (hasCookie && pathname === '/sign-in') {
    const url = req.nextUrl.clone();
    url.pathname = '/today';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes (which verify for themselves), static assets,
  // and the Next.js internals.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
