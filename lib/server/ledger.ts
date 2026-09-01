import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { aiCallsCol, securityEventsCol } from './db';
import { PRICING_PER_MTOK } from '../config';
import { log } from './logger';

/**
 * The Privacy Ledger.
 *
 * Every model call this server makes on a user's behalf writes one row here,
 * readable by that user and writable by nobody. It answers a question people
 * are right to ask and almost no AI product will answer honestly: what left my
 * device, when, and how much of it.
 *
 * It doubles as the repudiation control in the threat model — "I never sent
 * that to the AI" has an auditable answer.
 */

export type DataClass =
  | 'question_only'
  | 'single_message'
  | 'session_messages'
  | 'summary_only';

export interface LedgerEntry {
  route: string;
  model: string;
  purpose: 'chat' | 'summarize' | 'embed' | 'ask';
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** What categories of user data were included in the prompt. */
  dataClasses: DataClass[];
  /** How many sealed items were deliberately excluded from this call. */
  sealedExcluded: number;
  sessionId?: string;
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_MTOK[model];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/**
 * SECURITY PRECONDITION: `uid` comes from requireUid().
 * Best-effort — a ledger write must never fail the user's request, but a
 * failure is logged loudly because a silent gap in an audit trail is worse
 * than no audit trail.
 */
export async function recordAiCall(uid: string, entry: LedgerEntry): Promise<void> {
  try {
    await aiCallsCol(uid).add({
      ...entry,
      estCostUsd: Number(
        estimateCostUsd(entry.model, entry.inputTokens, entry.outputTokens).toFixed(6),
      ),
      at: FieldValue.serverTimestamp(),
    });
  } catch {
    log.error('ledger_write_failed', {
      route: entry.route,
      model: entry.model,
      purpose: entry.purpose,
    });
  }
}

export type SecurityEventKind = 'injection_suspected' | 'rate_limited' | 'auth_anomaly';

/** SECURITY PRECONDITION: `uid` comes from requireUid(). */
export async function recordSecurityEvent(
  uid: string,
  kind: SecurityEventKind,
  severity: 'low' | 'medium' | 'high',
  detail: string,
  sessionId?: string,
): Promise<void> {
  try {
    await securityEventsCol(uid).add({
      kind,
      severity,
      // Bounded: this is shown back to the user, and it originated as untrusted
      // input. Length-capped here; escaped on render.
      detail: detail.slice(0, 300),
      sessionId: sessionId ?? null,
      at: FieldValue.serverTimestamp(),
    });
  } catch {
    log.error('security_event_write_failed', { kind, severity });
  }
}
