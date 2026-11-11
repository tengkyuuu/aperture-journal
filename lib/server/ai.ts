import 'server-only';

import Groq from 'groq-sdk';

import { UNTRUSTED_CONTENT_RULE } from './injection';
import { log } from './logger';
import { getSecret } from './secrets';
import {
  LIMITS,
  MODELS,
  PROMPT_BUDGET,
  REASONING_HEADROOM,
  type ConversationMode,
} from '../config';

/**
 * The only place in this codebase that talks to a model.
 *
 *   Text (chat, summaries, grounded answers) → Groq, free tier.
 *   Embeddings (Ask Your Past, Echoes)       → Cloudflare Workers AI, free tier.
 *
 * Keys come from the server's environment through getSecret(). They are never
 * written to a log, and — because of `import 'server-only'` above — this module
 * cannot be reached from a client component without breaking the build.
 */

let groqClient: Groq | null = null;

function groq(): Groq {
  if (!groqClient) {
    // maxRetries: 0 because withRetry() below owns retrying. Two retry loops
    // stacked on each other multiply the wait and hide what actually happened.
    groqClient = new Groq({ apiKey: getSecret('GROQ_API_KEY'), maxRetries: 0 });
  }
  return groqClient;
}

/** A stored conversation turn. `model` is the app's word for the assistant. */
export interface Turn {
  role: 'user' | 'model';
  content: string;
}

type Message = Groq.Chat.ChatCompletionMessageParam;

function toMessages(turns: Turn[]): Message[] {
  return turns.map((t) =>
    t.role === 'model'
      ? { role: 'assistant' as const, content: t.content }
      : { role: 'user' as const, content: t.content },
  );
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

// ─── Transient failure handling ──────────────────────────────────────────────

/**
 * Retry transient failures, honouring what the API asks for.
 *
 *   1. Overload (5xx) happens. A single retry usually turns it into a slightly
 *      slower response.
 *   2. A 429 says how long to wait — a `retry-after` header, and Groq also
 *      writes "Please try again in 7.6s" into the message. Backing off 400ms
 *      against that is pure noise: it burns the retry budget and hits the same
 *      wall. So we wait what we are told to wait.
 *
 * Deliberately narrow: 429, 5xx, and one known-flaky 400 (below). Any other
 * 400 or a 413 means we sent something the model rejects every time, and
 * retrying it just spends time to reach the same failure.
 *
 * The wait is capped. If the API asks for a minute, that is a genuine quota
 * wall, and holding a request handler open that long serves nobody: fail fast
 * and let the caller see an honest "the model is busy" instead.
 */
const MAX_BACKOFF_MS = 8_000;

/** An HTTP failure from a provider we call with plain fetch (Cloudflare). */
class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`PROVIDER_HTTP_${status}`);
    this.name = 'ProviderHttpError';
  }
}

/**
 * Pull the HTTP status out of a provider error without depending on its shape.
 *
 * Prefers a numeric `status` property (the Groq SDK and ProviderHttpError both
 * carry one). The loose text fallback is anchored on word boundaries
 * deliberately — an unanchored three-digit match over an error string will
 * happily pick three digits out of a token count and report a 429 that never
 * happened.
 */
export function errorStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }

  const text = String(err);

  const structured = /"code"\s*:\s*(\d{3})\b/.exec(text);
  if (structured) return Number(structured[1]);

  const loose = /\b(4\d{2}|5\d{2})\b/.exec(text);
  return loose ? Number(loose[1]) : null;
}

