// Core types for the replay pipeline — effects observed, per-scenario runs, the diff, and the verdict.

/** One side effect as reported by the target's effect log, normalised for comparison (no timestamp, no seq). */
export interface NormalizedEffect {
  kind: string;
  /** True for `ledger.credit` / `ledger.debit` — the effects whose loss is a silent money drop. */
  moneyMoving: boolean;
  /** Stable signature used for multiset equality between base and PR. */
  signature: string;
  /** The interesting fields, for display. */
  detail: Record<string, unknown>;
}

/** Result of replaying one delivery step against one branch. */
export interface StepResult {
  label: string;
  fixtureId: string;
  httpStatus: number;
  responseBody: unknown;
}

/** Everything one scenario produced against one branch. */
export interface ScenarioRun {
  scenarioId: string;
  title: string;
  steps: StepResult[];
  effects: NormalizedEffect[];
}

export type Classification =
  | "unaffected"
  | "behavior-changed"
  | "silent-drop"
  | "double-process";

/** The comparison of one scenario's base run against its PR run. */
export interface ScenarioDiff {
  scenarioId: string;
  title: string;
  classification: Classification;
  baseEffects: NormalizedEffect[];
  prEffects: NormalizedEffect[];
  /** Effects present in base but missing in PR (multiset difference). */
  missingInPr: NormalizedEffect[];
  /** Effects present in PR but not in base. */
  addedInPr: NormalizedEffect[];
  moneyMoving: { droppedCount: number; addedCount: number };
  /** PR returned a 2xx for every step despite dropping/adding an effect — the failure is invisible at the HTTP layer. */
  httpMasked: boolean;
  /** One deterministic sentence describing the change. */
  narrative: string;
}

/** The final call on the PR. */
export interface Verdict {
  gate: "block" | "pass";
  headline: string;
  /** Scenarios whose behaviour changed. */
  findings: ScenarioDiff[];
  /** All scenario diffs, including unaffected ones. */
  all: ScenarioDiff[];
  /** The PR comment body. */
  markdown: string;
}

/** The full output of one EscrowAI run — what the dashboard renders and what gets captured to demo-data. */
export interface RunResult {
  scenarioId: string;
  title: string;
  backend: "docker" | "process";
  baseBranch: string;
  prBranch: string;
  runs: { base: ScenarioRun[]; pr: ScenarioRun[] };
  diffs: ScenarioDiff[];
  verdict: Verdict;
  startedAt: string;
  finishedAt: string;
}
