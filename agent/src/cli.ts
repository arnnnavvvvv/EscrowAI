// CLI entry — run a scenario end to end, stream progress to the terminal, print the verdict, optionally capture the run.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runReplay } from "./run.js";
import type { RunEvent } from "./events.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Parse `--flag value` and `--flag` pairs. */
function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** One-line renderer for a run event. */
function renderEvent(event: RunEvent): void {
  switch (event.type) {
    case "phase":
      console.log(`\n▸ ${event.message}`);
      break;
    case "progress":
      console.log(`  · ${event.message}`);
      break;
    case "scenario:start":
      console.log(`  [${event.role}] ${event.scenarioId}`);
      break;
    case "step":
      console.log(
        `    ${event.role === "base" ? "base" : "pr  "}  ${event.step.httpStatus}  ${event.step.label}`
      );
      break;
    case "diff": {
      const d = event.diff;
      const mark = d.classification === "unaffected" ? "✓" : d.classification === "behavior-changed" ? "±" : "✗";
      console.log(`  ${mark} ${d.title} — ${d.classification}`);
      break;
    }
    case "verdict":
      console.log(`\n${event.verdict.markdown}\n`);
      break;
    case "error":
      console.error(`  ! ${event.message}`);
      break;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scenarioId = typeof args.scenario === "string" ? args.scenario : "silent-refund-drop";
  const backend =
    args.backend === "docker" || args.backend === "process" ? args.backend : "auto";

  const result = await runReplay({
    targetDir: join(repoRoot, "sample-target"),
    scenarioDir: join(repoRoot, "agent", "scenarios", scenarioId),
    workDir: join(repoRoot, ".escrowai-work", scenarioId),
    backend,
    onEvent: renderEvent
  });

  if (args.capture) {
    const out =
      typeof args.capture === "string"
        ? args.capture
        : join(repoRoot, "demo-data", `${scenarioId}.json`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(result, null, 2));
    console.log(`captured run → ${out}`);
  }

  process.exit(result.verdict.gate === "block" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