/** The API tells us how long to wait. Believe it. */
function suggestedDelayMs(err: unknown): number | null {
  if (err instanceof ProviderHttpError) return err.retryAfterMs;

  const headers = (err as { headers?: unknown } | null)?.headers;
  if (headers && typeof (headers as Headers).get === 'function') {
    const parsed = parseRetryAfter((headers as Headers).get('retry-after'));
    if (parsed !== null) return parsed;
  }

  // "Please try again in 1m2.5s" / "in 7.66s" / "in 450ms"
  const m = /try again in (?:(\d+)m)?(\d+(?:\.\d+)?)(ms|s)\b/i.exec(String(err));
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : 0;
  const amount = Number(m[2]);
  return Math.round(minutes * 60_000 + (m[3] === 'ms' ? amount : amount * 1000));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

export class ProviderBusy extends Error {
  constructor() {
    super('PROVIDER_BUSY');
    this.name = 'ProviderBusy';
  }
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = errorStatus(err);
      const transient =
        status === 429 ||
        (status !== null && status >= 500) ||
        /overloaded|over capacity|UNAVAILABLE|timed? ?out/i.test(String(err)) ||
        // Groq rejects a strict-mode generation that came out short with a 400
        // ("Generated JSON does not match the expected schema"). Measured on
        // gpt-oss-20b: 1 run in 4 on the real insight schema, and the same
        // request then succeeds. A bad sample, not a bad request — retry it.
        /does not match the expected schema|failed_generation/i.test(String(err));

      if (!transient || i === attempts - 1) break;

      const asked = suggestedDelayMs(err);
      if (asked !== null && asked > MAX_BACKOFF_MS) {
        // A wall, not a blip. Stop rather than hold the request open.
        log.warn('ai_quota_wall', { reason: label, status, durationMs: asked });
        break;
      }

      const backoff = asked ?? 800 * 3 ** i + Math.random() * 400;
      log.warn('ai_retry', {
        reason: label,
        status,
        count: i + 1,
        durationMs: Math.round(backoff),
      });
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  // A provider rate limit is not our bug and not an internal error. Surfacing
  // it as one would send the user a generic 500 for something they can simply
  // retry in a moment.
  if (errorStatus(lastError) === 429) {
    log.warn('ai_rate_limited', { reason: label, status: 429 });
    throw new ProviderBusy();
  }
  throw lastError;
}

// ─── Token estimation and prompt budgets ─────────────────────────────────────

/**
 * Rough pre-flight estimate for the quota check, intentionally pessimistic.
 * Reconciled against real usage after the call — see settleQuota().
 * ~3.5 characters per token is a reasonable approximation for English prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Keep the newest turns that fit `budget` estimated tokens.
 *
 * Groq's free tier refuses any single request larger than its per-minute
 * token limit — it does not queue it, it rejects it. A long session would
 * otherwise go from working to permanently broken at one particular message.
 * The newest turn is always kept: it is the one being answered.
 */
export function fitTurns(turns: Turn[], budget: number): { kept: Turn[]; dropped: number } {
  let total = 0;
  let start = turns.length;
  while (start > 0) {
    const cost = estimateTokens(turns[start - 1]!.content);
    if (total + cost > budget && start < turns.length) break;
    total += cost;
    start--;
  }
  return { kept: turns.slice(start), dropped: start };
}

const HISTORY_TRIMMED_NOTE = `
The earliest part of this conversation is not shown to you because of length.
If the user refers to something you cannot see, say so plainly rather than
guessing at what was said.`.trim();

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface StreamResult {
  stream: AsyncGenerator<string>;
  /** Resolves once the stream is fully consumed. */
  usage: Promise<{ inputTokens: number; outputTokens: number }>;
  /**
   * The model that actually answered — which may be the fallback.
   *
   * Callers write this to the ledger rather than the model they asked for. A
   * ledger that reports the requested model while a different one answered is
   * a ledger that lies, and the whole point of it is that it does not.
   */
  model: string;
}

/**
 * Run against the primary model; on a rate limit or overload, try the
 * fallback once.
 *
 * The free tier meters per model, so when one is exhausted for the day another
 * still has budget. Only ProviderBusy triggers this — a 400 means the request
 * itself is wrong and the fallback would reject it just as fast.
 */
async function withFallback<T>(
  label: string,
  primary: string,
  fallback: string,
  run: (model: string) => Promise<T>,
): Promise<{ value: T; model: string }> {
  try {
    return { value: await withRetry(label, () => run(primary)), model: primary };
  } catch (err) {
    if (!(err instanceof ProviderBusy) || fallback === primary) throw err;
    log.warn('ai_fallback', { reason: label, model: fallback });
    return {
      value: await withRetry(`${label}:fallback`, () => run(fallback)),
      model: fallback,
    };
  }
}

/**
 * Settings shared by every streamed reply.
 *
 * gpt-oss always reasons first. "low" effort keeps a journaling reply
 * immediate, `include_reasoning: false` keeps the reasoning out of the text the
 * user sees, and the headroom stops reasoning tokens from truncating the
 * answer — they count against max_completion_tokens.
 */
const REPLY_SETTINGS = {
  max_completion_tokens: LIMITS.maxOutputTokens + REASONING_HEADROOM,
  reasoning_effort: 'low',
  include_reasoning: false,
} as const;

function toStreamResult(
  response: AsyncIterable<Groq.Chat.ChatCompletionChunk>,
  model: string,
): StreamResult {
  let resolveUsage!: (u: { inputTokens: number; outputTokens: number }) => void;
  const usage = new Promise<{ inputTokens: number; outputTokens: number }>((r) => {
    resolveUsage = r;
  });

  async function* iterate(): AsyncGenerator<string> {
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const chunk of response) {
        // Groq reports usage on the final chunk, under x_groq.
        const meta = chunk.x_groq?.usage;
        if (meta) {
          inputTokens = meta.prompt_tokens ?? inputTokens;
          outputTokens = meta.completion_tokens ?? outputTokens;
        }
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    } finally {
      resolveUsage({ inputTokens, outputTokens });
    }
  }

  return { stream: iterate(), usage, model };
}

