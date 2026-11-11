#!/usr/bin/env node
/**
 * End-to-end check of the model providers: Groq for text, Cloudflare Workers
 * AI for embeddings.
 *
 * A key can exist and still be wrong, revoked, or lack access to a model. The
 * only way to know is to spend a token on it — so this makes one real call per
 * request shape the app uses: a streamed reply, a strict structured summary,
 * and an embedding.
 *
 * The provider calls are re-implemented here rather than imported, because
 * lib/server/* is guarded by `import 'server-only'` and will not load outside
 * Next. The MODEL IDS, however, come from lib/config.ts — a verifier with its
 * own copy of the thing it verifies is worse than no verifier.
 *
 *   npm run verify:ai
 */

import Groq from 'groq-sdk';

import { MODELS } from '../lib/config.ts';
import { EMBED_DIMS, embedOne, need } from './lib/providers.mjs';

let failed = 0;
const ok = (label, detail = '') => console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`);
const bad = (label, detail = '') => {
  failed++;
  console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`);
};

const groq = new Groq({ apiKey: need('GROQ_API_KEY'), maxRetries: 0 });

console.log('Groq — streamed reply (the chat request shape)');
for (const model of new Set([MODELS.chat, MODELS.chatFallback])) {
  const t0 = Date.now();
  try {
    const stream = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Reply in one short sentence.' },
        { role: 'user', content: 'Say hello to a journal.' },
      ],
      stream: true,
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      include_reasoning: false,
    });
    let text = '';
    for await (const c of stream) text += c.choices[0]?.delta?.content ?? '';
    if (!text.trim()) bad(model, 'empty reply — reasoning may have used the whole budget');
    else if (/<think>/i.test(text)) bad(model, 'reasoning leaked into the reply text');
    else ok(model, `${Date.now() - t0}ms  "${text.trim().slice(0, 60)}"`);
  } catch (err) {
    bad(model, String(err).slice(0, 160));
  }
}

console.log('\nGroq — strict structured output (the summary request shape)');
for (const model of new Set([MODELS.synthesis, MODELS.synthesisFallback])) {
  try {
    const res = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Rate the mood of the message. Reply with JSON only.' },
        { role: 'user', content: 'I am dreading tomorrow and could not sleep.' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'mood',
          strict: true,
          schema: {
            type: 'object',
            properties: { valence: { type: 'number' }, label: { type: 'string' } },
            required: ['valence', 'label'],
            additionalProperties: false,
          },
        },
      },
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      include_reasoning: false,
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}');
    if (typeof parsed.valence !== 'number') bad(model, 'schema not honoured');
    else if (parsed.valence >= 0) bad(model, `mood polarity wrong: valence ${parsed.valence}`);
    else ok(model, `valence ${parsed.valence}, "${parsed.label}"`);
  } catch (err) {
    bad(model, String(err).slice(0, 160));
  }
}

console.log('\nCloudflare Workers AI — embedding');
try {
  const v = await embedOne('I shipped the feature and nobody noticed.');
  ok(MODELS.embedding, `${v.length} dims (expected ${EMBED_DIMS})`);
} catch (err) {
  bad(MODELS.embedding, String(err).slice(0, 160));
}

console.log(failed ? `\n✗ ${failed} check(s) failed.` : '\n✓ All providers answered.');
process.exit(failed ? 1 : 0);
