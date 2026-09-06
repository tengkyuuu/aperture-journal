import { z } from 'zod';

import { LIMITS } from '../config';

/**
 * Boundary schemas. Every route parses its body through one of these before
 * touching anything else.
 *
 * All of them are STRICT: unknown keys are rejected rather than ignored. A
 * request carrying a field we do not recognise is either a client bug or an
 * attempt to smuggle something past us, and neither deserves a 200.
 *
 * NOTE WHAT IS ABSENT: there is no `uid` field in any request schema, and
 * there never will be. Identity comes from the verified session cookie. See
 * lib/server/auth.ts.
 */

export const ModeSchema = z.enum(['reflect', 'brainstorm', 'untangle', 'duck']);

export const SessionRequestSchema = z.strictObject({
  idToken: z.string().min(20).max(4096),
});

export const ChatTurnSchema = z.strictObject({
  role: z.enum(['user', 'model']),
  content: z.string().min(1).max(LIMITS.maxMessageChars),
});

export const ChatRequestSchema = z.strictObject({
  sessionId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, 'invalid session id')
    .optional(),
  mode: ModeSchema.default('reflect'),
  message: z.string().min(1).max(LIMITS.maxMessageChars),
  /**
   * Prior turns are sent by the client for latency, but they are NOT trusted
   * as the source of truth — the server reloads history from Firestore under
   * the verified uid. This field only bounds what a client may attempt.
   */
  history: z.array(ChatTurnSchema).max(LIMITS.maxTurnsPerRequest).optional(),
});

export const SummarizeRequestSchema = z.strictObject({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

/** Base64 without whitespace. Ciphertext and salts arrive in this shape. */
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Vault setup. Neither of these is secret — the salt defeats precomputed
 * tables, and the check blob only proves that a derived key is the right one.
 * The passphrase itself never reaches this server, which is the entire point.
 */
export const VaultInitSchema = z.strictObject({
  salt: z.string().regex(B64).min(20).max(64),
  check: z.string().regex(B64).min(20).max(512),
});

/**
 * Sealing an existing session. The client sends ciphertext it produced in the
 * browser; the server swaps each message's plaintext for the blob and drops
 * every derived artefact (title, summary, insights, embedding) along with it.
 */
export const SealRequestSchema = z.strictObject({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  messages: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
        cipher: z.string().regex(B64).min(20).max(64_000),
      }),
    )
    .min(1)
    .max(400),
});

export const AskRequestSchema = z.strictObject({
  question: z.string().min(3).max(500),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
export type Mode = z.infer<typeof ModeSchema>;

/**
 * Model OUTPUT is also a trust boundary.
 *
 * `responseSchema` makes the shape a strong expectation, not a guarantee — and
 * this object goes straight into Firestore and then straight into the UI. A
 * `valence` of 9000 would blow out the mood ribbon; a 4,000-word "title" would
 * blow out the timeline. Clamp and bound it here rather than discovering it on
 * stage.
 */
export const InsightsSchema = z.strictObject({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(2_000),
  bullets: z.array(z.string().max(400)).max(8).default([]),
  openLoops: z.array(z.string().max(400)).max(8).default([]),
  mood: z.strictObject({
    valence: z.number().min(-1).max(1).catch(0),
    energy: z.number().min(0).max(1).catch(0.5),
    label: z.string().min(1).max(40),
  }),
  emotions: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(40),
        intensity: z.number().min(0).max(1).catch(0.5),
      }),
    )
    .max(8)
    .default([]),
  themes: z.array(z.string().min(1).max(40)).max(10).default([]),
  entities: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(80),
        type: z.enum(['person', 'place', 'project', 'concept']),
      }),
    )
    .max(20)
    .default([]),
  suggestedExperiment: z.string().max(500).default(''),
});

/**
 * User preferences.
 *
 * The data model has documented a `settings` object since Day 1 and nothing
 * ever wrote one — the schema promised something the app did not do. This is
 * the route that makes it true.
 *
 * `theme` is deliberately absent: it stays per-device in localStorage. Wanting
 * dark on a laptop at night and light on a phone outdoors is normal, and
 * syncing it would be worse, not better.
 */
export const SettingsSchema = z.strictObject({
  defaultMode: ModeSchema.optional(),
  /** Force reduced motion even when the OS does not ask for it. */
  reduceMotion: z.boolean().optional(),
  /** Echoes. Opt-in, because it changes what leaves the device. */
  echoes: z.boolean().optional(),
});

/**
 * An Echoes lookup.
 *
 * The draft is capped server-side as well as client-side. An unsent draft is
 * the most sensitive thing this app sends anywhere, so the bound on it is not
 * left to the caller.
 */
export const EchoRequestSchema = z.strictObject({
  draft: z.string().trim().min(1).max(2_000),
  /** Excluded from results — echoing the entry you are writing is noise. */
  sessionId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
});

export const RenameSessionSchema = z.strictObject({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  title: z.string().trim().min(1).max(120),
});

export const DeleteSessionSchema = z.strictObject({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  /** Typed by hand. Deleting an entry is not something to do by mis-click. */
  confirm: z.literal('DELETE'),
});
