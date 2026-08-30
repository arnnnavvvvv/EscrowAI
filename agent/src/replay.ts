// Replays one delivery scenario against one booted branch instance and returns the ordered effects it produced.

import { deliveryScenarios, getFixture } from "@escrowai/fixtures";
import type { BranchInstance } from "@escrowai/sandbox";
import type { ScenarioRun, StepResult } from "./types.js";
import { normalizeEffects } from "./effects.js";

/** Shallow-merge overrides onto a copy of the fixture body. */
function applyOverrides(body: unknown, overrides?: Record<string, unknown>): unknown {
  if (!overrides) return body;
  return { ...(body as Record<string, unknown>), ...overrides };
}

/** POST one fixture to the right route for its provider. */
async function deliver(
  instance: BranchInstance,
  fixtureId: string,
  bodyOverrides?: Record<string, unknown>,
  headerOverrides?: Record<string, string>
): Promise<{ httpStatus: number; responseBody: unknown }> {
  const fixture = getFixture(fixtureId);
  const route =
    fixture.provider === "stripe"
      ? instance.manifest.routes.stripe
      : instance.manifest.routes.razorpay;

  const res = await fetch(instance.baseUrl + route, {
    method: "POST",
    headers: { ...fixture.headers, ...headerOverrides },
    body: JSON.stringify(applyOverrides(fixture.body, bodyOverrides))
  });
  const text = await res.text();
  let responseBody: unknown = text;
  try {
    responseBody = JSON.parse(text);
  } catch {
    /* keep the raw text */
  }
  return { httpStatus: res.status, responseBody };
}

/** Tell the target to fail its next N webhook deliveries, to model a provider retry. */
async function armFailure(instance: BranchInstance, count: number): Promise<void> {
  await fetch(instance.baseUrl + instance.manifest.failInjectionEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count })
  });
}

/** Read the target's ordered effect log. */
async function readEffects(instance: BranchInstance): Promise<unknown> {
  const res = await fetch(instance.baseUrl + instance.manifest.effectsEndpoint);
  const json = (await res.json()) as { effects?: unknown };
  return json.effects ?? [];
}

/**
 * Run every step of a scenario against one instance, then read the effect log. The instance
 * is expected to have been `reset()` beforehand so state is clean.
 */
export async function replayScenario(
  instance: BranchInstance,
  scenarioId: string,
  onStep?: (step: StepResult) => void
): Promise<ScenarioRun> {
  const scenario = deliveryScenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  const record = (s: StepResult) => {
    steps.push(s);
    onStep?.(s);
  };

  const steps: StepResult[] = [];
  for (const step of scenario.steps) {
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));

    if (step.failFirstAttempts) {
      // Arm the failures, then deliver repeatedly until one gets through, as a provider would retry.
      await armFailure(instance, step.failFirstAttempts);
      let attempt = 0;
      let result = await deliver(instance, step.fixtureId, step.bodyOverrides, step.headerOverrides);
      while (result.httpStatus >= 500 && attempt < step.failFirstAttempts + 2) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 50));
        result = await deliver(instance, step.fixtureId, step.bodyOverrides, step.headerOverrides);
      }
      record({ label: step.label, fixtureId: step.fixtureId, ...result });
      continue;
    }

    const result = await deliver(instance, step.fixtureId, step.bodyOverrides, step.headerOverrides);
    record({ label: step.label, fixtureId: step.fixtureId, ...result });
  }

  const effects = normalizeEffects(await readEffects(instance));
  return { scenarioId: scenario.id, title: scenario.title, steps, effects };
}
