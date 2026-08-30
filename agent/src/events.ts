// The run event stream — one shape emitted through the whole pipeline, consumed live by the dashboard and captured to demo-data.

import type { ScenarioDiff, StepResult, Verdict } from "./types.js";

export type RunEvent =
  | { type: "phase"; phase: string; message: string }
  | { type: "progress"; message: string }
  | { type: "boot"; role: "base" | "pr"; status: "starting" | "healthy"; backend: string }
  | { type: "scenario:start"; role: "base" | "pr"; scenarioId: string; title: string }
  | { type: "step"; role: "base" | "pr"; scenarioId: string; step: StepResult }
  | { type: "scenario:done"; role: "base" | "pr"; scenarioId: string; effectCount: number }
  | { type: "diff"; diff: ScenarioDiff }
  | { type: "verdict"; verdict: Verdict }
  | { type: "error"; message: string };

export type RunEventHandler = (event: RunEvent) => void;
