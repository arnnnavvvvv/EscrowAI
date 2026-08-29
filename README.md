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

_Fills in once the pipeline is wired. Requires Node 20+, Docker, a Groq API key, and a
GitHub token — see `.env.example`._

```bash
npm install
cp .env.example .env   # fill in GROQ_API_KEY and GITHUB_TOKEN
```

## Qodo review evidence

_Section fills in with the Qodo review trail before submission._
