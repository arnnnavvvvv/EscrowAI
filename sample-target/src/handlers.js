// Webhook handling logic for Stripe and Razorpay events. This is the file a PR to this service typically touches.

import {
  alreadyProcessed,
  markProcessed,
  credit,
  refund,
  balanceOf
} from "./ledger.js";
import { recordEffect } from "./effects.js";

// Handle one Stripe event. Routes on the event type and moves the ledger accordingly.
export function handleStripe(event, headers) {
  const eventId = event.id;
  if (alreadyProcessed(eventId)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  const object = event.data?.object ?? {};

  switch (event.type) {
    case "payment_intent.succeeded": {
      const accountId = object.metadata?.account_id ?? "unknown";
      credit(accountId, object.id, object.amount_received, object.currency);
      recordEffect("notification.send", { accountId, template: "payment_receipt" });
      break;
    }
    case "payment_intent.payment_failed": {
      const accountId = object.metadata?.account_id ?? "unknown";
      recordEffect("notification.send", { accountId, template: "payment_failed" });
      break;
    }
    case "charge.refunded": {
      const accountId = object.metadata?.account_id ?? "unknown";
      refund(accountId, object.payment_intent, object.amount_refunded, object.currency);
      recordEffect("notification.send", { accountId, template: "refund_confirmation" });
      break;
    }
    default:
      recordEffect("ignored", { eventType: event.type });
  }

  markProcessed(eventId);
  return { status: 200, body: { received: true } };
}

// Handle one Razorpay event. Razorpay carries the dedupe id in the x-razorpay-event-id header.
export function handleRazorpay(event, headers) {
  const eventId = headers["x-razorpay-event-id"] ?? `${event.event}:${event.created_at}`;
  if (alreadyProcessed(eventId)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload?.payment?.entity ?? {};
      const accountId = payment.notes?.account_id ?? "unknown";
      credit(accountId, payment.id, payment.amount, payment.currency);
      recordEffect("notification.send", { accountId, template: "payment_receipt" });
      break;
    }
    case "payment.failed": {
      const payment = event.payload?.payment?.entity ?? {};
      const accountId = payment.notes?.account_id ?? "unknown";
      recordEffect("notification.send", { accountId, template: "payment_failed" });
      break;
    }
    case "refund.processed": {
      const refundEntity = event.payload?.refund?.entity ?? {};
      const accountId = refundEntity.notes?.account_id ?? "unknown";
      refund(accountId, refundEntity.payment_id, refundEntity.amount, refundEntity.currency);
      recordEffect("notification.send", { accountId, template: "refund_confirmation" });
      break;
    }
    default:
      recordEffect("ignored", { eventType: event.event });
  }

  markProcessed(eventId);
  return { status: 200, body: { received: true } };
}

// Re-exported so the state endpoint can report a balance without importing the ledger directly.
export { balanceOf };
