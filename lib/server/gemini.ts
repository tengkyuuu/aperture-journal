import 'server-only';

import { GoogleGenAI, type Content } from '@google/genai';

import { getSecret } from './secrets';
import { LIMITS, MODELS, type ConversationMode } from '../config';

/**
 * The only place in this codebase that talks to Gemini.
 *
 * The API key is fetched from Secret Manager on first use and cached inside
 * getSecret(). It is never read from an environment variable, never written to
 * a log, and — because of `import 'server-only'` above — cannot be reached
 * from a client component without breaking the build.
 */

let clientPromise: Promise<GoogleGenAI> | null = null;

async function client(): Promise<GoogleGenAI> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const apiKey = await getSecret(process.env.GEMINI_SECRET_NAME ?? 'GEMINI_API_KEY');
      return new GoogleGenAI({ apiKey });
    })().catch((err) => {
      clientPromise = null; // let the next request retry rather than caching a failure
      throw err;
    });
  }
  return clientPromise;
}

// ─── Personas ────────────────────────────────────────────────────────────────

/**
 * Applied to every mode without exception.
 *
 * A journaling app sits close to mental health whether or not it wants to. The
 * honest position is to be useful for reflection, refuse to be a clinician, and
 * handle a crisis by stopping rather than by coaching through it.
 */
const SAFETY_CLAUSE = `
You are not a therapist, doctor, or crisis service, and you never imply otherwise.
Do not diagnose. Do not use clinical language to describe the user. Do not give
medical, legal, or financial advice.

If the user expresses intent to harm themselves or someone else, or describes
being in immediate danger: stop the exercise entirely. Do not ask another
reflective question, do not reframe, do not continue the mode. Respond briefly
and plainly, say that you are not the right kind of help for this, and encourage
them to contact local emergency services or a crisis line. Keep it short and
human. Never minimise and never lecture.`.trim();

const VOICE = `
Write in plain, warm, unadorned prose. Short paragraphs. No bullet lists unless
the user asks for one. No headers. Never begin with "I understand" or "That
sounds". Never praise the user for sharing. Do not summarise what they just said
back to them — they know what they said.`.trim();

const PERSONAS: Record<ConversationMode, string> = {
  reflect: `
You are a journaling companion. Your job is to help the user hear their own
thinking, not to add yours.

Ask ONE question at a time and then stop. Choose the question that opens the
widest door — usually about something they mentioned in passing rather than the
thing they led with. Follow the specific over the general.

Do not give advice unless they ask twice. Do not offer interpretations of their
behaviour. If they arrive at something themselves, do not restate it as though
you found it.`.trim(),

  brainstorm: `
You are a brainstorming partner. Generate first, judge later.

When asked for ideas, give six to ten, fast, and let them be uneven — the weak
ones make the strong ones visible. Include at least one that is slightly too
strange. Then stop and ask which thread to pull.

Do not hedge, do not caveat, do not explain why brainstorming is useful. Push
back when an idea is safe and boring; say so plainly.`.trim(),

  untangle: `
You help people untangle knotted thinking.

Reflect the structure of what they said, not the content: notice when a single
event has been turned into a rule, when a prediction is being treated as a fact,
when two separate problems have been fused into one. Name the shape gently and
ask whether it fits.

Never label a thought as "distorted", "irrational", or with any clinical term.
You are noticing patterns in language, not assessing a person. One observation
at a time; leave room for them to disagree with you.`.trim(),

  duck: `
You are a rubber duck for thinking through problems.

Make the user explain the thing properly. Ask what breaks, what they have
already ruled out, and what they are assuming that they have not checked. When
their explanation has a gap, point at the gap rather than filling it.

Be concrete. If they are describing something technical, ask for specifics —
inputs, actual behaviour, expected behaviour.`.trim(),
};

export function systemInstructionFor(mode: ConversationMode, extra?: string): string {
  return [PERSONAS[mode], VOICE, SAFETY_CLAUSE, extra?.trim()].filter(Boolean).join('\n\n');
}

// ─── Token estimation ────────────────────────────────────────────────────────

/**
 * Rough pre-flight estimate for the quota check, intentionally pessimistic.
 * Reconciled against real usage after the call — see settleQuota().
 * ~3.5 characters per token is a reasonable approximation for English prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface StreamResult {
  stream: AsyncGenerator<string>;
  /** Resolves once the stream is fully consumed. */
  usage: Promise<{ inputTokens: number; outputTokens: number }>;
}

/**
 * Stream a conversation turn.
 *
 * `contents` must already be uid-scoped history loaded from Firestore. Never
 * pass client-supplied history straight through — see the note in
 * lib/shared/schemas.ts.
 */
export async function streamChat(
  mode: ConversationMode,
  contents: Content[],
  signal?: AbortSignal,
): Promise<StreamResult> {
  const ai = await client();

  const response = await ai.models.generateContentStream({
    model: MODELS.chat,
    contents,
    config: {
      systemInstruction: systemInstructionFor(mode),
      maxOutputTokens: LIMITS.maxOutputTokens,
      temperature: 0.9,
      // Conversation should feel immediate. Synthesis gets a thinking budget;
      // a journaling reply does not need one.
      thinkingConfig: { thinkingBudget: 0 },
      abortSignal: signal,
    },
  });

  let resolveUsage!: (u: { inputTokens: number; outputTokens: number }) => void;
  const usage = new Promise<{ inputTokens: number; outputTokens: number }>((r) => {
    resolveUsage = r;
  });

  async function* iterate(): AsyncGenerator<string> {
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const chunk of response) {
        const meta = chunk.usageMetadata;
        if (meta) {
          inputTokens = meta.promptTokenCount ?? inputTokens;
          outputTokens = meta.candidatesTokenCount ?? outputTokens;
        }
        const text = chunk.text;
        if (text) yield text;
      }
    } finally {
      resolveUsage({ inputTokens, outputTokens });
    }
  }

  return { stream: iterate(), usage };
}

/** Convert stored turns into the SDK's Content shape. */
export function toContents(turns: { role: 'user' | 'model'; content: string }[]): Content[] {
  return turns.map((t) => ({ role: t.role, parts: [{ text: t.content }] }));
}
