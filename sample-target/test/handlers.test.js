// Behavioural tests for the base handler — the reference behaviour EscrowAI's diff compares a PR against.

import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "data");
const load = (p) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));

// Fresh module state per test — the ledger keeps state at module scope by design.
async function freshHandlers() {
  vi.resetModules();
  process.env.EFFECTS_LOG_PATH = join(
    tmpdir(),
    `sample-target-effects-${Math.random().toString(36).slice(2)}.log`
  );
  return import("../src/handlers.js");
}

const stripeHeaders = { "stripe-signature": "t=1,v1=x" };

describe("stripe handler — base behaviour", () => {
  let h;
  beforeEach(async () => {
    h = await freshHandlers();
  });

  it("credits the account on payment_intent.succeeded", () => {
    const res = h.handleStripe(load("stripe/payment-succeeded.json"), stripeHeaders);
    expect(res.status).toBe(200);
    expect(h.balanceOf("acct_5521")).toBe(4999);
  });

  it("is idempotent — a redelivered event credits once", () => {
    const event = load("stripe/payment-succeeded.json");
    h.handleStripe(event, stripeHeaders);
    h.handleStripe(event, stripeHeaders);
    expect(h.balanceOf("acct_5521")).toBe(4999);
  });

  it("does not move the ledger on payment_failed", () => {
    h.handleStripe(load("stripe/payment-failed.json"), stripeHeaders);
    expect(h.balanceOf("acct_5521")).toBe(0);
  });

  it("nets to zero when a refund follows its capture", () => {
    h.handleStripe(load("stripe/payment-succeeded.json"), stripeHeaders);
    h.handleStripe(load("stripe/charge-refunded.json"), stripeHeaders);
    expect(h.balanceOf("acct_5521")).toBe(0);
  });

  it("holds an out-of-order refund and applies it once the capture lands", () => {
    h.handleStripe(load("stripe/charge-refunded.json"), stripeHeaders);
    expect(h.balanceOf("acct_5521")).toBe(0); // refund queued, not applied yet
    h.handleStripe(load("stripe/payment-succeeded.json"), stripeHeaders);
    expect(h.balanceOf("acct_5521")).toBe(0); // credit then queued debit both applied
  });
});

describe("razorpay handler — base behaviour", () => {
  let h;
  beforeEach(async () => {
    h = await freshHandlers();
  });

  it("credits on payment.captured using the event-id header for idempotency", () => {
    const event = load("razorpay/payment-captured.json");
    const headers = { "x-razorpay-event-id": "evt_rp_1" };
    h.handleRazorpay(event, headers);
    h.handleRazorpay(event, headers);
    expect(h.balanceOf("acct_7734")).toBe(499000);
  });

  it("nets to zero when refund.processed follows the capture", () => {
    h.handleRazorpay(load("razorpay/payment-captured.json"), { "x-razorpay-event-id": "evt_rp_1" });
    h.handleRazorpay(load("razorpay/refund-processed.json"), { "x-razorpay-event-id": "evt_rp_2" });
    expect(h.balanceOf("acct_7734")).toBe(0);
  });
});
