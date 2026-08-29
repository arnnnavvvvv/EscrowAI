// The run header — scenario title, the branch pair, execution backend, and the phase tracker.

import { Fragment } from "react";
import type { RunViewModel } from "../runState.js";
import { GradientText, Pill } from "./primitives.js";

const PHASES: Array<{ id: string; label: string }> = [
  { id: "materialize", label: "materialise" },
  { id: "replay", label: "replay" },
  { id: "diff", label: "diff" },
  { id: "verdict", label: "verdict" },
  { id: "done", label: "done" }
];

/** Which visual state a phase chip is in given the current phase. */
function phaseState(current: string, index: number): "todo" | "active" | "done" {
  const currentIndex = PHASES.findIndex((p) => p.id === current);
  if (currentIndex < 0) return "todo";
  if (index < currentIndex) return "done";
  if (index === currentIndex) return current === "done" ? "done" : "active";
  return "todo";
}

export function RunHeader({
  model,
  title,
  baseBranch,
  prBranch
}: {
  model: RunViewModel;
  title: string;
  baseBranch: string;
  prBranch: string;
}) {
  return (
    <div className="run-header">
      <div className="run-header__row">
        <h1 className="run-header__title">
          <GradientText>EscrowAI</GradientText> replay
        </h1>
        {model.backend && <Pill tone="accent">{model.backend} sandbox</Pill>}
        {model.gate === "block" && <Pill tone="drop">merge held</Pill>}
        {model.gate === "approved" && <Pill tone="accent">merge released</Pill>}
        {model.gate === "pass" && model.finished && <Pill tone="pass">clear to merge</Pill>}
      </div>

      <div className="run-header__branch">
        {title} · <b>{prBranch}</b> <span aria-hidden>→</span> {baseBranch}
      </div>

      <div className="phase-track" aria-label="run progress">
        {PHASES.map((phase, i) => (
          <Fragment key={phase.id}>
            {i > 0 && <span className="phase-track__sep" />}
            <span className="phase-track__step" data-state={phaseState(model.phase, i)}>
              {phase.label}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
