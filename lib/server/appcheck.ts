import 'server-only';

import { getAppCheck } from 'firebase-admin/app-check';

import { log } from './logger';

/**
 * Firebase App Check.
 *
 * Answers a question authentication cannot: is this request coming from OUR
 * app, or from a script someone wrote against our API? A valid session cookie
 * proves who you are; it says nothing about what is making the call. Without
 * attestation, a signed-in user can trivially drive our Gemini endpoints from
 * curl in a loop.
 *
 * ── ENFORCEMENT IS OPT-IN ──
 * It requires a reCAPTCHA Enterprise site key, which only the Firebase Console
 * can mint. Until APPCHECK_ENFORCE=1 is set, this verifies a token when one is
 * present and logs the outcome, but never rejects. Shipping it enforcing-by-
 * default with no site key configured would lock every user out of the app,
 * which is a worse failure than the one it prevents.
 *
 * To turn it on:
 *   1. Firebase Console -> App Check -> register the web app with reCAPTCHA Enterprise
 *   2. Put the site key in NEXT_PUBLIC_APPCHECK_SITE_KEY
 *   3. Set APPCHECK_ENFORCE=1
 */

const HEADER = 'x-firebase-appcheck';

function enforcing(): boolean {
  return process.env.APPCHECK_ENFORCE === '1';
}

export class FailedAttestation extends Error {
  constructor() {
    super('APP_CHECK_FAILED');
    this.name = 'FailedAttestation';
  }
}

/**
 * Verify the App Check token on a request.
 *
 * Throws FailedAttestation only when enforcement is switched on. In
 * observation mode a failure is logged so you can see what enforcement WOULD
 * have done before you turn it on and find out the hard way.
 */
export async function assertAppCheck(req: Request): Promise<void> {
  const token = req.headers.get(HEADER);

  if (!token) {
    if (enforcing()) {
      log.warn('appcheck_missing', { reason: 'no_token' });
      throw new FailedAttestation();
    }
    return;
  }

  try {
    await getAppCheck().verifyToken(token);
  } catch {
    log.warn('appcheck_invalid', { reason: enforcing() ? 'rejected' : 'observed' });
    if (enforcing()) throw new FailedAttestation();
  }
}
