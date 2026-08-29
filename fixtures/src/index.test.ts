// Sanity checks on the fixture catalog — every payload loads, ids are unique, scenarios reference real fixtures.

import { describe, expect, it } from "vitest";
import { fixtures, getFixture, deliveryScenarios } from "./index.js";

describe("fixture catalog", () => {
  it("covers succeeded / failed / refunded for both providers", () => {
    const seen = fixtures.map((f) => `${f.provider}.${f.category}`).sort();
    expect(seen).toEqual([
      "razorpay.failed",
      "razorpay.refunded",
      "razorpay.succeeded",
      "stripe.failed",
      "stripe.refunded",
      "stripe.succeeded"
    ]);
  });

  it("has unique ids", () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("loads a non-empty JSON body for every fixture", () => {
    for (const fixture of fixtures) {
      expect(fixture.body).toBeTypeOf("object");
      expect(JSON.stringify(fixture.body).length).toBeGreaterThan(50);
    }
  });

  it("marks every money-moving effect on succeeded and refunded events", () => {
    for (const fixture of fixtures) {
      const hasMoneyEffect = fixture.expectedEffects.some((e) => e.moneyMoving);
      if (fixture.category === "failed") {
        expect(hasMoneyEffect).toBe(false);
      } else {
        expect(hasMoneyEffect).toBe(true);
      }
    }
  });
});

describe("delivery scenarios", () => {
  it("reference only known fixture ids", () => {
    for (const scenario of deliveryScenarios) {
      for (const step of scenario.steps) {
        expect(() => getFixture(step.fixtureId)).not.toThrow();
      }
    }
  });

  it("each scenario states an expectation", () => {
    for (const scenario of deliveryScenarios) {
      expect(scenario.expectation.length).toBeGreaterThan(20);
    }
  });
});
