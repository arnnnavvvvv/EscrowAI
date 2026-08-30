// Thin client for the agent server — start a run, get an SSE source for it, release the gate.

import { createSseSource, type RunSource } from "@escrowai/ui";

const base = ""; // same-origin; Vite proxies /api to the agent server

/** List the scenario ids the agent knows about. */
export async function listScenarios(): Promise<string[]> {
  const res = await fetch(`${base}/api/scenarios`);
  const json = (await res.json()) as { scenarios: string[] };
  return json.scenarios;
}

/** Start a run and return its id. */
export async function startRun(scenario: string): Promise<string> {
  const res = await fetch(`${base}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario })
  });
  const json = (await res.json()) as { runId: string };
  return json.runId;
}

/** An event source for a run's SSE stream. */
export function runSource(runId: string): RunSource {
  return createSseSource(`${base}/api/runs/${runId}/stream`);
}

/** Release the merge hold on a run. */
export async function approveRun(runId: string, by: string): Promise<void> {
  await fetch(`${base}/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ by })
  });
}
