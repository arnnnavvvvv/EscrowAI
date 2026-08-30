// MCP server exposing EscrowAI's replay engine as tools — this is what the TrueForge agent calls after reading a PR diff.

import { readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { runReplay } from "./run.js";
import { detectWebhookChanges } from "./detect.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenariosDir = join(repoRoot, "agent", "scenarios");
const targetDir = join(repoRoot, "sample-target");

/** List the scenario directories that ship with the repo. */
async function scenarioIds(): Promise<string[]> {
  const entries = await readdir(scenariosDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Build the MCP server and register EscrowAI's tools. */
export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: "escrowai", version: "0.1.0" },
    { instructions: "Replays webhook fixtures against a PR and its base branch, then reports what would silently break." }
  );

  server.registerTool(
    "list_scenarios",
    {
      description: "List the replay scenarios EscrowAI can run against the sample target.",
      inputSchema: {}
    },
    async () => {
      const ids = await scenarioIds();
      return { content: [{ type: "text", text: ids.join("\n") }] };
    }
  );

  server.registerTool(
    "detect_webhook_changes",
    {
      description:
        "Given a PR's changed files (path, and optionally the diff hunk), decide whether webhook or payment-handling code is touched and EscrowAI should run.",
      inputSchema: {
        files: z
          .array(z.object({ path: z.string(), patch: z.string().optional() }))
          .describe("Changed files from the PR diff.")
      }
    },
    async ({ files }) => {
      const manifest = JSON.parse(await readFile(join(targetDir, ".escrowai.json"), "utf8")) as {
        webhookPaths?: string[];
      };
      const result = detectWebhookChanges(files, manifest.webhookPaths ?? []);
      return {
        content: [{ type: "text", text: result.reason }],
        structuredContent: {
          touched: result.touched,
          matches: result.matches,
          reason: result.reason
        }
      };
    }
  );

  server.registerTool(
    "run_replay",
    {
      description:
        "Replay a scenario's fixture set against the sample target's base and PR branches in an isolated sandbox. Returns the verdict, the merge-gate decision, and the PR comment body.",
      inputSchema: {
        scenario: z
          .string()
          .default("silent-refund-drop")
          .describe("Scenario id from list_scenarios.")
      }
    },
    async ({ scenario }) => {
      const known = await scenarioIds();
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(scenario) || !known.includes(scenario)) {
        return {
          content: [{ type: "text", text: `Unknown scenario "${scenario}". Available: ${known.join(", ")}` }],
          isError: true
        };
      }
      const result = await runReplay({
        targetDir,
        scenarioDir: join(scenariosDir, scenario),
        // Unique per call so concurrent replays don't share (and wipe) a work directory.
        workDir: join(repoRoot, ".escrowai-work", `mcp-${scenario}-${randomUUID().slice(0, 8)}`),
        backend: "auto"
      });
      return {
        content: [{ type: "text", text: result.verdict.markdown }],
        structuredContent: {
          gate: result.verdict.gate,
          headline: result.verdict.headline,
          backend: result.backend,
          findings: result.verdict.findings.map((f) => ({
            scenario: f.title,
            classification: f.classification,
            narrative: f.narrative
          })),
          comment: result.verdict.markdown
        }
      };
    }
  );

  return server;
}

/** Serve over stdio (default) or Streamable HTTP (`--http`, port from ESCROWAI_MCP_PORT). */
async function main(): Promise<void> {
  const http = process.argv.includes("--http");
  const server = buildMcpServer();

  if (!http) {
    await server.connect(new StdioServerTransport());
    return;
  }

  const port = Number(process.env.ESCROWAI_MCP_PORT ?? 4700);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const host = process.env.ESCROWAI_MCP_HOST ?? "127.0.0.1";
  createServer((req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    transport.handleRequest(req, res).catch((err) => {
      res.writeHead(500).end(String(err));
    });
  }).listen(port, host, () => {
    console.log(`EscrowAI MCP (streamable http) on http://${host}:${port}/mcp`);
  });
}

// Only boot a transport when run directly (`npm run mcp`), not when imported for its buildMcpServer export.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
