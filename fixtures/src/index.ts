// Loads the raw payload JSON, wraps each in its Fixture metadata, and exports the catalog plus lookup helpers.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Fixture } from "./types.js";

export * from "./types.js";
export { deliveryScenarios } from "./scenarios.js";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

/** Read one payload file from data/ and parse it. */
function loadBody(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(dataDir, relativePath), "utf8"));
}

/**
 * The full fixture catalog: three outcomes (succeeded / failed / refunded) for each of
 * Stripe and Razorpay. Delivery quirks — retry, out-of-order, duplicate — are layered on
 * top of these by the scenarios, not baked into separate payloads.
 */
export const fixtures: Fixture[] = [
  {
    id: "stripe.succeeded",
    provider: "stripe",
    title: "Stripe — payment succeeded",
    description: "A card payment for order ord_10423 was captured for $49.99.",
    eventType: "payment_intent.succeeded",
    category: "succeeded",
    headers: {
      "content-type": "application/json",
      "stripe-signature":
        "t=1751328000,v1=3f8a1c9d5b2e7a4f0c6d8b1e9a3f5c7d2b4e6a8f0c1d3b5e7a9f1c3d5b7e9a1f,v0=6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e5a7f",
      "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    },
    body: loadBody("stripe/payment-succeeded.json"),
    expectedEffects: [
      {
        kind: "ledger.credit",
        moneyMoving: true,
        note: "Credit the customer's account for the $49.99 they paid — the payment is worthless to them if this doesn't run."
      },
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Send the receipt / provisioning confirmation."
      }
    ]
  },
  {
    id: "stripe.failed",
    provider: "stripe",
    title: "Stripe — payment failed",
    description: "The card for order ord_10424 was declined for insufficient funds.",
    eventType: "payment_intent.payment_failed",
    category: "failed",
    headers: {
      "content-type": "application/json",
      "stripe-signature":
        "t=1751328420,v1=8b1e9a3f5c7d2b4e6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e,v0=1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e5a7f9c1d3b",
      "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    },
    body: loadBody("stripe/payment-failed.json"),
    expectedEffects: [
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Notify the customer the payment failed and prompt a retry — no ledger movement."
      }
    ]
  },
  {
    id: "stripe.refunded",
    provider: "stripe",
    title: "Stripe — charge refunded",
    description: "The full $49.99 for order ord_10423 was refunded to the customer.",
    eventType: "charge.refunded",
    category: "refunded",
    headers: {
      "content-type": "application/json",
      "stripe-signature":
        "t=1751414800,v1=9a3f5c7d2b4e6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f,v0=3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e5a7f9c1d3b5e",
      "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    },
    body: loadBody("stripe/charge-refunded.json"),
    expectedEffects: [
      {
        kind: "ledger.debit",
        moneyMoving: true,
        note: "Reverse the earlier credit — the customer's account must reflect that the money went back."
      },
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Send the refund confirmation and revoke access if the plan is now unpaid."
      }
    ]
  },
  {
    id: "razorpay.succeeded",
    provider: "razorpay",
    title: "Razorpay — payment captured",
    description: "A UPI payment for order ord_20871 was captured for ₹4,990.00.",
    eventType: "payment.captured",
    category: "succeeded",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature":
        "2b4e6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e",
      "x-razorpay-event-id": "evt_PmQ8sK2eZvKYm0",
      "user-agent": "Razorpay-Webhook/1.0"
    },
    body: loadBody("razorpay/payment-captured.json"),
    expectedEffects: [
      {
        kind: "ledger.credit",
        moneyMoving: true,
        note: "Credit the account for the ₹4,990 captured — Razorpay `payment.captured` is the money-in signal."
      },
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Send the receipt / provisioning confirmation."
      }
    ]
  },
  {
    id: "razorpay.failed",
    provider: "razorpay",
    title: "Razorpay — payment failed",
    description: "The card for order ord_20872 failed at the bank for insufficient funds.",
    eventType: "payment.failed",
    category: "failed",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature":
        "4e6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e5a",
      "x-razorpay-event-id": "evt_PmQBw42eZvKYm1",
      "user-agent": "Razorpay-Webhook/1.0"
    },
    body: loadBody("razorpay/payment-failed.json"),
    expectedEffects: [
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Notify the customer and prompt a retry — no ledger movement."
      }
    ]
  },
  {
    id: "razorpay.refunded",
    provider: "razorpay",
    title: "Razorpay — refund processed",
    description: "The full ₹4,990.00 for order ord_20871 was refunded to the customer.",
    eventType: "refund.processed",
    category: "refunded",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature":
        "6a8f0c1d3b5e7a9f1c3d5b7e9a1f3c5d7b9e1a3f5c7d9b1e3a5f7c9d1b3e5a7f",
      "x-razorpay-event-id": "evt_PmQM0T2eZvKYm2",
      "user-agent": "Razorpay-Webhook/1.0"
    },
    body: loadBody("razorpay/refund-processed.json"),
    expectedEffects: [
      {
        kind: "ledger.debit",
        moneyMoving: true,
        note: "Reverse the earlier credit for pay_PmQ8sK2eZvKYlo — the account must reflect the money going back."
      },
      {
        kind: "notification.send",
        moneyMoving: false,
        note: "Send the refund confirmation and revoke access if the plan is now unpaid."
      }
    ]
  }
];

const byId = new Map(fixtures.map((f) => [f.id, f]));

/** Look up a fixture by id; throws if the id is unknown so scenario typos fail loudly. */
export function getFixture(id: string): Fixture {
  const fixture = byId.get(id);
  if (!fixture) {
    throw new Error(`Unknown fixture id: ${id}`);
  }
  return fixture;
}

/** All fixtures for one provider. */
export function fixturesForProvider(provider: Fixture["provider"]): Fixture[] {
  return fixtures.filter((f) => f.provider === provider);
}
