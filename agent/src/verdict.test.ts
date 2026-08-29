// Tests for verdict assembly — the gate decision and that the comment leads with the undeniable failure.

import { describe, expect, it } from "vitest";
import { buildVerdict } from "./verdict.js";
import type { ScenarioDiff } from "./types.js";

function diff(overrides: Partial<ScenarioDiff>): ScenarioDiff {
  return {
    scenarioId: "s",
    title: "Scenario",
    classification: "unaffected",
    baseEffects: [],
    prEffects: [],
    missingInPr: [],
    addedInPr: [],
    moneyMoving: { droppedCount: 0, addedCount: 0 },
    httpMasked: true,
    narrative: "n",
    ...overrides
  };
}

const ctx = { title: "Refactor routing", prBranch: "pr/x" };

describe("buildVerdict", () => {
  it("passes when nothing changed", () => {
    const v = buildVerdict([diff({}), diff({})], ctx);
    expect(v.gate).toBe("pass");
  });

  it("blocks on a silent-drop finding", () => {
    const v = buildVerdict(
      [diff({ classification: "silent-drop", title: "Refund path", narrative: "stopped debiting" })],
      ctx
    );
    expect(v.gate).toBe("block");
    expect(v.markdown).toContain("Refund path");
    expect(v.markdown).toContain("blocking this merge");
  });

  it("blocks on a double-process finding", () => {
    const v = buildVerdict([diff({ classification: "double-process" })], ctx);
    expect(v.gate).toBe("block");
  });

  it("does not block on a non-money behaviour change", () => {
    const v = buildVerdict([diff({ classification: "behavior-changed" })], ctx);
    expect(v.gate).toBe("pass");
    expect(v.markdown).toContain("Also changed (not blocking)");
  });

  it("only counts findings, not unaffected scenarios, in the headline", () => {
    const v = buildVerdict(
      [diff({ classification: "silent-drop" }), diff({}), diff({})],
      ctx
    );
    expect(v.headline).toContain("1 payment behaviour");
    expect(v.findings).toHaveLength(1);
  });
});
