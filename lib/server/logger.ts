import 'server-only';

/**
 * Structured logger with a REDACTION ALLOWLIST.
 *
 * The default is to log nothing. A field appears in a log line only if it is
 * named in ALLOWED_FIELDS below. This is deliberately the inverse of the usual
 * "redact these sensitive keys" denylist, which fails open the moment someone
 * adds a field nobody thought about.
 *
 * Never allowlist: message content, prompts, model output, tokens, cookies,
 * email addresses, or anything derived from a secret.
 */

const ALLOWED_FIELDS = new Set([
  'route',
  'method',
  'status',
  'durationMs',
  'model',
  'purpose',
  'inputTokens',
  'outputTokens',
  'mode',
  'sessionId',
  'code',
  'kind',
  'severity',
  'count',
  'limit',
  'reason',
  'uidHash',
]);

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

function scrub(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    // Even allowlisted values are bounded — a 2MB string in a log line is its
    // own kind of incident.
    out[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return out;
}

function emit(level: Level, msg: string, fields: Fields = {}) {
  const line = JSON.stringify({
    severity: level.toUpperCase(),
    message: msg,
    ...scrub(fields),
    at: new Date().toISOString(),
  });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Fields) => emit('debug', msg, f),
  info: (msg: string, f?: Fields) => emit('info', msg, f),
  warn: (msg: string, f?: Fields) => emit('warn', msg, f),
  error: (msg: string, f?: Fields) => emit('error', msg, f),
};

/**
 * A stable, non-reversible tag for correlating log lines belonging to one user
 * without writing the uid itself into the log. Not a security control — just
 * good hygiene, so a log export is not a user list.
 */
export function uidTag(uid: string): string {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
