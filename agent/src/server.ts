// Local HTTP server the dashboard talks to — start a run, stream its events over SSE, release the merge gate.

import { createServer } from "node:http";
import { readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { runReplay } from "./run.js";
import type { RunEvent } from "@escrowai/protocol";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenariosDir = join(repoRoot, "agent", "scenarios");

interface RunSession {
  id: string;
  scenario: string;
  events: RunEvent[];
  listeners: Set<(event: RunEvent) => void>;
  approve: ((who: { by: string }) => void) | null;
  done: boolean;
}

const sessions = new Map<string, RunSession>();

/** Record an event on the session and fan it out to live listeners. */
function emit(session: RunSession, event: RunEvent): void {
  session.events.push(event);
  for (const listener of session.listeners) listener(event);
}

/** Kick off a run in the background, wiring its events and approval gate to the session. */
function startRun(scenario: string): RunSession {
  const session: RunSession = {
    id: randomUUID(),
    scenario,
    events: [],
    listeners: new Set(),
    approve: null,
    done: false
  };
  sessions.set(session.id, session);

  runReplay({
    targetDir: join(repoRoot, "sample-target"),
    scenarioDir: join(scenariosDir, scenario),
    workDir: join(repoRoot, ".escrowai-work", `${scenario}-${session.id.slice(0, 8)}`),
    backend: "auto",
    onEvent: (event) => emit(session, event),
    awaitApproval: () =>
      new Promise((resolvePromise) => {
        session.approve = (who) => resolvePromise(who);
      })
  })
    .catch((err) => emit(session, { type: "error", message: String(err?.message ?? err) }))
    .finally(() => {
      session.done = true;
    });

  return session;
}

/** Read a JSON request body. */
async function readJson(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  });
  res.end(text);
}

const port = Number(process.env.ESCROWAI_PORT ?? 4600);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    });
    return res.end();
  }

  try {
    if (req.method === "GET" && path === "/api/scenarios") {
      const entries = await readdir(scenariosDir, { withFileTypes: true });
      return send(res, 200, { scenarios: entries.filter((e) => e.isDirectory()).map((e) => e.name) });
    }

    if (req.method === "POST" && path === "/api/runs") {
      const body = await readJson(req);
      const scenario = typeof body.scenario === "string" ? body.scenario : "silent-refund-drop";
      const session = startRun(scenario);
      return send(res, 202, { runId: session.id, scenario });
    }

    const streamMatch = path.match(/^\/api\/runs\/([^/]+)\/stream$/);
    if (req.method === "GET" && streamMatch) {
      const session = sessions.get(streamMatch[1]!);
      if (!session) return send(res, 404, { error: "unknown run" });

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "access-control-allow-origin": "*"
      });
      const write = (event: RunEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      session.events.forEach(write);
      session.listeners.add(write);
      const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
      req.on("close", () => {
        clearInterval(keepAlive);
        session.listeners.delete(write);
      });
      return;
    }

    const approveMatch = path.match(/^\/api\/runs\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const session = sessions.get(approveMatch[1]!);
      if (!session) return send(res, 404, { error: "unknown run" });
      const body = await readJson(req);
      const by = typeof body.by === "string" && body.by ? body.by : "reviewer";
      if (!session.approve) return send(res, 409, { error: "run is not awaiting approval" });
      session.approve({ by });
      session.approve = null;
      return send(res, 200, { ok: true, by });
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: String((err as Error)?.message ?? err) });
  }
});

server.listen(port, () => {
  console.log(`EscrowAI agent server on http://localhost:${port}`);
});
