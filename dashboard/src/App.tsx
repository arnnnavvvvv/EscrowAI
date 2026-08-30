// The dashboard — start a real replay run and, when it blocks, release the merge hold.

import { useEffect, useMemo, useState } from "react";
import { RunView, useRunModel, GradientText, type RunSource } from "@escrowai/ui";
import { approveRun, listScenarios, runSource, startRun } from "./agentClient.js";

type Phase = { kind: "idle" } | { kind: "starting" } | { kind: "running"; runId: string };

export function App() {
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [selected, setSelected] = useState("silent-refund-drop");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listScenarios()
      .then((list) => {
        setScenarios(list);
        if (list.length && !list.includes(selected)) setSelected(list[0]!);
      })
      .catch(() => setError("Agent server is not reachable on :4600. Run `npm run agent:server`."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const source: RunSource | null = useMemo(
    () => (phase.kind === "running" ? runSource(phase.runId) : null),
    [phase]
  );
  const model = useRunModel(source);

  async function begin() {
    setError(null);
    setPhase({ kind: "starting" });
    try {
      const runId = await startRun(selected);
      setPhase({ kind: "running", runId });
    } catch {
      setError("Could not start the run — is the agent server up?");
      setPhase({ kind: "idle" });
    }
  }

  async function approve() {
    if (phase.kind !== "running") return;
    setError(null);
    try {
      await approveRun(phase.runId, "you");
    } catch {
      setError("Could not release the merge hold — the agent server may have stopped.");
      throw new Error("approval failed");
    }
  }

  if (phase.kind === "running") {
    return (
      <div className="dash">
        {error && <p className="dash__error">{error}</p>}
        <RunView model={model} onApprove={approve} />
      </div>
    );
  }

  return (
    <div className="dash dash--start">
      <div className="start">
        <h1 className="start__title">
          <GradientText>Escrow</GradientText>AI
        </h1>
        <p className="start__lede">
          Replay the webhook fixture library against a pull request in an isolated sandbox and
          gate the merge on anything that would silently stop moving money.
        </p>

        <label className="start__field">
          <span>scenario</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {(scenarios.length ? scenarios : [selected]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <button className="btn start__go" onClick={begin} disabled={phase.kind === "starting"}>
          {phase.kind === "starting" ? "starting…" : "Start replay"}
        </button>

        {error && <p className="start__error">{error}</p>}
      </div>
    </div>
  );
}
