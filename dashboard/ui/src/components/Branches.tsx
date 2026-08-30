// The two containers booting — base and PR side by side, each showing its boot state.

import type { BranchStatus, RunViewModel } from "../runState.js";
import { Dot } from "./primitives.js";

const STATUS_LABEL: Record<BranchStatus, string> = {
  idle: "queued",
  booting: "booting sandbox",
  healthy: "live"
};

function BranchCard({
  role,
  branch,
  status
}: {
  role: "base" | "pr";
  branch: string;
  status: BranchStatus;
}) {
  return (
    <div className="branch-card" data-status={status}>
      <span className="branch-card__role">{role} branch</span>
      <span className="branch-card__name">{branch}</span>
      <span className="branch-card__status">
        <Dot tone={status === "healthy" ? "accent" : "neutral"} live={status === "booting"} />
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

export function Branches({
  model,
  baseBranch,
  prBranch
}: {
  model: RunViewModel;
  baseBranch: string;
  prBranch: string;
}) {
  return (
    <div className="branches">
      <BranchCard role="base" branch={baseBranch} status={model.branches.base} />
      <BranchCard role="pr" branch={prBranch} status={model.branches.pr} />
    </div>
  );
}
