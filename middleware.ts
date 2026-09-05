import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/config';

/**
 * Middleware does two unrelated jobs. Only one of them is security.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 1. THE REDIRECT — NOT A SECURITY BOUNDARY.
 *
 * This runs on the Edge runtime, where firebase-admin cannot run. So it can
 * see that a cookie is PRESENT but cannot verify it is VALID. A forged cookie
 * sails straight through here and is rejected downstream by requireUid() in
 * the Node runtime, which is where the actual check lives.
 *
 * That is fine, because this is doing no security work — it exists so a
 * signed-out visitor lands on the sign-in page instead of a flash of empty
 * app shell. If you are ever tempted to put an authorisation decision here,
 * this comment is what should stop you.
 *
 * 2. THE CSP NONCE — this one does matter.
 *
 * A fresh nonce per request, placed on the request headers so Next.js stamps
 * its own bootstrap scripts with it, and on the response header so the browser
 * enforces it. This is what lets script-src drop 'unsafe-inline'.
 * ══════════════════════════════════════════════════════════════════════════
 */

const isDev = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,

    // The nonce replaces 'unsafe-inline'. An injected inline <script> without
    // the current request's nonce will not execute.
    //
    // NOTE: no 'strict-dynamic'. It would be stronger, but it makes the browser
    // IGNORE the host allowlist below, leaving Firebase Auth's popup entirely
    // dependent on trust propagating through the SDK's dynamically-created
    // script tags. That should work — and it is not something to find out on
    // demo day. Explicit hosts plus a nonce closes the actual gap
    // ('unsafe-inline') with far less to go wrong. Revisit once the popup flow
    // has been exercised end to end against a live provider.
    `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : ''} https://apis.google.com https://www.gstatic.com`,

    // Still 'unsafe-inline'. React writes inline style attributes throughout,
    // and a style attribute cannot carry a nonce. Accepted residual risk: CSS
    // injection needs an existing HTML-injection hole, and this app renders no
    // untrusted HTML anywhere — no dangerouslySetInnerHTML outside the nonce'd
    // theme bootstrap, no markdown renderer, no user-supplied templates.
    `style-src 'self' 'unsafe-inline'`,

    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com`,
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does this cookie look plainly dead, without verifying it?
 *
 * ══ THIS IS NOT A SECURITY CHECK ══
 * It reads the JWT payload WITHOUT validating the signature, which any
 * attacker can forge. It decides which PAGE to show, nothing else. Real
 * verification is verifySessionCookie() in the Node runtime, and every page
 * and route still does it.
 *
 * It exists to stop a redirect loop. Middleware can only see that a cookie is
 * present; the server can see that it is invalid. When they disagree, each
 * bounces to the other forever. Catching the obviously-expired case here means
 * the loop cannot even begin for the most common cause of the disagreement.
 */
function looksDead(cookie: string): boolean {
  const parts = cookie.split('.');
  if (parts.length !== 3) return true; // not a JWT at all

  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp !== 'number' || exp * 1000 <= Date.now();
  } catch {
    return true; // unparseable is dead enough
  }
}

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next.js reads the nonce out of the CSP on the REQUEST headers and applies
  // it to the scripts it injects. Without this the framework's own bootstrap
  // would be blocked by our own policy.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  // "Might be signed in" — not "is signed in". The server decides that.
  const hasCookie = Boolean(cookie) && !looksDead(cookie!);
  const { pathname } = req.nextUrl;

  let res: NextResponse;

  if (!hasCookie && pathname !== '/sign-in') {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    res = NextResponse.redirect(url);
  } else if (hasCookie && pathname === '/sign-in') {
    const url = req.nextUrl.clone();
    url.pathname = '/today';
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next({ request: { headers: requestHeaders } });
  }

  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  // API routes verify for themselves and return JSON, where a CSP achieves
  // nothing. Static assets and framework internals are excluded so every
  // document request gets a fresh nonce without paying for the rest.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
