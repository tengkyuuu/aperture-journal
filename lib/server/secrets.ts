import 'server-only';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Runtime secret retrieval from Google Cloud Secret Manager.
 *
 * SECURITY PRECONDITIONS FOR EVERY CALLER:
 *   1. The returned value is never logged, never serialised into a response
 *      body, never placed in an error message, never written to disk.
 *   2. This module is server-only. The `import 'server-only'` above makes a
 *      client import fail the BUILD rather than leak the key in a bundle.
 *
 * We deliberately do NOT bind the key as an environment variable through
 * apphosting.yaml, even though App Hosting supports it. Fetching it here means
 * the Secret Manager dependency is explicit and auditable, and a rotation takes
 * effect within one cache TTL instead of requiring a redeploy.
 */

const client = new SecretManagerServiceClient();

const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000;

function projectId(): string {
  const id =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!id) throw new Error('PROJECT_ID_UNSET');
  return id;
}

/**
 * Fetch a secret's latest version. Cached in process memory for TTL_MS.
 *
 * Uses `versions/latest` rather than a pinned version so that rotating the
 * secret needs no deploy. In a change-controlled environment you would pin the
 * version and roll it forward deliberately; for this app, fast rotation is the
 * more valuable property.
 */
export async function getSecret(name: string): Promise<string> {
  const hit = cache.get(name);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId()}/secrets/${name}/versions/latest`,
  });

  const value = version.payload?.data?.toString();

  // Deliberately opaque. The error surfaces which *operation* failed, never
  // which secret, and certainly never a partial value.
  if (!value) throw new Error('SECRET_UNAVAILABLE');

  cache.set(name, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/** Drop the cache. Used by tests and by an explicit rotation hook. */
export function clearSecretCache(): void {
  cache.clear();
}
