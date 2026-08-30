// Compares a scenario's base run against its PR run and classifies the change.

import type { Classification, ScenarioDiff, ScenarioRun } from "./types.js";
import { effectsMissingFrom } from "./effects.js";

/** True if every replayed step against the PR returned a non-error status. */
function allStepsAccepted(prRun: ScenarioRun): boolean {
  return prRun.steps.every((s) => s.httpStatus >= 200 && s.httpStatus < 400);
}

/** Build the one-sentence deterministic narrative for a diff. */
function narrate(
  classification: Classification,
  missing: ScenarioDiff["missingInPr"],
  added: ScenarioDiff["addedInPr"]
): string {
  switch (classification) {
    case "unaffected":
      return "Both branches produced the same effects, in the same order.";
    case "silent-drop": {
      const kinds = [...new Set(missing.filter((e) => e.moneyMoving).map((e) => e.kind))];
      return `The PR still accepted every delivery but stopped producing ${kinds.join(
        " and "
      )} — money that used to move no longer does, with no error surfaced.`;
    }
    case "double-process": {
      const kinds = [...new Set(added.filter((e) => e.moneyMoving).map((e) => e.kind))];
      return `The PR produced extra ${kinds.join(
        " and "
      )} the base branch did not — the same event now moves money more than once.`;
    }
    case "behavior-changed":
      return `The PR's effects differ from the base branch (${missing.length} dropped, ${added.length} added) but no money-moving effect was lost or duplicated.`;
  }
}

/** Diff one scenario. */
export function diffScenario(base: ScenarioRun, pr: ScenarioRun): ScenarioDiff {
  const missingInPr = effectsMissingFrom(base.effects, pr.effects);
  const addedInPr = effectsMissingFrom(pr.effects, base.effects);

  const droppedCount = missingInPr.filter((e) => e.moneyMoving).length;
  const addedCount = addedInPr.filter((e) => e.moneyMoving).length;
  const httpMasked = allStepsAccepted(pr);

  let classification: Classification;
  if (missingInPr.length === 0 && addedInPr.length === 0) {
    classification = "unaffected";
  } else if (droppedCount > 0 && httpMasked) {
    classification = "silent-drop";
  } else if (addedCount > 0) {
    classification = "double-process";
  } else {
    classification = "behavior-changed";
  }

  return {
    scenarioId: base.scenarioId,
    title: base.title,
    classification,
    baseEffects: base.effects,
    prEffects: pr.effects,
    missingInPr,
    addedInPr,
    moneyMoving: { droppedCount, addedCount },
    httpMasked,
    narrative: narrate(classification, missingInPr, addedInPr)
  };
}

/** Diff a whole replay set — base and PR arrays are aligned by scenario id. */
export function diffAll(baseRuns: ScenarioRun[], prRuns: ScenarioRun[]): ScenarioDiff[] {
  return baseRuns.map((baseRun) => {
    const prRun = prRuns.find((r) => r.scenarioId === baseRun.scenarioId);
    if (!prRun) throw new Error(`No PR run for scenario ${baseRun.scenarioId}`);
    return diffScenario(baseRun, prRun);
  });
}
