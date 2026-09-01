import 'server-only';

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

import { Unauthenticated } from './auth';
import { log } from './logger';

/**
 * Request/response plumbing shared by every route.
 *
 * Two rules enforced here:
 *   - Errors returned to a client are GENERIC. Detail goes to the log.
 *   - Mutating requests must come from our own origin (CSRF layer two; layer
 *     one is SameSite=Lax on the session cookie).
 */

export class RateLimited extends Error {
  constructor() {
    super('RATE_LIMITED');
    this.name = 'RateLimited';
  }
}

export class BadRequest extends Error {
  constructor() {
    super('BAD_REQUEST');
    this.name = 'BadRequest';
  }
}

/**
 * Reject cross-origin mutations. SameSite=Lax already blocks the classic form
 * POST, but a same-site subdomain or a misconfigured CDN can defeat it, so we
 * check explicitly rather than relying on one control.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get('origin');
  if (!origin) return; // same-origin fetch may omit Origin; SameSite still applies

  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) throw new BadRequest();

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new BadRequest();
  }

  if (originHost !== host) {
    log.warn('cross_origin_rejected', { reason: 'origin_mismatch' });
    throw new BadRequest();
  }
}

/** Parse a JSON body against a strict schema. Never echoes the body back. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BadRequest();
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    // The validation detail is useful to us and useful to an attacker mapping
    // our schema. It goes to the log, not the response.
    log.warn('validation_failed', {
      reason: (result.error as ZodError).issues[0]?.code ?? 'unknown',
    });
    throw new BadRequest();
  }
  return result.data;
}

/** Map an internal error to a generic client response. Nothing leaks. */
export function toErrorResponse(err: unknown, route: string): NextResponse {
  if (err instanceof Unauthenticated) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (err instanceof RateLimited) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  if (err instanceof BadRequest) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // Unexpected. Log the shape, never the payload, and tell the client nothing.
  log.error('unhandled_route_error', {
    route,
    code: err instanceof Error ? err.name : 'unknown',
  });
  return NextResponse.json({ error: 'internal' }, { status: 500 });
}
