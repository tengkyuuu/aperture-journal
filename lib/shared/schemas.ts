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

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
export type Mode = z.infer<typeof ModeSchema>;
