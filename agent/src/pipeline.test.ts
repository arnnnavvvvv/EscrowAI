// End-to-end test of the replay pipeline against the seeded scenario, using the process backend so it runs without Docker.

import { describe, expect, it } from "vitest";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { runReplay } from "./run.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("runReplay — silent-refund-drop scenario", () => {
  it("blocks the merge and pins the silent drop to the Stripe refund path", async () => {
    const workDir = join(tmpdir(), `escrowai-pipeline-${Date.now().toString(36)}`);
    try {
      const result = await runReplay({
        targetDir: join(repoRoot, "sample-target"),
        scenarioDir: join(repoRoot, "agent", "scenarios", "silent-refund-drop"),
        workDir,
        backend: "process"
      });

      expect(result.verdict.gate).toBe("block");
      expect(result.backend).toBe("process");

      const blocking = result.diffs.filter(
        (d) => d.classification === "silent-drop" || d.classification === "double-process"
      );
      expect(blocking.length).toBeGreaterThan(0);
      expect(blocking.every((d) => d.classification === "silent-drop")).toBe(true);

      // The refund scenarios lose a ledger.debit; the duplicate/retry scenarios are untouched.
      const ordered = result.diffs.find((d) => d.scenarioId === "ordered-lifecycle");
      expect(ordered?.classification).toBe("silent-drop");
      expect(ordered?.missingInPr.some((e) => e.kind === "ledger.debit")).toBe(true);

      const duplicate = result.diffs.find((d) => d.scenarioId === "duplicate-delivery");
      expect(duplicate?.classification).toBe("unaffected");
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 60_000);
});