/**
 * Stream a conversation turn.
 *
 * `turns` must already be uid-scoped history loaded from Firestore. Never pass
 * client-supplied history straight through — see the note in
 * lib/shared/schemas.ts.
 */
export async function streamChat(
  mode: ConversationMode,
  turns: Turn[],
  signal?: AbortSignal,
): Promise<StreamResult> {
  const client = groq();
  const { kept, dropped } = fitTurns(turns, PROMPT_BUDGET.chat);
  const system = systemInstructionFor(mode, dropped > 0 ? HISTORY_TRIMMED_NOTE : undefined);

  const { value: response, model } = await withFallback(
    'chat',
    MODELS.chat,
    MODELS.chatFallback,
    (m) =>
      client.chat.completions.create(
        {
          model: m,
          messages: [{ role: 'system', content: system }, ...toMessages(kept)],
          temperature: 0.9,
          stream: true,
          ...REPLY_SETTINGS,
        },
        { signal },
      ),
  );

  return toStreamResult(response, model);
}

// ─── Session summary (structured output) ─────────────────────────────────────

/**
 * One schema, four features.
 *
 * This single call produces the session summary, the mood ribbon, the theme
 * constellation, and the input to the weekly chapter. Asking for structured
 * output rather than prose means no parsing, no "sometimes it adds a preamble",
 * and typed data straight into Firestore.
 *
 * Groq's strict mode uses constrained decoding, which needs every property
 * listed in `required` and `additionalProperties: false` on every object.
 */
const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Three to six words. No colon, no quotes.' },
    summary: {
      type: 'string',
      description: 'Two or three sentences, second person, plain language.',
    },
    bullets: {
      type: 'array',
      description: 'Three to five key points, each one short sentence.',
      items: { type: 'string' },
    },
    openLoops: {
      type: 'array',
      description: 'Unresolved threads worth returning to. Empty array if none.',
      items: { type: 'string' },
    },
    mood: {
      type: 'object',
      properties: {
        valence: {
          type: 'number',
          description:
            'How the session FELT, from -1 to 1. NEGATIVE for heavy, difficult, ' +
            'anxious, sad, frustrated or draining. POSITIVE for light, hopeful, ' +
            'satisfied or energising. 0 for genuinely neutral. An anxious or ' +
            'worried session MUST be negative even if something went well in it.',
        },
        energy: {
          type: 'number',
          description:
            'How activated the session felt, 0 to 1. 0 is flat, numb or exhausted; ' +
            '1 is charged, urgent or intense. Independent of whether it felt good.',
        },
        label: { type: 'string', description: 'One or two words for the feeling.' },
      },
      required: ['valence', 'energy', 'label'],
      additionalProperties: false,
    },
    emotions: {
      type: 'array',
      description: 'Up to four, strongest first.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          intensity: { type: 'number', description: '0 … 1' },
        },
        required: ['name', 'intensity'],
        additionalProperties: false,
      },
    },
    themes: {
      type: 'array',
      description: 'Two to five lowercase single-word or hyphenated tags.',
      items: { type: 'string' },
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['person', 'place', 'project', 'concept'] },
        },
        required: ['name', 'type'],
        additionalProperties: false,
      },
    },
    suggestedExperiment: {
      type: 'string',
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
  additionalProperties: false,
} as const;

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

