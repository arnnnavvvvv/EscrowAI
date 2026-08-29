// Multi-step delivery scenarios — the retry, out-of-order, and duplicate cases from §2, built by sequencing the base fixtures.

import type { DeliveryScenario } from "./types.js";

/**
 * Each scenario replays a short sequence and asserts one behavior that handlers routinely
 * get wrong. The diff engine runs every scenario against both branches; a scenario whose
 * outcome changes between base and PR is the finding.
 */
export const deliveryScenarios: DeliveryScenario[] = [
  {
    id: "ordered-lifecycle",
    title: "Ordered lifecycle — capture then refund",
    description:
      "The happy path: a payment is captured, then later fully refunded, delivered in order. Establishes the baseline both branches should agree on.",
    probes: "ordering",
    expectation:
      "One credit on capture, one matching debit on refund. Net ledger movement is zero.",
    steps: [
      { fixtureId: "stripe.succeeded", label: "capture delivered" },
      { fixtureId: "stripe.refunded", label: "refund delivered", delayMs: 200 }
    ]
  },
  {
    id: "duplicate-delivery",
    title: "Duplicate delivery — same event twice",
    description:
      "The provider delivers the exact same `payment_intent.succeeded` event twice (same event id), which every provider warns can happen. A correct handler is idempotent on the event id.",
    probes: "idempotency",
    expectation:
      "Exactly one credit. The second delivery is recognised as already-processed and produces no ledger movement.",
    steps: [
      { fixtureId: "stripe.succeeded", label: "first delivery" },
      {
        fixtureId: "stripe.succeeded",
        label: "redelivery (same event id)",
        delayMs: 150
      }
    ]
  },
  {
    id: "out-of-order-refund",
    title: "Out-of-order — refund before capture",
    description:
      "The refund webhook arrives before the capture webhook it depends on — a real ordering hazard when a payment is refunded seconds after capture. A correct handler either queues the refund until the capture lands or reconciles from the payment id.",
    probes: "ordering",
    expectation:
      "The refund is not silently discarded. Once both events are processed the ledger nets to zero, regardless of arrival order.",
    steps: [
      { fixtureId: "stripe.refunded", label: "refund arrives first" },
      {
        fixtureId: "stripe.succeeded",
        label: "capture arrives second",
        delayMs: 200
      }
    ]
  },
  {
    id: "retry-after-failure",
    title: "Retry after failure — provider redelivers",
    description:
      "The handler fails (500) on the first delivery of a captured payment; the provider retries the same event, as Stripe and Razorpay both do with backoff. A correct handler processes the retry exactly once and does not double-count because of the earlier partial run.",
    probes: "retry",
    expectation:
      "Exactly one credit after the retry succeeds. The failed first attempt left no partial ledger movement behind.",
    steps: [
      {
        fixtureId: "razorpay.succeeded",
        label: "delivery (fails once, then retried)",
        failFirstAttempts: 1
      }
    ]
  },
  {
    id: "duplicate-refund",
    title: "Duplicate refund — refund event twice",
    description:
      "A refund event is delivered twice. The classic silent-money bug is debiting the customer's ledger twice for one refund.",
    probes: "idempotency",
    expectation:
      "Exactly one debit. The second refund delivery is recognised as already-processed.",
    steps: [
      { fixtureId: "razorpay.succeeded", label: "capture (sets up the refund)" },
      {
        fixtureId: "razorpay.refunded",
        label: "first refund delivery",
        delayMs: 150
      },
      {
        fixtureId: "razorpay.refunded",
        label: "refund redelivery",
        delayMs: 150
      }
    ]
  }
];
