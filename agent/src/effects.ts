// Normalises raw effect-log entries and computes the multiset difference between two effect lists.

import type { NormalizedEffect } from "./types.js";

// Effects that move money. Losing or duplicating one of these between branches is a blocking
// finding, not a cosmetic change. `refund.queued` is deliberately excluded — it is a pending
// marker; the money moves on the `ledger.debit` that follows it.
const MONEY_MOVING = new Set(["ledger.credit", "ledger.debit", "refund.issue"]);

/** Fields that identify an effect regardless of when it happened. */
const SIGNATURE_FIELDS = [
  "kind",
  "accountId",
  "paymentId",
  "amount",
  "currency",
  "template",
  "eventType"
] as const;

/** Turn one raw effect-log entry into a comparable NormalizedEffect. */
export function normalizeEffect(raw: Record<string, unknown>): NormalizedEffect {
  const kind = String(raw.kind ?? "unknown");
  const detail: Record<string, unknown> = {};
  for (const field of SIGNATURE_FIELDS) {
    if (field !== "kind" && raw[field] !== undefined) detail[field] = raw[field];
  }
  const signature = SIGNATURE_FIELDS.map((f) => `${f}=${raw[f] ?? ""}`).join("|");
  return { kind, moneyMoving: MONEY_MOVING.has(kind), signature, detail };
}

/** Normalise a whole effect log. */
export function normalizeEffects(raw: unknown): NormalizedEffect[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => normalizeEffect(e as Record<string, unknown>));
}

/** Multiset difference — effects in `a` that `b` doesn't have (accounting for duplicates). */
export function effectsMissingFrom(
  a: NormalizedEffect[],
  b: NormalizedEffect[]
): NormalizedEffect[] {
  const remaining = new Map<string, number>();
  for (const e of b) remaining.set(e.signature, (remaining.get(e.signature) ?? 0) + 1);

  const missing: NormalizedEffect[] = [];
  for (const e of a) {
    const count = remaining.get(e.signature) ?? 0;
    if (count > 0) {
      remaining.set(e.signature, count - 1);
    } else {
      missing.push(e);
    }
  }
  return missing;
}
