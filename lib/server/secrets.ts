import 'server-only';

/**
 * Server-side secrets, read from the runtime environment.
 *
 * SECURITY PRECONDITIONS FOR EVERY CALLER:
 *   1. The returned value is never logged, never serialised into a response
 *      body, never placed in an error message, never written to disk.
 *   2. This module is server-only. The `import 'server-only'` above makes a
 *      client import fail the BUILD rather than leak a key in a bundle.
 *   3. Secret names never start with NEXT_PUBLIC_. Next.js inlines those into
 *      the browser bundle; anything else stays on the server.
 *
 * ══ WHY NOT SECRET MANAGER ANY MORE ══
 * Google Cloud Secret Manager needs a billing account, and this app now runs
 * at $0. The host's encrypted environment variables (Vercel, or .env.local in
 * development) do the same job here: the value never enters the repository,
 * never reaches the client, and rotating it is a redeploy.
 */
export function getSecret(name: string): string {
  const value = process.env[name]?.trim();

  // Deliberately opaque. The error says which *operation* failed, never which
  // secret, and certainly never a partial value.
  if (!value) throw new Error('SECRET_UNAVAILABLE');
  return value;
}
