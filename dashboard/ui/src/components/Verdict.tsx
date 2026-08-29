// The verdict card and the approval action — the assembled call on the PR plus the human gate.

import { useState } from "react";
import type { ScenarioDiff } from "@escrowai/protocol";
import type { RunViewModel } from "../runState.js";
import { Pill, classTone } from "./primitives.js";

function Finding({ diff }: { diff: ScenarioDiff }) {
  return (
    <div className="finding" data-class={diff.classification}>
      <div className="finding__title">
        {diff.title} <Pill tone={classTone(diff.classification)}>{diff.classification.replace("-", " ")}</Pill>
      </div>
      <p className="finding__text">{diff.narrative}</p>
    </div>
  );
}

/** The approval control — a button while blocked, a confirmation once approved. */
function Approval({
  gate,
  approvedBy,
  onApprove
}: {
  gate: RunViewModel["gate"];
  approvedBy: string | null;
  onApprove?: () => void;
}) {
  const [pending, setPending] = useState(false);
  if (gate !== "block" && gate !== "approved") return null;

  return (
    <div className="approval">
      <p className="approval__copy">
        {gate === "approved"
          ? "The replay diff was reviewed and the money-moving change was accepted deliberately."
          : "Merge is held. Review the dropped effects above, then release the hold if this change is intended."}
      </p>
      {gate === "approved" ? (
        <span className="approval__done">✓ approved by {approvedBy ?? "reviewer"}</span>
      ) : (
        <button
          className="btn"
          disabled={pending || !onApprove}
          onClick={() => {
            setPending(true);
            onApprove?.();
          }}
        >
          {pending ? "releasing…" : "Approve & release merge"}
        </button>
      )}
    </div>
  );
}

export function VerdictCard({
  model,
  onApprove
}: {
  model: RunViewModel;
  onApprove?: () => void;
}) {
  const { verdict } = model;
  if (!verdict) return null;

  const gate = model.gate === "approved" ? "approved" : verdict.gate;
  const mark = verdict.gate === "block" ? "✕" : "✓";

  return (
    <div className="verdict" data-gate={gate}>
      <div className="verdict__banner">
        <span className="verdict__mark">{mark}</span>
        <div>
          <h2 className="verdict__headline">{verdict.headline}</h2>
          <p className="verdict__sub">
            {verdict.all.length} scenarios replayed ·{" "}
            {verdict.findings.length === 0
              ? "no behaviour change"
              : `${verdict.findings.length} changed`}
          </p>
        </div>
      </div>

      {verdict.findings.length > 0 && (
        <div className="verdict__body">
          {verdict.findings.map((f) => (
            <Finding key={f.scenarioId} diff={f} />
          ))}
        </div>
      )}

      <Approval gate={model.gate} approvedBy={model.approvedBy} onApprove={onApprove} />
    </div>
  );
}
