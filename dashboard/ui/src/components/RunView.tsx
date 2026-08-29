// Composes the whole run view — the single component both the dashboard and the landing page render.

import "../styles/tokens.css";
import "../styles/ui.css";

import type { RunViewModel } from "../runState.js";
import { RunHeader } from "./RunHeader.js";
import { Branches } from "./Branches.js";
import { ActivityFeed } from "./ActivityFeed.js";
import { ReplayTimeline } from "./ReplayTimeline.js";
import { VerdictCard } from "./Verdict.js";

export interface RunViewProps {
  model: RunViewModel;
  /** Fallbacks used before the run's `meta` event arrives. */
  title?: string;
  baseBranch?: string;
  prBranch?: string;
  /** Called when the reviewer releases the merge hold. Omit on read-only surfaces (landing demo). */
  onApprove?: () => void;
}

export function RunView({ model, title, baseBranch, prBranch, onApprove }: RunViewProps) {
  const t = model.meta?.title ?? title ?? "Replay";
  const base = model.meta?.baseBranch ?? baseBranch ?? "base";
  const pr = model.meta?.prBranch ?? prBranch ?? "pr";

  return (
    <div className="run-view">
      <div className="run-view__main">
        <RunHeader model={model} title={t} baseBranch={base} prBranch={pr} />
        <Branches model={model} baseBranch={base} prBranch={pr} />
        <ReplayTimeline scenarios={model.scenarios} />
        <VerdictCard model={model} onApprove={onApprove} />
      </div>
      <aside className="run-view__aside">
        <ActivityFeed model={model} />
      </aside>
    </div>
  );
}
