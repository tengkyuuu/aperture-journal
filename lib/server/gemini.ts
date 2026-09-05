import 'server-only';

import { GoogleGenAI, Type, type Content, type Schema } from '@google/genai';

import { UNTRUSTED_CONTENT_RULE } from './injection';
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

// ─── Session summary (structured output) ─────────────────────────────────────

/**
 * One schema, four features.
 *
 * This single call produces the session summary, the mood ribbon, the theme
 * constellation, and the input to the weekly chapter. Asking for structured
 * output rather than prose means no parsing, no "sometimes it adds a preamble",
 * and typed data straight into Firestore.
 */
const INSIGHT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Three to six words. No colon, no quotes.' },
    summary: {
      type: Type.STRING,
      description: 'Two or three sentences, second person, plain language.',
    },
    bullets: {
      type: Type.ARRAY,
      description: 'Three to five key points, each one short sentence.',
      items: { type: Type.STRING },
    },
    openLoops: {
      type: Type.ARRAY,
      description: 'Unresolved threads worth returning to. Empty array if none.',
      items: { type: Type.STRING },
    },
    mood: {
      type: Type.OBJECT,
      properties: {
        valence: { type: Type.NUMBER, description: '-1 heavy … 1 light' },
        energy: { type: Type.NUMBER, description: '0 flat … 1 charged' },
        label: { type: Type.STRING, description: 'One or two words for the feeling.' },
      },
      required: ['valence', 'energy', 'label'],
      propertyOrdering: ['valence', 'energy', 'label'],
    },
    emotions: {
      type: Type.ARRAY,
      description: 'Up to four, strongest first.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          intensity: { type: Type.NUMBER, description: '0 … 1' },
        },
        required: ['name', 'intensity'],
        propertyOrdering: ['name', 'intensity'],
      },
    },
    themes: {
      type: Type.ARRAY,
      description: 'Two to five lowercase single-word or hyphenated tags.',
      items: { type: Type.STRING },
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['person', 'place', 'project', 'concept'] },
        },
        required: ['name', 'type'],
        propertyOrdering: ['name', 'type'],
      },
    },
    suggestedExperiment: {
      type: Type.STRING,
      description: 'One small, concrete thing to try. A sentence.',
    },
  },
  required: [
    'title',
    'summary',
    'bullets',
    'openLoops',
    'mood',
    'emotions',
    'themes',
    'entities',
    'suggestedExperiment',
  ],
  propertyOrdering: [
    'title',
    'summary',
    'bullets',
    'openLoops',
    'mood',
    'emotions',
    'themes',
    'entities',
    'suggestedExperiment',
  ],
};

const SUMMARIZE_INSTRUCTION = `
You are closing out a journaling session. Read the conversation and distil it.

Write for the person who wrote it, in second person, in their register. Be
specific — name the actual things they talked about rather than describing the
shape of the conversation. "You kept circling back to whether the move is about
the job or about leaving" beats "You explored a personal decision".

Do not praise. Do not encourage. Do not add advice that was not asked for. The
suggested experiment should be small enough to do tomorrow.

Themes are for grouping sessions over months, so keep them general and reusable:
"work", "sleep", "family", "creative-block" — not "tuesday-standup".

${SAFETY_CLAUSE}`.trim();

export interface SummaryResult {
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Summarise a closed session. Returns PARSED BUT UNVALIDATED JSON — the caller
 * runs it through a Zod schema, because a schema-constrained model is a strong
 * expectation and not a guarantee.
 */
export async function summarizeSession(
  turns: { role: 'user' | 'model'; content: string }[],
): Promise<SummaryResult> {
  const ai = await client();

  const response = await ai.models.generateContent({
    model: MODELS.synthesis,
    contents: toContents(turns),
    config: {
      systemInstruction: SUMMARIZE_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: INSIGHT_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 1600,
    },
  });

  const text = response.text;
  if (!text) throw new Error('EMPTY_SUMMARY');

  return {
    raw: JSON.parse(text),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// ─── Embeddings (Ask Your Past) ──────────────────────────────────────────────

/** Dimensionality we store. Smaller than the model's default; see normalise(). */
export const EMBED_DIMS = 768;

/**
 * gemini-embedding-001 returns unit-normalised vectors only at its native
 * 3072 dimensions. At any smaller output size the vector must be normalised by
 * the caller — otherwise cosine similarity silently degrades into something
 * that mostly measures magnitude.
 */
function normalise(values: number[]): number[] {
  let sum = 0;
  for (const v of values) sum += v * v;
  const mag = Math.sqrt(sum);
  if (mag === 0) return values;
  return values.map((v) => v / mag);
}

export interface EmbedResult {
  values: number[];
  inputTokens: number;
}

/**
 * Embed one piece of text.
 *
 * `taskType` is not decoration: the model produces different vectors for a
 * document being stored and a question being asked, and matching them up is
 * what makes retrieval work. Using the same task type for both measurably
 * hurts results.
 */
export async function embed(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<EmbedResult> {
  const ai = await client();

  const res = await ai.models.embedContent({
    model: MODELS.embedding,
    contents: text,
    config: { outputDimensionality: EMBED_DIMS, taskType },
  });

  const values = res.embeddings?.[0]?.values;
  if (!values?.length) throw new Error('EMBED_EMPTY');

  return { values: normalise(values), inputTokens: estimateTokens(text) };
}

// ─── Grounded answering ──────────────────────────────────────────────────────

const ASK_INSTRUCTION = `
You answer questions about the user's own journal, using only the entries
provided as context.

Ground every claim in those entries and cite the session it came from with a
marker like [[abc123]], using the id given in the entry's tag. Cite as you go,
inline, not as a list at the end.

If the entries do not answer the question, say so plainly and say what they do
cover instead. Never fill a gap with a plausible guess — a journal is a record,
and inventing something the person did not write is the one unforgivable
failure here.

Write in second person, in plain prose. No headings, no bullet lists.

${UNTRUSTED_CONTENT_RULE}

${SAFETY_CLAUSE}`.trim();

export async function streamGroundedAnswer(
  question: string,
  context: string,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const ai = await client();

  const response = await ai.models.generateContentStream({
    model: MODELS.chat,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${context}\n\nQuestion: ${question}` }],
      },
    ],
    config: {
      systemInstruction: ASK_INSTRUCTION,
      maxOutputTokens: LIMITS.maxOutputTokens,
      temperature: 0.3,
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
