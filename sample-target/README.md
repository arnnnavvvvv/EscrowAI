# sample-target

A small payment-webhook service, in the shape of a real one, for EscrowAI to replay
against. It is deliberately ordinary: an account ledger, a Stripe route, a Razorpay
route, idempotency on the event id, and a queue for refunds that arrive before their
payment.

This directory is committed as the **base** version. At run time EscrowAI materialises it
as a git repo and applies a scenario patch to produce the **PR** version, then boots both.

## Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/webhooks/stripe` | Stripe events — `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` |
| `POST` | `/webhooks/razorpay` | Razorpay events — `payment.captured`, `payment.failed`, `refund.processed` |
| `GET` | `/__health` | readiness |
| `GET` | `/__effects` | **the effect log** — the ordered list of side effects performed since boot |
| `GET` | `/__state` | ledger snapshot (balances, processed event ids, pending refunds) |
| `POST` | `/__control/fail-next` | `{ "count": N }` — reject the next N webhook deliveries with 500, to model provider retries |

## The effect-log contract

EscrowAI does not trust the HTTP status. It reads `/__effects` and compares the ordered
list of effects the base and PR versions produced for the same replay. Each effect:

```json
{ "seq": 1, "kind": "ledger.credit", "at": "...", "accountId": "acct_5521", "paymentId": "pi_...", "amount": 4999, "currency": "usd" }
```

Effect kinds: `ledger.credit`, `ledger.debit`, `refund.queued`, `notification.send`,
`ignored`. The money-moving ones — `ledger.credit`, `ledger.debit` — are the effects
whose disappearance between base and PR is a **silent drop**, not a cosmetic change.

## Scope

This is a demo target, kept minimal on purpose. It handles full refunds, idempotency on
the event id, and out-of-order delivery. It does **not** model partial or multiple partial
refunds against one payment — a real service would, and EscrowAI would replay those too.

## Running standalone

```bash
node src/server.js          # listens on :4000
curl localhost:4000/__health
```
