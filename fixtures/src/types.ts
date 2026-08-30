// Type definitions for the webhook payload library — individual event fixtures and multi-step delivery scenarios.

/** Payment providers whose webhook schemas we model. */
export type Provider = "stripe" | "razorpay";

/** The three event outcomes from §2 of the spec: a payment landed, failed, or was refunded. */
export type EventCategory = "succeeded" | "failed" | "refunded";

/** A single side effect a correct handler is expected to perform for a given event. */
export interface ExpectedEffect {
  /** The effect, in the same vocabulary the sandbox effect-log uses. */
  kind:
    | "ledger.credit"
    | "ledger.debit"
    | "refund.issue"
    | "notification.send"
    | "none";
  /** True when this effect moves money — its disappearance between branches is a silent drop, not a cosmetic change. */
  moneyMoving: boolean;
  /** Why this effect is expected, in plain language for the verdict. */
  note: string;
}

/** One webhook event: the raw provider-shaped payload plus the headers and the expected handling. */
export interface Fixture {
  /** Stable id, `<provider>.<category>` — referenced by scenarios and the UI. */
  id: string;
  provider: Provider;
  /** Human label for the replay timeline. */
  title: string;
  description: string;
  /** The provider's own event type string, e.g. `payment_intent.succeeded`. */
  eventType: string;
  category: EventCategory;
  /** Headers the provider would send alongside the body (signature header value is illustrative). */
  headers: Record<string, string>;
  /** The webhook body exactly as the provider would POST it. */
  body: unknown;
  /** What a correct handler must do with this event. */
  expectedEffects: ExpectedEffect[];
}

/** One delivery in a scenario — a fixture, optionally mutated, optionally delayed. */
export interface DeliveryStep {
  /** Which fixture to send. */
  fixtureId: string;
  /** Shallow-merged onto the fixture body before sending — used to reuse an event id for redelivery, bump a timestamp, etc. */
  bodyOverrides?: Record<string, unknown>;
  /** Header overrides, same merge semantics. */
  headerOverrides?: Record<string, string>;
  /** Milliseconds to wait before sending this step. */
  delayMs?: number;
  /** If set, the sandbox forces the handler to fail this many times before letting it through — models provider retry. */
  failFirstAttempts?: number;
  /** Label for this step in the timeline. */
  label: string;
}

/** A sequence of deliveries that together probe one hard-to-get-right behavior. */
export interface DeliveryScenario {
  /** Stable id. */
  id: string;
  title: string;
  description: string;
  /** The behavior under test — retry, ordering, or idempotency. */
  probes: "idempotency" | "ordering" | "retry";
  steps: DeliveryStep[];
  /** What correct handling looks like, for the verdict. */
  expectation: string;
}
