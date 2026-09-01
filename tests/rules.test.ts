import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ISOLATION SUITE
 *
 * This file is the difference between "we have data isolation" as a claim and
 * as evidence. It runs against the Firestore emulator with the real
 * firestore.rules file — not a copy, not a mock.
 *
 * Every test in "cross-user isolation" is a NEGATIVE test. A rule without a
 * negative test is an assertion nobody checked.
 *
 * Run:  npm run test:rules
 * ═══════════════════════════════════════════════════════════════════════════
 */

let env: RulesTestEnvironment;
let alice: Firestore;
let bob: Firestore;
let anon: Firestore;

/**
 * `@firebase/rules-unit-testing` v5 declares `firestore()` as the *compat*
 * `firebase.firestore.Firestore`, but returns a modular instance at runtime.
 * One cast, in one place, rather than sprinkling `as any` through the suite.
 */
function fs(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aperture',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  alice = fs(env.authenticatedContext('alice'));
  bob = fs(env.authenticatedContext('bob'));
  anon = fs(env.unauthenticatedContext());
});

afterAll(async () => {
  await env?.cleanup();
});

afterEach(async () => {
  await env.clearFirestore();
});

/**
 * Seed as the server would: with rules bypassed, exactly as the Admin SDK does
 * in production. This is what makes the negative tests meaningful — the
 * documents genuinely exist and are genuinely readable by their owner.
 */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(db, `users/${uid}`), { uid, email: `${uid}@example.com` });
      await setDoc(doc(db, `users/${uid}/sessions/s1`), { title: `${uid} session`, sealed: false });
      await setDoc(doc(db, `users/${uid}/sessions/s1/messages/m1`), {
        role: 'user',
        content: `${uid} private thought`,
      });
      await setDoc(doc(db, `users/${uid}/ai_calls/c1`), { model: 'gemini-2.5-flash' });
      await setDoc(doc(db, `users/${uid}/security_events/e1`), { kind: 'injection_suspected' });
      await setDoc(doc(db, `users/${uid}/chapters/2026-W36`), { narrative: 'a week' });
    }
  });
}

// ─── Positive control ────────────────────────────────────────────────────────
// Without these, a rules file that denied literally everything would "pass"
// the whole suite. These prove the tests can tell allow from deny.

describe('owner access (positive control)', () => {
  it('alice reads her own profile', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  });

  it('alice reads her own sessions', async () => {
    await seed();
    await assertSucceeds(getDocs(collection(alice, 'users/alice/sessions')));
  });

  it('alice reads her own messages', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(alice, 'users/alice/sessions/s1/messages/m1')));
  });

  it('alice reads her own ledger and security events', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(alice, 'users/alice/ai_calls/c1')));
    await assertSucceeds(getDoc(doc(alice, 'users/alice/security_events/e1')));
  });
});

// ─── The tests that matter ───────────────────────────────────────────────────

describe('cross-user isolation', () => {
  it("alice cannot read bob's profile", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob')));
  });

  it("alice cannot list bob's sessions", async () => {
    await seed();
    await assertFails(getDocs(collection(alice, 'users/bob/sessions')));
  });

  it("alice cannot read a specific session of bob's", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob/sessions/s1')));
  });

  it("alice cannot read bob's messages", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob/sessions/s1/messages/m1')));
  });

  it("alice cannot list bob's messages", async () => {
    await seed();
    await assertFails(getDocs(collection(alice, 'users/bob/sessions/s1/messages')));
  });

  it("alice cannot read bob's AI ledger", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob/ai_calls/c1')));
  });

  it("alice cannot read bob's security events", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob/security_events/e1')));
  });

  it("alice cannot read bob's chapters", async () => {
    await seed();
    await assertFails(getDoc(doc(alice, 'users/bob/chapters/2026-W36')));
  });

  it("alice cannot write into bob's tree", async () => {
    await seed();
    await assertFails(setDoc(doc(alice, 'users/bob/sessions/s1'), { title: 'pwned' }));
  });

  it("alice cannot delete bob's data", async () => {
    await seed();
    await assertFails(deleteDoc(doc(alice, 'users/bob/sessions/s1')));
  });

  it('the isolation holds in the other direction too', async () => {
    await seed();
    await assertFails(getDoc(doc(bob, 'users/alice')));
    await assertFails(getDoc(doc(bob, 'users/alice/sessions/s1/messages/m1')));
  });
});

describe('unauthenticated access', () => {
  it('reads nothing', async () => {
    await seed();
    await assertFails(getDoc(doc(anon, 'users/alice')));
    await assertFails(getDocs(collection(anon, 'users/alice/sessions')));
  });

  it('writes nothing', async () => {
    await assertFails(setDoc(doc(anon, 'users/alice'), { uid: 'alice' }));
    await assertFails(setDoc(doc(anon, 'users/newuser'), { uid: 'newuser' }));
  });
});

// ─── Write-through-server posture ────────────────────────────────────────────
// A client may read its own subtree and write NOTHING. Every mutation goes
// through a server route that validates, rate-limits, and ledgers it.

describe('write-through-server posture', () => {
  it('alice cannot write her OWN session directly', async () => {
    await seed();
    await assertFails(setDoc(doc(alice, 'users/alice/sessions/s2'), { title: 'direct' }));
  });

  it('alice cannot write her OWN messages directly', async () => {
    await seed();
    await assertFails(
      addDoc(collection(alice, 'users/alice/sessions/s1/messages'), {
        role: 'user',
        content: 'direct write',
      }),
    );
  });

  it('alice cannot forge an entry in her own AI ledger', async () => {
    await seed();
    // Repudiation defence: if a user could write this, the audit trail would
    // be worthless as evidence of what was actually sent to the model.
    await assertFails(
      addDoc(collection(alice, 'users/alice/ai_calls'), { model: 'free', estCostUsd: 0 }),
    );
  });

  it('alice cannot delete her own security events', async () => {
    await seed();
    await assertFails(deleteDoc(doc(alice, 'users/alice/security_events/e1')));
  });

  it('alice cannot raise her own quota', async () => {
    await seed();
    await assertFails(
      updateDoc(doc(alice, 'users/alice'), { quota: { day: '2026-09-02', chatCalls: 0 } }),
    );
  });

  it('alice cannot create a profile at all — not even her own', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'), { uid: 'alice' }));
  });

  it('alice cannot create a profile claiming to be bob', async () => {
    await assertFails(setDoc(doc(alice, 'users/bob'), { uid: 'bob' }));
  });
});

describe('deny by default', () => {
  it('an unmatched top-level collection is unreachable', async () => {
    await assertFails(getDoc(doc(alice, 'system/config')));
    await assertFails(setDoc(doc(alice, 'system/config'), { x: 1 }));
  });

  it('an unmatched subcollection under a user is unreachable', async () => {
    await seed();
    // Nothing in the rules matches `notes`, so it fails closed rather than
    // inheriting the parent's read permission.
    await assertFails(getDoc(doc(alice, 'users/alice/notes/n1')));
  });
});
