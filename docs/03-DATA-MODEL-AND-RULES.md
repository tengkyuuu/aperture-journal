# Data Model, Security Rules & Isolation Tests

The "zero cross-user leakage" requirement is won or lost here. Everything is **path-scoped**:
a forgotten `where` clause fails *open*, a wrong path fails *closed*.

---

## 1. Firestore layout

```
/users/{uid}                              profile
    uid, email, displayName, photoURL, createdAt, lastSeenAt
    settings: { defaultMode, theme, reducedMotion }
    vault:    { salt: string, check: string, enabledAt }   ← salt is NOT secret
    quota:    { day: '2026-09-01', chatCalls: 12, tokens: 48210 }

  /sessions/{sessionId}
      title, mode, startedAt, endedAt, status: 'open'|'closed',
      messageCount, sealed: boolean,
      summary?: string,
      insights?: { mood, emotions[], themes[], entities[], openLoops[], suggestedExperiment },
      embedding?: number[]                                 ← 768 dims, absent when sealed

    /messages/{messageId}
        role: 'user'|'model', createdAt, sealed: boolean,
        content?: string        ← present only when sealed === false
        cipher?: string         ← present only when sealed === true (base64 iv||ciphertext)

  /chapters/{isoWeek}           weekly synthesis: narrative, arc, openLoops[], generatedAt
  /ai_calls/{callId}            privacy ledger (append-only, client-unwritable)
      at, route, model, purpose, inputTokens, outputTokens, estCostUsd,
      latencyMs, dataClasses: string[], sealedExcluded: number
  /security_events/{eventId}    injectionSuspected | rateLimited | authAnomaly
      at, kind, severity, detail, sessionId?

/system/{...}                   admin-only. No client access, ever.
```

**Invariant:** a `sealed: true` document never carries a `content` field, and its parent
session never carries `summary`, `insights`, or `embedding`. Sealed content cannot reach
Gemini because the plaintext does not exist on the server — enforced by construction, not by
an `if`.

---

## 2. `firestore.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn()      { return request.auth != null; }
    function isOwner(uid)    { return signedIn() && request.auth.uid == uid; }
    function unchanged(f)    { return request.resource.data[f] == resource.data[f]; }

    match /users/{uid} {
      // Read your own profile. Nobody else's. Ever.
      allow read:   if isOwner(uid);

      // Create only a document whose uid field matches your own token — no spoofing.
      allow create: if isOwner(uid)
                    && request.resource.data.uid == uid
                    && request.resource.data.keys().hasOnly(
                         ['uid','email','displayName','photoURL','createdAt','lastSeenAt','settings']);

      // Users may change settings and nothing else. vault/quota are server-managed.
      allow update: if isOwner(uid)
                    && unchanged('uid')
                    && request.resource.data.diff(resource.data)
                         .affectedKeys().hasOnly(['settings','lastSeenAt']);

      allow delete: if false;   // account deletion goes through the server route

      match /sessions/{sessionId} {
        allow read:  if isOwner(uid);
        allow write: if false;                 // server-only: validated + ledgered

        match /messages/{messageId} {
          allow read:  if isOwner(uid);
          allow write: if false;
        }
      }

      match /chapters/{isoWeek}        { allow read: if isOwner(uid); allow write: if false; }
      match /ai_calls/{callId}         { allow read: if isOwner(uid); allow write: if false; }
      match /security_events/{eventId} { allow read: if isOwner(uid); allow write: if false; }
    }

    // Deny by default. Anything not matched above is unreachable.
    match /{document=**} { allow read, write: if false; }
  }
}
```

**Posture:** *read-scoped-by-rules, write-through-server.* Clients get realtime timeline
updates for free; every mutation is Zod-validated, rate-limited, and ledgered on the server.

**The Admin SDK bypasses all of the above.** So every server data access re-derives the uid
from the verified cookie:

```ts
// lib/server/db.ts
import 'server-only';

