# Running EscrowAI on the TrueForge harness

EscrowAI's replay engine is exposed to TrueForge as an MCP server. The TrueForge agent
reads the PR over the GitHub connector, calls EscrowAI to replay and diff, posts the
verdict, and sets the merge gate. Releasing a blocked merge stays a human action in the
dashboard.

## 1. Start the pieces

```bash
# EscrowAI's replay engine as a Streamable-HTTP MCP server
npm run agent:mcp -- --http          # http://localhost:4700/mcp

# TrueForge harness (separate terminal)
npx @truefoundry/trueforge           # opens the TrueForge UI
```

Docker must be running — `run_replay` boots the base and PR branches in containers (it
falls back to local processes if the daemon is down).

## 2. Configure TrueForge (one time, in its UI)

- **Settings → Models** — add a standard provider:
  - Base URL `https://api.groq.com/openai/v1`
  - API key: your Groq key
  - Model id `llama-3.3-70b-versatile` (name it `groq-default` to match the manifest)
- **Settings → Connectors** — add **GitHub** from the catalog, authorise the
  `arnnnavvvvv/EscrowAI` repo (or the sample-target repo you're gating).
- **Settings → Connectors → Add MCP Server** — URL `http://localhost:4700/mcp`, name
  `escrowai`.

## 3. Create the agent

Import [`escrowai-agent.json`](./escrowai-agent.json) (Agents → New → from manifest), or
recreate it in the UI using [`system-prompt.md`](./system-prompt.md) as the instructions
and attaching the `github` and `escrowai` MCP servers. The manifest field names follow
`trueforge.dev/api`; adjust in the UI if the running version differs.

## 4. Trigger it

- **Demo / manual:** run the agent with a PR URL as the input —
  `https://github.com/arnnnavvvvv/EscrowAI/pull/N`.
- **Automatic:** point a GitHub webhook (`pull_request`: opened, synchronize, reopened) at
  TrueForge's inbound webhook URL.

## What you'll see on the PR

1. A comment: the plain-English verdict from `run_replay` — which event types are
   unaffected, which changed, and specifically which would now be silently dropped.
2. A commit status `escrowai` — failing when the verdict blocks, which holds the merge
   until a reviewer approves in the EscrowAI dashboard (`npm run dashboard`).
