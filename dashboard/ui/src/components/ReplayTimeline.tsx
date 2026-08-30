// The payload-by-payload replay timeline — one row per scenario, base and PR lanes, and the diff outcome.

import { useState } from "react";
import type { NormalizedEffect } from "@escrowai/protocol";
import type { ScenarioView } from "../runState.js";
import { Dot, Panel, Pill, classTone } from "./primitives.js";

/** Render one delivery step. */
function Step({ label, httpStatus }: { label: string; httpStatus: number }) {
  const ok = httpStatus < 400;
  return (
    <div className="step">
      <span className="step__code" data-ok={ok}>
        {httpStatus}
      </span>
      <span className="step__label">{label}</span>
    </div>
  );
}

/** One effect on the +/- delta list. */
function DeltaRow({ sign, effect }: { sign: "-" | "+"; effect: NormalizedEffect }) {
  const detail = Object.entries(effect.detail)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return (
    <div className="effect-delta__row" data-sign={sign}>
      <span>{sign}</span>
      <span>{effect.kind}</span>
      <span>{detail}</span>
    </div>
  );
}

function ScenarioBlock({ scenario }: { scenario: ScenarioView }) {
  const finding =
    scenario.diff != null && scenario.diff.classification !== "unaffected";
  const [open, setOpen] = useState(finding);
  const cls = scenario.diff?.classification;

  return (
    <div className="scenario" data-class={cls ?? "pending"}>
      <div className="scenario__head" onClick={() => setOpen((v) => !v)}>
        <span className="scenario__title">{scenario.title}</span>
        <span className="scenario__meta">
          {scenario.status === "replaying" && <Dot live />}
          {cls ? (
            <Pill tone={classTone(cls)}>{cls.replace("-", " ")}</Pill>
          ) : (
            <Pill>{scenario.status}</Pill>
          )}
        </span>
      </div>

      {open && (
        <div className="scenario__body">
          <div className="lane">
            <div className="lane__label">base</div>
            {scenario.base.steps.map((s, i) => (
              <Step key={i} label={s.label} httpStatus={s.httpStatus} />
            ))}
          </div>
          <div className="lane">
            <div className="lane__label">pr</div>
            {scenario.pr.steps.map((s, i) => (
              <Step key={i} label={s.label} httpStatus={s.httpStatus} />
            ))}
          </div>

          {scenario.diff && (
            <>
              <p className="scenario__narrative">{scenario.diff.narrative}</p>
              {(scenario.diff.missingInPr.length > 0 || scenario.diff.addedInPr.length > 0) && (
                <div className="effect-delta">
                  {scenario.diff.missingInPr.map((e, i) => (
                    <DeltaRow key={`m${i}`} sign="-" effect={e} />
                  ))}
                  {scenario.diff.addedInPr.map((e, i) => (
                    <DeltaRow key={`a${i}`} sign="+" effect={e} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ReplayTimeline({ scenarios }: { scenarios: ScenarioView[] }) {
  const done = scenarios.filter((s) => s.status === "diffed").length;
  return (
    <Panel title="Replay timeline" aside={<Pill>{done}/{scenarios.length || "—"}</Pill>}>
      {scenarios.length === 0 ? (
        <p className="scenario__narrative">Scenarios appear here as they replay against both branches.</p>
      ) : (
        <div className="timeline">
          {scenarios.map((s) => (
            <ScenarioBlock key={s.scenarioId} scenario={s} />
          ))}
        </div>
      )}
    </Panel>
  );
}
