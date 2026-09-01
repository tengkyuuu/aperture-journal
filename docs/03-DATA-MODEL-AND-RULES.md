# Data Model, Security Rules & Isolation Tests

> **Status: implemented.** This document now describes shipped code, not a plan.
> Source of truth: [`firestore.rules`](../firestore.rules), [`lib/server/db.ts`](../lib/server/db.ts),
> [`tests/rules.test.ts`](../tests/rules.test.ts).

The "zero cross-user leakage" requirement is won or lost here. Everything is **path-scoped**:
a forgotten `where` clause fails *open*, a wrong path fails *closed*.

---

## 1. Firestore layout

```
/users/{uid}                              profile
    uid, email, displayName, photoURL, createdAt, lastSeenAt
    settings: { defaultMode, theme, reducedMotion }
    vault:    { salt, check, enabledAt }        ← salt is NOT secret
    quota:    { day, chatCalls, tokens }        ← server-managed, transactional

  /sessions/{sessionId}
      title, mode, startedAt, endedAt, status: 'open'|'closed',
      messageCount, sealed: boolean,
      summary?, insights?, embedding?           ← all absent when sealed

    /messages/{messageId}
        role: 'user'|'model', createdAt, sealed: boolean,
        content?: string        ← present only when sealed === false
        cipher?: string         ← present only when sealed === true

  /chapters/{isoWeek}           weekly synthesis
  /ai_calls/{callId}            privacy ledger (append-only, client-unwritable)
  /security_events/{eventId}    injection suspicions, rate limits, auth anomalies
```

**Invariant:** a `sealed: true` document never carries a `content` field, and its parent
session never carries `summary`, `insights`, or `embedding`. Sealed content cannot reach
Gemini because the plaintext does not exist on the server — enforced by construction, not by
an `if`.

---

## 2. The rules posture, in one sentence

> **A client may READ its own subtree and may WRITE NOTHING.**

That single sentence is the entire authorization model, which is exactly why it is defensible.
Every mutation goes through a server route that re-derives the uid from a verified session
cookie, validates with Zod, checks the quota, and writes a ledger row.

See [`firestore.rules`](../firestore.rules) for the full file. The shape:

```javascript
function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }

match /users/{uid} {
  allow read:  if isOwner(uid);
  allow write: if false;
  // …explicit match blocks per subcollection, all read-own / write-never…
}

match /{document=**} { allow read, write: if false; }   // deny by default
```

Subcollections are matched **explicitly** rather than with a recursive wildcard. A
subcollection someone forgets to add therefore fails *closed* rather than inheriting its
parent's read permission.

**These rules are load-bearing even though the app currently reads server-side.** The Firebase
web config is public by design, so anyone can point a client SDK at this database. These rules
are the only thing standing between that client and another user's journal.

### Why client writes are denied entirely

An earlier draft allowed a validated self-create of the profile document. Full deny is better:
it is one rule instead of five, it is one sentence to explain, and it removes the whole class
of "the rule was almost right" bugs. The cost is a server round-trip for settings changes,
which is not a cost worth caring about.

### The Admin SDK bypasses all of this

Which is why [`lib/server/db.ts`](../lib/server/db.ts) exists and why it looks the way it does:

```ts
/** SECURITY PRECONDITION: `uid` MUST be the return value of requireUid(). */
export function sessionsCol(uid: string) { return db().collection(`users/${uid}/sessions`); }
```

There is deliberately **no exported helper that accepts a raw collection path**, and no request
schema anywhere in the codebase contains a `uid` field. Document IDs that arrive from a client
pass through `assertSafeId()` before being interpolated into a path.

---

## 3. The isolation suite

[`tests/rules.test.ts`](../tests/rules.test.ts) — 26 tests against the Firestore emulator using
the real rules file, not a copy.

```bash
npm run test:rules
```

| Group | What it proves |
|---|---|
| **Positive control** (4) | Alice *can* read her own profile, sessions, messages, ledger. Without these, a rules file denying everything would "pass" the suite. |
| **Cross-user isolation** (11) | Alice cannot read or list Bob's profile, sessions, messages, ledger, security events, or chapters; cannot write into or delete from his tree; and the same holds in reverse. |
| **Unauthenticated** (2) | Reads nothing, writes nothing. |
| **Write-through-server** (7) | Alice cannot write her *own* session or messages, cannot forge a ledger entry, cannot delete her own security events, cannot raise her own quota, cannot create a profile at all. |
| **Deny by default** (2) | An unmatched top-level collection and an unmatched subcollection are both unreachable. |

The ledger test is the subtle one: if a user could write their own `ai_calls` rows, the audit
trail would be worthless as evidence of what was actually sent to the model. Repudiation
defence only works if the subject cannot edit the record.

Seeding runs through `withSecurityRulesDisabled`, exactly as the Admin SDK behaves in
production — so the negative tests run against documents that genuinely exist and are
genuinely readable by their owner.

> **Gate rule: Day 2 does not start until this suite is green.**

### Requirement: Java

The Firestore emulator is a Java process. `npm run test:rules` fails with
`Could not spawn 'java -version'` until a JRE is installed and on `PATH`.

---

## 4. Server-side guardrails beyond rules

| Control | Where |
|---|---|
| Identity | [`lib/server/auth.ts`](../lib/server/auth.ts) — `verifySessionCookie(cookie, true)`, plus `auth_time` freshness when minting |
| Input validation | [`lib/shared/schemas.ts`](../lib/shared/schemas.ts) — `z.strictObject`, unknown keys rejected, sizes bounded |
| CSRF | `SameSite=Lax` cookie **plus** an explicit `Origin` check in [`lib/server/http.ts`](../lib/server/http.ts) |
| Rate limit | [`lib/server/ratelimit.ts`](../lib/server/ratelimit.ts) — Firestore transaction on the quota field, reconciled against real usage after the call |
| Token ceiling | `LIMITS.maxOutputTokens` on every Gemini call |
| Ledger | [`lib/server/ledger.ts`](../lib/server/ledger.ts) — every model call, before the response returns |
| Logging | [`lib/server/logger.ts`](../lib/server/logger.ts) — redaction **allowlist**; a field is logged only if explicitly named |
| Errors | Generic code to the client, detail to the log — `toErrorResponse()` |
| Bundle | [`scripts/verify-no-secrets.mjs`](../scripts/verify-no-secrets.mjs) — greps built client output for key patterns |

---

## 5. Indexes

[`firestore.indexes.json`](../firestore.indexes.json): `sessions` by `status + startedAt`,
`sessions` by `sealed + startedAt`, `ai_calls` by `at`.

No vector index in v1 — see the tradeoff note in [02-ARCHITECTURE.md](02-ARCHITECTURE.md).
