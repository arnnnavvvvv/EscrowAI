# EscrowAI

**A merge gate for payment webhooks.**

When a pull request touches webhook or payment-handling code, EscrowAI replays a library
of real-shaped event payloads — payment succeeded, failed, refunded, retried, delivered
out of order, delivered twice — against both the base branch and the PR branch inside an
isolated sandbox, and diffs the behavior. It posts a plain-English verdict on the PR
(what changed, what would now silently break) and blocks the merge until a human
explicitly approves.

The failure mode this exists to catch is **silent failure**: a webhook handler that still
returns `200` but has quietly stopped crediting a payment or firing a refund.

---

## Status

Early build — WeMakeDevs Agent Harness Hackathon (TrueForge). This README fills in as the
pieces land.

## Architecture

| Piece | What it does |
|---|---|
| `agent/` | TrueForge harness config, GitHub MCP wiring, replay + diff logic, verdict |
| `sandbox/` | Docker orchestration — base and PR branch booted in isolated containers |
| `fixtures/` | Real-schema payload library (Stripe / Razorpay-shaped) |
| `dashboard/` | Shared React component library + the local dashboard app |
| `landing/` | Static landing page — same components, replaying a recorded run |
| `demo-data/` | Captured output from a real local run, powers the landing demo mode |

## Running locally

Requires **Node 20+** and **Docker** (the sandbox falls back to local processes if the
Docker daemon is down). A Groq key and GitHub token are only needed for the verdict
phrasing and the live GitHub integration — the replay engine and both UIs run without
them.

```bash
npm install

# Replay the seeded PR end to end and print the verdict
npm run replay:sample

# Or drive it from the dashboard:
npm run agent:server     # http://localhost:4600
npm run dashboard        # http://localhost:4610  → Start replay → Approve

# The landing page (recorded run, demo mode):
npm run landing          # http://localhost:5173
```

`npm test` runs the suite; `npm run typecheck` checks all packages.

## Layout

- `protocol/` — shared `RunEvent` / `RunResult` type contract
- `fixtures/` — Stripe & Razorpay-shaped payloads + delivery scenarios
- `sample-target/` — the webhook service replays run against, with its effect-log contract
- `sandbox/` — two-branch materialisation + Docker / process backends
- `agent/` — replay, effect-diff classifier, verdict, CLI, HTTP server
- `dashboard/ui/` — shared React component library (`@escrowai/ui`)
- `dashboard/` — local dashboard app
- `landing/` — static landing page, replays `demo-data/`

## Qodo review evidence

_Section fills in with the Qodo review trail before submission._