Reply with the JSON object only.

${SAFETY_CLAUSE}`.trim();

/**
 * Fit a whole session into the summary budget.
 *
 * Keeps the opening message (it usually says what the session is about) and
 * as much of the end as fits. The model is told a gap exists, so it does not
 * paper over it.
 */
function fitSession(turns: Turn[]): { kept: Turn[]; omitted: number } {
  const [first, ...rest] = turns;
  if (!first) return { kept: [], omitted: 0 };

  const remaining = PROMPT_BUDGET.summary - estimateTokens(first.content);
  const { kept, dropped } = fitTurns(rest, Math.max(remaining, 0));
  return { kept: [first, ...kept], omitted: dropped };
}

export interface SummaryResult {
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
  /** The model that actually produced this. May be the fallback. */
  model: string;
}

/**
 * Summarise a closed session. Returns PARSED BUT UNVALIDATED JSON — the caller
 * runs it through a Zod schema, because a schema-constrained model is a strong
 * expectation and not a guarantee.
 */
export async function summarizeSession(turns: Turn[]): Promise<SummaryResult> {
  const client = groq();
  const { kept, omitted } = fitSession(turns);

  const system =
    omitted > 0
      ? `${SUMMARIZE_INSTRUCTION}\n\n${omitted} messages from the middle of this session ` +
        'were left out for length. Summarise what you can see and do not guess at the gap.'
      : SUMMARIZE_INSTRUCTION;

  const { value: response, model } = await withFallback(
    'summarize',
    MODELS.synthesis,
    MODELS.synthesisFallback,
    (m) =>
      client.chat.completions.create({
        model: m,
        messages: [{ role: 'system', content: system }, ...toMessages(kept)],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'session_insights', strict: true, schema: INSIGHT_SCHEMA },
        },
        temperature: 0.4,
        max_completion_tokens: 1600 + REASONING_HEADROOM,
        reasoning_effort: 'low',
        include_reasoning: false,
      }),
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('EMPTY_SUMMARY');

  return {
    raw: JSON.parse(text),
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    model,
  };
}

// ─── Embeddings (Ask Your Past, Echoes) ──────────────────────────────────────

/**
 * Dimensionality bge-m3 produces.
 *
 * Vectors written by the previous model (768 dims) still sit in Firestore
 * until `npm run reembed` replaces them. cosine() in retrieval.ts returns -1
 * for mismatched lengths, so an old vector can never produce a false match —
 * it simply is not found until it is re-embedded.
 */
export const EMBED_DIMS = 1024;

/** Unit-normalise so that a dot product is the cosine. Cheap insurance. */
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

const EMBED_TIMEOUT_MS = 15_000;

/**
 * Embed one piece of text with Cloudflare Workers AI.
 *
 * bge-m3 is symmetric for dense retrieval: a stored summary and a question are
 * embedded the same way, with no task instruction. (Gemini needed a task type;
 * this model does not, and adding a prefix it was not trained with hurts.)
 */
export async function embed(text: string): Promise<EmbedResult> {
  const accountId = getSecret('CLOUDFLARE_ACCOUNT_ID');
  const token = getSecret('CLOUDFLARE_API_TOKEN');
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODELS.embedding}`;

  const values = await withRetry('embed', async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], truncate_inputs: true }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new ProviderHttpError(res.status, parseRetryAfter(res.headers.get('retry-after')));
    }

    const body = (await res.json()) as {
      result?: { data?: number[][]; response?: number[][] };
    };
    return body.result?.data?.[0] ?? body.result?.response?.[0];
  });

  if (!values?.length) throw new Error('EMBED_EMPTY');
  if (values.length !== EMBED_DIMS) throw new Error('EMBED_SHAPE');

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
  const client = groq();

  const { value: response, model } = await withFallback(
    'ask',
    MODELS.chat,
    MODELS.chatFallback,
    (m) =>
      client.chat.completions.create(
        {
          model: m,
          messages: [
            { role: 'system', content: ASK_INSTRUCTION },
            { role: 'user', content: `${context}\n\nQuestion: ${question}` },
          ],
          temperature: 0.3,
          stream: true,
          ...REPLY_SETTINGS,
        },
        { signal },
      ),
  );

  return toStreamResult(response, model);
}
