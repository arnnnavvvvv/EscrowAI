// In-memory ledger, idempotency store, and the pending-refund queue for out-of-order delivery.

import { recordEffect } from "./effects.js";

// account_id -> balance in the smallest currency unit
const balances = new Map();

// Every processed event id, so a redelivery is a no-op. This is the idempotency guarantee.
const processedEvents = new Set();

// Refunds whose original payment hasn't been seen yet, keyed by payment id, held until it is.
const pendingRefunds = new Map();

// Payment ids we've credited, so a later refund can be matched even if it arrives first would be impossible —
// but a refund arriving second can confirm the payment is known.
const knownPayments = new Set();

// True if this exact event was already handled. Callers must check before applying effects.
export function alreadyProcessed(eventId) {
  return processedEvents.has(eventId);
}

// Mark an event id as fully handled.
export function markProcessed(eventId) {
  processedEvents.add(eventId);
}

// Add funds to an account and note the payment id as known.
export function credit(accountId, paymentId, amount, currency) {
  balances.set(accountId, (balances.get(accountId) ?? 0) + amount);
  knownPayments.add(paymentId);
  recordEffect("ledger.credit", { accountId, paymentId, amount, currency });
  releasePendingRefund(paymentId, accountId, currency);
}

// Remove funds from an account to reverse a payment.
export function debit(accountId, paymentId, amount, currency) {
  balances.set(accountId, (balances.get(accountId) ?? 0) - amount);
  recordEffect("ledger.debit", { accountId, paymentId, amount, currency, reason: "refund" });
}

// Apply a refund, or hold it if the original payment hasn't been seen yet.
export function refund(accountId, paymentId, amount, currency) {
  if (knownPayments.has(paymentId)) {
    debit(accountId, paymentId, amount, currency);
    return;
  }
  pendingRefunds.set(paymentId, { accountId, amount, currency });
  recordEffect("refund.queued", { accountId, paymentId, amount, currency, reason: "payment not yet seen" });
}

// When a payment finally arrives, flush any refund that was waiting on it.
function releasePendingRefund(paymentId, accountId, currency) {
  const held = pendingRefunds.get(paymentId);
  if (!held) return;
  pendingRefunds.delete(paymentId);
  debit(held.accountId ?? accountId, paymentId, held.amount, held.currency ?? currency);
}

// Read a single balance (used by tests and the /__state endpoint).
export function balanceOf(accountId) {
  return balances.get(accountId) ?? 0;
}

// A snapshot of all ledger state, for debugging and the state endpoint.
export function snapshot() {
  return {
    balances: Object.fromEntries(balances),
    processedEvents: [...processedEvents],
    pendingRefunds: Object.fromEntries(pendingRefunds)
  };
}
