// Folds the agent's RunEvent stream into the view model every component renders from. Pure — the same events always produce the same state.

import type {
  RunEvent,
  ScenarioDiff,
  StepResult,
  Verdict
} from "@escrowai/protocol";

export type BranchStatus = "idle" | "booting" | "healthy";
export type ScenarioStatus = "pending" | "replaying" | "diffed";
export type GateState = "pending" | "block" | "pass" | "approved";

export interface ActivityLine {
  id: number;
  kind: "phase" | "progress" | "boot" | "step" | "diff" | "verdict" | "gate" | "error";
  text: string;
  role?: "base" | "pr";
  tone?: "neutral" | "pass" | "drop" | "changed" | "accent";
}

export interface StepView extends StepResult {
  role: "base" | "pr";
}

export interface ScenarioView {
  scenarioId: string;
  title: string;
  status: ScenarioStatus;
  base: { steps: StepView[]; effectCount: number | null; done: boolean };
  pr: { steps: StepView[]; effectCount: number | null; done: boolean };
  diff: ScenarioDiff | null;
}

export interface RunViewModel {
  meta: { scenarioId: string; title: string; baseBranch: string; prBranch: string } | null;
  phase: string;
  backend: string | null;
  branches: { base: BranchStatus; pr: BranchStatus };
  scenarios: ScenarioView[];
  activity: ActivityLine[];
  verdict: Verdict | null;
  gate: GateState;
  approvedBy: string | null;
  finished: boolean;
}

export const initialRunState: RunViewModel = {
  meta: null,
  phase: "idle",
  backend: null,
  branches: { base: "idle", pr: "idle" },
  scenarios: [],
  activity: [],
  verdict: null,
  gate: "pending",
  approvedBy: null,
  finished: false
};

let activitySeq = 0;

/** Append a line to the activity feed, keeping the most recent 200. */
function pushActivity(
  state: RunViewModel,
  line: Omit<ActivityLine, "id">
): ActivityLine[] {
  activitySeq += 1;
  const next = [...state.activity, { ...line, id: activitySeq }];
  return next.slice(-200);
}

/** Find or create the scenario view for an id. */
function upsertScenario(
  scenarios: ScenarioView[],
  scenarioId: string,
  title: string
): ScenarioView[] {
  if (scenarios.some((s) => s.scenarioId === scenarioId)) return scenarios;
  return [
    ...scenarios,
    {
      scenarioId,
      title,
      status: "pending",
      base: { steps: [], effectCount: null, done: false },
      pr: { steps: [], effectCount: null, done: false },
      diff: null
    }
  ];
}

/** Map a step's HTTP status to an activity tone. */
function stepTone(status: number): ActivityLine["tone"] {
  return status >= 500 ? "drop" : "neutral";
}

/** Apply one event to the view model. */
export function applyEvent(state: RunViewModel, event: RunEvent): RunViewModel {
  switch (event.type) {
    case "meta":
      return {
        ...state,
        meta: {
          scenarioId: event.scenarioId,
          title: event.title,
          baseBranch: event.baseBranch,
          prBranch: event.prBranch
        }
      };

    case "phase":
      return {
        ...state,
        phase: event.phase,
        finished: event.phase === "done",
        activity: pushActivity(state, { kind: "phase", text: event.message, tone: "accent" })
      };

    case "progress":
      return {
        ...state,
        activity: pushActivity(state, { kind: "progress", text: event.message })
      };

    case "boot":
      return {
        ...state,
        backend: event.backend,
        branches: { ...state.branches, [event.role]: event.status === "healthy" ? "healthy" : "booting" },
        activity: pushActivity(state, {
          kind: "boot",
          role: event.role,
          text:
            event.status === "healthy"
              ? `${event.role} branch is live (${event.backend})`
              : `${event.role} branch booting`,
          tone: event.status === "healthy" ? "pass" : "neutral"
        })
      };

    case "scenario:start": {
      const scenarios = upsertScenario(state.scenarios, event.scenarioId, event.title).map((s) =>
        s.scenarioId === event.scenarioId ? { ...s, status: "replaying" as ScenarioStatus } : s
      );
      return { ...state, scenarios };
    }

    case "step": {
      const scenarios = state.scenarios.map((s) => {
        if (s.scenarioId !== event.scenarioId) return s;
        const branch = s[event.role];
        return {
          ...s,
          [event.role]: { ...branch, steps: [...branch.steps, { ...event.step, role: event.role }] }
        };
      });
      return {
        ...state,
        scenarios,
        activity: pushActivity(state, {
          kind: "step",
          role: event.role,
          text: `${event.step.label} → ${event.step.httpStatus}`,
          tone: stepTone(event.step.httpStatus)
        })
      };
    }

    case "scenario:done": {
      const scenarios = state.scenarios.map((s) =>
        s.scenarioId === event.scenarioId
          ? { ...s, [event.role]: { ...s[event.role], effectCount: event.effectCount, done: true } }
          : s
      );
      return { ...state, scenarios };
    }

    case "diff": {
      const scenarios = state.scenarios.map((s) =>
        s.scenarioId === event.diff.scenarioId
          ? { ...s, status: "diffed" as ScenarioStatus, diff: event.diff }
          : s
      );
      const tone: ActivityLine["tone"] =
        event.diff.classification === "unaffected"
          ? "pass"
          : event.diff.classification === "behavior-changed"
            ? "changed"
            : "drop";
      return {
        ...state,
        scenarios,
        activity: pushActivity(state, {
          kind: "diff",
          text: `${event.diff.title} — ${event.diff.classification.replace("-", " ")}`,
          tone
        })
      };
    }

    case "verdict":
      return {
        ...state,
        verdict: event.verdict,
        gate: event.verdict.gate,
        activity: pushActivity(state, {
          kind: "verdict",
          text: event.verdict.headline,
          tone: event.verdict.gate === "block" ? "drop" : "pass"
        })
      };

    case "awaiting-approval":
      return {
        ...state,
        gate: "block",
        activity: pushActivity(state, {
          kind: "gate",
          text: "Merge held — waiting for a human to review the replay diff",
          tone: "drop"
        })
      };

    case "approved":
      return {
        ...state,
        gate: "approved",
        approvedBy: event.by,
        activity: pushActivity(state, {
          kind: "gate",
          text: `Approved by ${event.by} — merge released`,
          tone: "accent"
        })
      };

    case "error":
      return {
        ...state,
        activity: pushActivity(state, { kind: "error", text: event.message, tone: "drop" })
      };

    default:
      return state;
  }
}

/** Fold a whole event list — used by the demo player and tests. */
export function reduceRun(events: RunEvent[]): RunViewModel {
  return events.reduce(applyEvent, initialRunState);
}
