import { describe, expect, it } from 'vitest';

import {
  decrypt,
  deriveKey,
  encrypt,
  makeCheck,
  newSalt,
  ratePassphrase,
  verifyCheck,
} from '../lib/client/vault';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VAULT CRYPTO
 *
 * The Zero-Knowledge Vault is the headline claim of this app, so it gets
 * tested rather than asserted. These run against the same WebCrypto
 * implementation the browser uses — Node exposes the identical
 * `crypto.subtle` API, so this is the real code path, not a mock.
 *
 * The tests that matter are the negative ones: a wrong passphrase must fail,
 * and tampered ciphertext must fail loudly rather than returning garbage.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const PASSPHRASE = 'correct horse battery staple';
const SECRET = 'I have not told anyone this: I want to quit in March.';

describe('round trip', () => {
  it('encrypts and decrypts back to the original', async () => {
    const salt = newSalt();
    const key = await deriveKey(PASSPHRASE, salt);

    const blob = await encrypt(key, SECRET);
    expect(blob).not.toContain('quit');
    expect(await decrypt(key, blob)).toBe(SECRET);
  });

  it('survives unicode, emoji and newlines', async () => {
    const salt = newSalt();
    const key = await deriveKey(PASSPHRASE, salt);
    const text = 'Line one\nLine two — em dash, café, 日本語, 🔐\ttab';

    expect(await decrypt(key, await encrypt(key, text))).toBe(text);
  });

  it('produces different ciphertext each time (fresh IV)', async () => {
    const salt = newSalt();
    const key = await deriveKey(PASSPHRASE, salt);

    const a = await encrypt(key, SECRET);
    const b = await encrypt(key, SECRET);

    // Identical plaintext under a reused IV would leak equality between
    // entries. Fresh nonces are what stop that.
    expect(a).not.toBe(b);
    expect(await decrypt(key, a)).toBe(await decrypt(key, b));
  });
});

describe('the negative cases — these are the point', () => {
  it('a wrong passphrase cannot decrypt', async () => {
    const salt = newSalt();
    const right = await deriveKey(PASSPHRASE, salt);
    const wrong = await deriveKey('correct horse battery stapler', salt);

    const blob = await encrypt(right, SECRET);
    await expect(decrypt(wrong, blob)).rejects.toThrow();
  });

  it('the same passphrase under a different salt cannot decrypt', async () => {
    const a = await deriveKey(PASSPHRASE, newSalt());
    const b = await deriveKey(PASSPHRASE, newSalt());

    await expect(decrypt(b, await encrypt(a, SECRET))).rejects.toThrow();
  });

  it('tampered ciphertext fails rather than returning garbage', async () => {
    const key = await deriveKey(PASSPHRASE, newSalt());
    const blob = await encrypt(key, SECRET);

    // Flip a byte in the middle of the ciphertext.
    const bytes = Buffer.from(blob, 'base64');
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    const tampered = bytes.toString('base64');

    // AES-GCM authenticates. A modified blob is rejected, not silently
    // decrypted into nonsense the UI would happily render.
    await expect(decrypt(key, tampered)).rejects.toThrow();
  });

  it('a truncated blob fails', async () => {
    const key = await deriveKey(PASSPHRASE, newSalt());
    const blob = await encrypt(key, SECRET);

    await expect(decrypt(key, blob.slice(0, 12))).rejects.toThrow();
  });
});

describe('passphrase check blob', () => {
  it('accepts the right passphrase', async () => {
    const salt = newSalt();
    const key = await deriveKey(PASSPHRASE, salt);
    const check = await makeCheck(key);

    expect(await verifyCheck(await deriveKey(PASSPHRASE, salt), check)).toBe(true);
  });

  it('rejects a wrong passphrase without throwing', async () => {
    const salt = newSalt();
    const check = await makeCheck(await deriveKey(PASSPHRASE, salt));

    expect(await verifyCheck(await deriveKey('not it', salt), check)).toBe(false);
  });

  it('reveals nothing about the passphrase', async () => {
    const salt = newSalt();
    const check = await makeCheck(await deriveKey(PASSPHRASE, salt));

    // The stored artefact must not contain the passphrase or any part of it.
    for (const word of PASSPHRASE.split(' ')) {
      expect(check.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe('key handling', () => {
  it('derived keys are non-extractable', async () => {
    const key = await deriveKey(PASSPHRASE, newSalt());

    // Even our own code cannot read the key material back out. That caps what
    // an XSS can steal at "whatever it can do while the tab is open".
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('salts are unique per call', () => {
    const salts = new Set(Array.from({ length: 50 }, () => newSalt()));
    expect(salts.size).toBe(50);
  });
});

describe('passphrase rating', () => {
  it('rejects anything under 12 characters', () => {
    expect(ratePassphrase('short').ok).toBe(false);
    expect(ratePassphrase('elevenchars').ok).toBe(false);
  });

  it('rewards length over symbol soup', () => {
    const phrase = ratePassphrase('correct horse battery staple');
    const soup = ratePassphrase('P@ssw0rd!123');

    expect(phrase.score).toBeGreaterThan(soup.score);
  });
});
