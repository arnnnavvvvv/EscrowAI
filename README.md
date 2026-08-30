# EscrowAI

**A merge gate for payment webhooks.**

When a pull request touches webhook or payment-handling code, EscrowAI replays a library
of real-shaped event payloads — payment succeeded, failed, refunded, retried, delivered
out of order, delivered twice — against both the base branch and the PR branch inside an
isolated sandbox, and diffs the behaviour. It posts a plain-English verdict on the PR
(what changed, what would now silently break) and blocks the merge until a human
explicitly approves.

The failure mode this exists to catch is **silent failure**: a webhook handler that still
returns `200` but has quietly stopped crediting a payment or firing a refund. That change
doesn't show up in a diff review, in logs, or in metrics — only in the ledger, later.

Built for the WeMakeDevs Agent Harness Hackathon (TrueForge).

---

## How it works

1. **Detect** — a PR touches a webhook handler (route pattern / file path / a payment
   signal in the diff). The agent reads the diff over the GitHub connector.
2. **Replay** — the base branch and the PR branch each boot in their own container. The
   fixture library fires at both: single events, and multi-step delivery scenarios
   (duplicate delivery, out-of-order, retry-after-failure).
3. **Diff** — each branch writes an ordered **effect log**. EscrowAI compares the two logs
   as a multiset. A money-moving effect (`ledger.credit` / `ledger.debit`) that the base
   branch produced and the PR branch doesn't — *while every delivery still returned 2xx* —
   is a **silent drop**.
4. **Gate** — the verdict lands on the PR in plain English, and a failing `escrowai`
   status holds the merge until a human reviews the replay diff and approves in the
   dashboard. The agent never merges, approves, or releases the hold.

## Example verdict

Replaying the seeded PR (`agent/scenarios/silent-refund-drop`), which refactors a Stripe
`switch` into a lookup table and keys one route `charge.refund` where Stripe sends
`charge.refunded`:

> ## EscrowAI is blocking this merge — 2 payment behaviours would silently break
>
> **Ordered lifecycle — capture then refund** — SILENT DROP
> The PR still accepted every delivery but stopped producing `ledger.debit` — money that
> used to move no longer does, with no error surfaced.
>
> **Unaffected:** Duplicate delivery · Retry after failure · Duplicate refund

## Running locally

Requires **Node 20+** and **Docker** (the sandbox falls back to local processes if the
Docker daemon is down). A Groq key and GitHub token are only needed for model-phrased
verdict text and the live GitHub integration — the replay engine and both UIs run without
them.

```bash
npm install

# Replay the seeded PR end to end and print the verdict
npm run replay:sample

# Or drive it from the dashboard:
npm run agent:server     # http://127.0.0.1:4600
npm run dashboard        # http://localhost:4610  → Start replay → Approve

# The landing page (recorded run, demo mode):
npm run landing          # http://localhost:5173
```

`npm test` runs the suite (37 tests, incl. an end-to-end pipeline run on the process
backend); `npm run typecheck` checks all seven packages.

### On the TrueForge harness

```bash
npm run agent:mcp -- --http     # EscrowAI replay engine as an MCP server on :4700
npx @truefoundry/trueforge      # the harness
```

Then configure the Groq model + GitHub connector + the EscrowAI MCP URL in the TrueForge
UI and import the agent manifest. Full steps:
[`agent/trueforge/README.md`](agent/trueforge/README.md).

## Layout

| Package | What it does |
|---|---|
| `protocol/` | Shared `RunEvent` / `RunResult` type contract between agent and UI |
| `fixtures/` | Stripe & Razorpay-shaped payloads + the delivery scenarios |
| `sample-target/` | The webhook service replays run against, with its effect-log contract |
| `sandbox/` | Two-branch git materialisation + Docker / local-process backends |
| `agent/` | Replay, the effect-diff classifier, verdict, CLI, HTTP server, MCP server |
| `dashboard/ui/` | Shared React component library (`@escrowai/ui`) + the run-state reducer |
| `dashboard/` | Local dashboard app — drives a live run, hosts the approval action |
| `landing/` | Static landing page — the same components replaying `demo-data/` |

