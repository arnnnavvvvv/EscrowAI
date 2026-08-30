// The live activity feed — every phase, boot, delivery, and diff line as it happens.

import { useEffect, useRef } from "react";
import type { ActivityLine, RunViewModel } from "../runState.js";
import { Dot, Panel } from "./primitives.js";

/** Short gutter tag for a feed line. */
function gutter(line: ActivityLine): string {
  if (line.role) return line.role;
  return { phase: "»", progress: "·", diff: "Δ", verdict: "✦", gate: "⊘", boot: "○", step: "·", error: "!" }[line.kind];
}

export function ActivityFeed({ model }: { model: RunViewModel }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [model.activity.length]);

  const live = !model.finished && model.activity.length > 0;

  return (
    <Panel title="Activity" aside={<Dot tone="accent" live={live} />}>
      <div className="feed" ref={scroller}>
        {model.activity.length === 0 && (
          <div className="feed__line">
            <span className="feed__gutter">·</span>
            <span className="feed__text">waiting for the run to start…</span>
          </div>
        )}
        {model.activity.map((line) => (
          <div className="feed__line" key={line.id} data-role={line.role ?? undefined}>
            <span className="feed__gutter">{gutter(line)}</span>
            <span className="feed__text" data-tone={line.tone ?? "neutral"}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