/** SECURITY PRECONDITION: `uid` MUST come from requireUid(), never from client input. */
export function userDoc(uid: string)     { return db.doc(`users/${uid}`); }
export function sessions(uid: string)    { return db.collection(`users/${uid}/sessions`); }
export function messages(uid: string, s: string) {
  return db.collection(`users/${uid}/sessions/${s}/messages`);
}
```

There is no function in the codebase that accepts a collection path from a caller. That is the
whole defense, and it is boring on purpose.

---

## 3. The isolation test suite — your single best artifact

`tests/rules.test.ts`, run against the Firestore emulator with `@firebase/rules-unit-testing`.
Screenshot this green. It converts "we have isolation" from a claim into evidence.

```ts
import { initializeTestEnvironment, assertFails, assertSucceeds }
  from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

let env, alice, bob, anon;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'aperture-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  alice = env.authenticatedContext('alice').firestore();
  bob   = env.authenticatedContext('bob').firestore();
  anon  = env.unauthenticatedContext().firestore();
});

describe('cross-user isolation', () => {
  it('alice cannot read bob\'s profile', async () =>
    assertFails(getDoc(doc(alice, 'users/bob'))));

  it('alice cannot read bob\'s sessions', async () =>
    assertFails(getDocs(collection(alice, 'users/bob/sessions'))));

  it('alice cannot read bob\'s messages', async () =>
    assertFails(getDoc(doc(alice, 'users/bob/sessions/s1/messages/m1'))));

  it('alice cannot read bob\'s AI ledger', async () =>
    assertFails(getDoc(doc(alice, 'users/bob/ai_calls/c1'))));

  it('alice cannot write into bob\'s tree', async () =>
    assertFails(setDoc(doc(alice, 'users/bob/sessions/s1'), { title: 'pwned' })));
});

describe('unauthenticated access', () => {
  it('reads nothing', async () => assertFails(getDoc(doc(anon, 'users/alice'))));
  it('writes nothing', async () => assertFails(setDoc(doc(anon, 'users/alice'), {})));
});

describe('write-through-server posture', () => {
  it('alice cannot write her OWN session directly', async () =>
    assertFails(setDoc(doc(alice, 'users/alice/sessions/s1'), { title: 'x' })));

  it('alice cannot forge her own AI ledger entry', async () =>
    assertFails(setDoc(doc(alice, 'users/alice/ai_calls/c1'), { estCostUsd: 0 })));
});

describe('anti-spoofing on profile create', () => {
  it('alice cannot create a profile claiming uid=bob', async () =>
    assertFails(setDoc(doc(alice, 'users/alice'), { uid: 'bob', email: 'a@x.com' })));

  it('alice can create her own valid profile', async () =>
    assertSucceeds(setDoc(doc(alice, 'users/alice'),
      { uid: 'alice', email: 'a@x.com', displayName: 'A', photoURL: '',
        createdAt: new Date(), lastSeenAt: new Date(), settings: {} })));
});

describe('deny-by-default', () => {
  it('an unmatched collection is unreachable', async () =>
    assertFails(getDoc(doc(alice, 'system/config'))));
});
```

Run: `firebase emulators:exec --only firestore "npx vitest run tests/rules.test.ts"`

**Gate rule for the sprint: do not start Day 2 until this suite is green.**

---

## 4. Server-side guardrails beyond rules

| Control | Implementation |
|---|---|
| Identity | `requireUid()` — `verifySessionCookie(cookie, true)`; throws 401 otherwise |
| Input validation | Zod schema per route; `.strict()` so unknown keys are rejected |
| Rate limit | Firestore transaction on `/users/{uid}.quota`; daily cap on chat calls and tokens |
| Token ceiling | `maxOutputTokens` on every Gemini call |
| Origin check | Mutating routes verify `Origin` matches the deployed host |
| Ledger | Every model call writes `/users/{uid}/ai_calls/{id}` before returning |
| Logging | Redaction allowlist; message content, prompts, outputs and tokens are never logged |
| Errors | Client sees a generic code; the log holds the detail |

---

## 5. Indexes

`firestore.indexes.json` — needed once you sort and filter the timeline:

- `sessions`: `status ASC, startedAt DESC`
- `sessions`: `sealed ASC, startedAt DESC`
- `ai_calls`: `at DESC`

No vector index in v1 — see the tradeoff note in [02-ARCHITECTURE.md](02-ARCHITECTURE.md).