The dashboard and the landing page render the **same** `RunView` component from the same
event stream — live SSE for the dashboard, a recorded timeline for the landing page.

## Design notes

Every meaningful judgement call is logged in `decisions.md` as it was made — why the diff
is a base-vs-PR multiset rather than golden expectations, why the seeded bug is a
one-character key typo, why the process backend exists, and what code-review findings were
taken vs. declined.

## Code review (Qodo)

Every change ships as a pull request reviewed by [Qodo Merge](https://www.qodo.ai/) before
it merges — nothing was committed straight to `main`. The full trail is on the PRs; the
summary:

| PR | Scope | Qodo findings | Outcome |
|---|---|---:|---|
| [#1](https://github.com/arnnnavvvvv/EscrowAI/pull/1) | fixture library | 3 | tooling gaps (workspace list, typecheck target) — fixed |
| [#2](https://github.com/arnnnavvvvv/EscrowAI/pull/2) | sample target | 4 | pending-refund overwrite fixed; partial-refund over-debit declined (out of scope, see D17) |
| [#3](https://github.com/arnnnavvvvv/EscrowAI/pull/3) | replay engine | 11 | 8 fixed in [#6](https://github.com/arnnnavvvvv/EscrowAI/pull/6); 3 declined with reasons |
| [#4](https://github.com/arnnnavvvvv/EscrowAI/pull/4) | UI + server | 7 | all fixed in [#6](https://github.com/arnnnavvvvv/EscrowAI/pull/6) |
| [#5](https://github.com/arnnnavvvvv/EscrowAI/pull/5) | MCP + harness | 5 | path-traversal + access-control fixed; others addressed |
| [#6](https://github.com/arnnnavvvvv/EscrowAI/pull/6) | review-fix pass | 3 | follow-ups fixed |
| [#7](https://github.com/arnnnavvvvv/EscrowAI/pull/7) | docs | 0 | — |

### Findings that mattered, and what changed

- **Fallback exposes host secrets** (security) — the process backend passed the full parent
  environment to PR-controlled code, so a replayed handler could read `GITHUB_TOKEN` /
  `GROQ_API_KEY`. Now runs with a minimal allow-listed env.
- **Webhook requests can hang** (reliability) — replay `fetch` calls had no deadline; a PR
  branch that accepts a connection and never responds would hang the merge gate forever.
  All replay calls are now bounded by `AbortSignal.timeout`.
- **PR manifest changes ignored** (correctness) — `materialize()` read one `.escrowai.json`
  before applying the patch and used it for both branches. Now each branch's manifest is
  read from its own worktree.
- **Failed boots leak instances** (reliability) — a failed second-instance boot left the
  first container and the worktree behind. Each backend now stops its half-started
  instance, and `createSandbox` cleans the workdir on construction failure.
- **Scenario path traversal** (security) — the run and MCP endpoints joined an unvalidated
  scenario name into a filesystem path. Now validated against the on-disk scenario list.
- **`refund.issue` never blocks** (correctness) — the money-moving set was hardcoded to
  credits and debits. `refund.issue` added; classifier tests for dropped/duplicated
  refunds added.
- **Docker images accumulate** — `stop()` / `reset()` now `docker rmi` as well.

### Findings declined, and why

- **Partial-refund over-debit** in `sample-target` — it's a deliberately minimal demo
  target, not the product, and no fixture delivers partial refunds. Noted in
  `sample-target/README.md`.
- **Golden expected-effects per scenario** — the design is explicitly a base-vs-PR
  differential (`decisions.md` D12); golden expectations would duplicate it and drift.
- **Persistent server / WebSockets / auth on the control plane** — out of scope per the
  build's non-goals (local, self-hosted, no auth).

`decisions.md` D17 has the complete applied/declined list.
