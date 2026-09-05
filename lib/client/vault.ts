'use client';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * THE ZERO-KNOWLEDGE VAULT
 *
 * Everything in this file runs in the browser and nowhere else. A sealed
 * entry is encrypted here, before it crosses the network, and the server
 * receives ciphertext it has no way to read.
 *
 * The property we are claiming: an attacker holding the entire Firestore
 * database, the service account, and the server's memory still cannot read a
 * sealed entry. Only the passphrase opens it, and the passphrase never leaves
 * this file.
 *
 * WHAT THIS DOES NOT PROTECT AGAINST, stated plainly:
 *   - A compromised client. If the app itself is serving malicious JS, it can
 *     read the plaintext as you type it. End-to-end encryption moves trust
 *     from the server to the delivery of the client; it does not remove it.
 *   - A weak passphrase. PBKDF2 at 600k iterations makes guessing expensive,
 *     not impossible. "password123" is still "password123".
 *   - Metadata. Timestamps, message counts, and the fact that a sealed entry
 *     exists are all visible server-side. Only the content is hidden.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. Costs ~0.5s on a laptop. */
const PBKDF2_ITERATIONS = 600_000;

/** AES-GCM standard nonce length. Never reused — fresh per encryption. */
const IV_BYTES = 12;

const SALT_BYTES = 16;

/** Encrypted under the vault key so a passphrase can be checked without storing it. */
const CHECK_PLAINTEXT = 'aperture.vault.v1';

// ── byte helpers ────────────────────────────────────────────────────────────

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ── key derivation ──────────────────────────────────────────────────────────

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

/**
 * Derive the vault key from a passphrase.
 *
 * `extractable: false` is deliberate: the derived key cannot be read back out
 * of the CryptoKey object by any JavaScript, including ours. It can only be
 * used to encrypt and decrypt. That limits the blast radius of an XSS to what
 * it can do while the tab is open, rather than letting it steal the key.
 */
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromB64(saltB64) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── encryption ──────────────────────────────────────────────────────────────

/** Returns base64(iv ‖ ciphertext ‖ tag). The IV is fresh for every call. */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );

  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);
  return toB64(blob);
}

/**
 * Decrypt. Throws on a wrong key or tampered ciphertext — AES-GCM
 * authenticates, so a modified blob fails rather than returning garbage.
 */
export async function decrypt(key: CryptoKey, blobB64: string): Promise<string> {
  const blob = fromB64(blobB64);
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);

  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

// ── passphrase verification ─────────────────────────────────────────────────

export async function makeCheck(key: CryptoKey): Promise<string> {
  return encrypt(key, CHECK_PLAINTEXT);
}

/**
 * Verify a passphrase without ever storing it, or storing anything derived
 * from it that would help an attacker. The check blob is just a known string
 * encrypted under the key — decrypting it proves the key is right, and reveals
 * nothing else.
 */
export async function verifyCheck(key: CryptoKey, checkB64: string): Promise<boolean> {
  try {
    return (await decrypt(key, checkB64)) === CHECK_PLAINTEXT;
  } catch {
    return false;
  }
}

// ── passphrase quality ──────────────────────────────────────────────────────

export interface PassphraseVerdict {
  ok: boolean;
  score: 0 | 1 | 2 | 3;
  label: string;
  hint: string;
}

/**
 * Deliberately simple, and honest about being simple.
 *
 * There is no recovery for this vault, so the cost of a weak passphrase is
 * unrecoverable rather than merely bad. We push toward length, which is what
 * actually matters, rather than toward symbol soup, which mostly produces
 * passwords people forget.
 */
export function ratePassphrase(p: string): PassphraseVerdict {
  const len = p.length;
  const words = p.trim().split(/\s+/).filter(Boolean).length;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;

  if (len < 12) {
    return {
      ok: false,
      score: 0,
      label: 'Too short',
      hint: 'At least 12 characters. A short phrase of ordinary words beats a mangled single word.',
    };
  }
  if (words >= 4 || (len >= 20 && variety >= 2)) {
    return { ok: true, score: 3, label: 'Strong', hint: 'Good. Write it down somewhere physical.' };
  }
  if (len >= 16 || variety >= 3) {
    return { ok: true, score: 2, label: 'Reasonable', hint: 'A few more words would make this considerably harder to guess.' };
  }
  return {
    ok: true,
    score: 1,
    label: 'Weak',
    hint: 'This will hold up to a casual attempt and not much more. Consider a four-word phrase.',
  };
}
