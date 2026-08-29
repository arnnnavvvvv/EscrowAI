// Tests for the run-state reducer — the same events must always fold to the same view model.

import { describe, expect, it } from "vitest";
import type { RunEvent, ScenarioDiff } from "@escrowai/protocol";
import { applyEvent, initialRunState, reduceRun } from "./runState.js";

const meta: RunEvent = {
  type: "meta",
  scenarioId: "s",
  title: "Refactor",
  baseBranch: "main",
  prBranch: "pr/x",
  replaySet: ["a"]
};

const drop: ScenarioDiff = {
  scenarioId: "a",
  title: "Ordered lifecycle",
  classification: "silent-drop",
  baseEffects: [],
  prEffects: [],
  missingInPr: [],
  addedInPr: [],
  moneyMoving: { droppedCount: 1, addedCount: 0 },
  httpMasked: true,
  narrative: "stopped debiting"
};

describe("runState reducer", () => {
  it("captures meta", () => {
    const s = applyEvent(initialRunState, meta);
    expect(s.meta?.prBranch).toBe("pr/x");
  });

  it("tracks branch boot status", () => {
    let s = applyEvent(initialRunState, { type: "boot", role: "base", status: "starting", backend: "auto" });
    expect(s.branches.base).toBe("booting");
    s = applyEvent(s, { type: "boot", role: "base", status: "healthy", backend: "docker" });
    expect(s.branches.base).toBe("healthy");
    expect(s.backend).toBe("docker");
  });

  it("builds a scenario view from start → step → done → diff", () => {
    const events: RunEvent[] = [
      { type: "scenario:start", role: "base", scenarioId: "a", title: "Ordered lifecycle" },
      {
        type: "step",
        role: "base",
        scenarioId: "a",
        step: { label: "capture", fixtureId: "stripe.succeeded", httpStatus: 200, responseBody: {} }
      },
      { type: "scenario:done", role: "base", scenarioId: "a", effectCount: 2 },
      { type: "diff", diff: drop }
    ];
    const s = reduceRun(events);
    const scenario = s.scenarios[0]!;
    expect(scenario.base.steps).toHaveLength(1);
    expect(scenario.base.effectCount).toBe(2);
    expect(scenario.status).toBe("diffed");
    expect(scenario.diff?.classification).toBe("silent-drop");
  });

  it("moves the gate through block → approved", () => {
    let s = reduceRun([
      { type: "verdict", verdict: { gate: "block", headline: "blocked", findings: [drop], all: [drop], markdown: "" } }
    ]);
    expect(s.gate).toBe("block");
    s = applyEvent(s, { type: "awaiting-approval", scenarioId: "a" });
    expect(s.gate).toBe("block");
    s = applyEvent(s, { type: "approved", scenarioId: "a", by: "arnav" });
    expect(s.gate).toBe("approved");
    expect(s.approvedBy).toBe("arnav");
  });

  it("marks finished on the done phase", () => {
    const s = applyEvent(initialRunState, { type: "phase", phase: "done", message: "done" });
    expect(s.finished).toBe(true);
  });
});
