// Orchestrates one full run: boot the sandbox, replay the scenario's set against both branches, diff, build the verdict.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSandbox, type ScenarioManifest } from "@escrowai/sandbox";
import type { BranchInstance } from "@escrowai/sandbox";
import { replayScenario } from "./replay.js";
import { diffAll } from "./diff.js";
import { buildVerdict } from "./verdict.js";
import type { RunEventHandler } from "./events.js";
import type { RunResult, ScenarioRun } from "./types.js";

export interface RunOptions {
  /** The committed target source directory (e.g. <repo>/sample-target). */
  targetDir: string;
  /** The scenario directory (e.g. <repo>/agent/scenarios/silent-refund-drop). */
  scenarioDir: string;
  /** Scratch directory for the materialised checkouts. */
  workDir: string;
  backend?: "docker" | "process" | "auto";
  onEvent?: RunEventHandler;
}

/** Replay every scenario in the set against one instance, resetting state between scenarios. */
async function replaySet(
  instance: BranchInstance,
  scenarioIds: string[],
  emit: RunEventHandler
): Promise<ScenarioRun[]> {
  const runs: ScenarioRun[] = [];
  for (const scenarioId of scenarioIds) {
    await instance.reset();
    emit({ type: "scenario:start", role: instance.role, scenarioId, title: scenarioId });
    const run = await replayScenario(instance, scenarioId, (step) =>
      emit({ type: "step", role: instance.role, scenarioId, step })
    );
    emit({
      type: "scenario:done",
      role: instance.role,
      scenarioId,
      effectCount: run.effects.length
    });
    runs.push(run);
  }
  return runs;
}

/** Run the whole pipeline and return the structured result. */
export async function runReplay(opts: RunOptions): Promise<RunResult> {
  const emit: RunEventHandler = opts.onEvent ?? (() => {});
  const startedAt = new Date().toISOString();

  const scenario = JSON.parse(
    await readFile(join(opts.scenarioDir, "scenario.json"), "utf8")
  ) as ScenarioManifest;

  emit({ type: "phase", phase: "materialize", message: "Materialising base and PR branches" });
  const sandbox = await createSandbox({
    targetDir: opts.targetDir,
    scenarioDir: opts.scenarioDir,
    workDir: opts.workDir,
    backend: opts.backend ?? "auto",
    onProgress: (message) => emit({ type: "progress", message })
  });

  try {
    emit({ type: "boot", role: "base", status: "healthy", backend: sandbox.backend });
    emit({ type: "boot", role: "pr", status: "healthy", backend: sandbox.backend });

    emit({ type: "phase", phase: "replay", message: "Replaying the fixture library against both branches" });
    const baseRuns = await replaySet(sandbox.base, scenario.replaySet, emit);
    const prRuns = await replaySet(sandbox.pr, scenario.replaySet, emit);

    emit({ type: "phase", phase: "diff", message: "Diffing behaviour per scenario" });
    const diffs = diffAll(baseRuns, prRuns);
    for (const diff of diffs) emit({ type: "diff", diff });

    emit({ type: "phase", phase: "verdict", message: "Assembling the verdict" });
    const verdict = buildVerdict(diffs, {
      title: scenario.title,
      prBranch: scenario.prBranch
    });
    emit({ type: "verdict", verdict });

    emit({ type: "phase", phase: "done", message: verdict.headline });

    return {
      scenarioId: scenario.id,
      title: scenario.title,
      backend: sandbox.backend,
      baseBranch: scenario.baseBranch,
      prBranch: scenario.prBranch,
      runs: { base: baseRuns, pr: prRuns },
      diffs,
      verdict,
      startedAt,
      finishedAt: new Date().toISOString()
    };
  } finally {
    await sandbox.teardown();
  }
}
