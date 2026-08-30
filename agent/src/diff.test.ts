// Tests for the classification logic — the product judgment about what counts as a silent drop.

import { describe, expect, it } from "vitest";
import { diffScenario } from "./diff.js";
import type { ScenarioRun, StepResult } from "./types.js";
import { normalizeEffects } from "./effects.js";

const ok: StepResult = { label: "deliver", fixtureId: "x", httpStatus: 200, responseBody: {} };

function run(effects: Array<Record<string, unknown>>, steps: StepResult[] = [ok]): ScenarioRun {
  return { scenarioId: "s", title: "S", steps, effects: normalizeEffects(effects) };
}

const credit = { kind: "ledger.credit", accountId: "a1", paymentId: "p1", amount: 4999, currency: "usd" };
const debit = { kind: "ledger.debit", accountId: "a1", paymentId: "p1", amount: 4999, currency: "usd" };
const notify = { kind: "notification.send", accountId: "a1", template: "receipt" };

describe("diffScenario", () => {
  it("is unaffected when effects match exactly", () => {
    const d = diffScenario(run([credit, notify]), run([credit, notify]));
    expect(d.classification).toBe("unaffected");
  });

  it("flags a silent drop when a money-moving effect disappears but every delivery still 200s", () => {
    const d = diffScenario(run([credit, debit]), run([credit]));
    expect(d.classification).toBe("silent-drop");
    expect(d.moneyMoving.droppedCount).toBe(1);
    expect(d.httpMasked).toBe(true);
  });

  it("is behaviour-changed, not silent-drop, when the PR surfaced an error for the dropped effect", () => {
    const failing: StepResult = { ...ok, httpStatus: 500 };
    const d = diffScenario(run([credit, debit]), run([credit], [failing]));
    expect(d.classification).toBe("behavior-changed");
  });

  it("flags a double-process when the PR adds a money-moving effect", () => {
    const d = diffScenario(run([credit]), run([credit, credit]));
    expect(d.classification).toBe("double-process");
    expect(d.moneyMoving.addedCount).toBe(1);
  });

  it("is behaviour-changed when only a non-money effect differs", () => {
    const d = diffScenario(run([credit, notify]), run([credit]));
    expect(d.classification).toBe("behavior-changed");
    expect(d.moneyMoving.droppedCount).toBe(0);
  });

  it("treats duplicate effects as a multiset — one extra credit of two is one added", () => {
    const d = diffScenario(run([credit, credit]), run([credit, credit, credit]));
    expect(d.addedInPr).toHaveLength(1);
    expect(d.classification).toBe("double-process");
  });

  it("treats a dropped refund.issue as a silent drop, not a cosmetic change", () => {
    const refundIssue = { kind: "refund.issue", accountId: "a1", paymentId: "p1", amount: 4999, currency: "usd" };
    const d = diffScenario(run([credit, refundIssue]), run([credit]));
    expect(d.classification).toBe("silent-drop");
    expect(d.moneyMoving.droppedCount).toBe(1);
  });

  it("treats a duplicated refund.issue as a double-process", () => {
    const refundIssue = { kind: "refund.issue", accountId: "a1", paymentId: "p1", amount: 4999, currency: "usd" };
    const d = diffScenario(run([refundIssue]), run([refundIssue, refundIssue]));
    expect(d.classification).toBe("double-process");
  });
});
