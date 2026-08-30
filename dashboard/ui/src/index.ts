// Public surface of the shared UI package.

export { RunView, type RunViewProps } from "./components/RunView.js";
export { RunHeader } from "./components/RunHeader.js";
export { Branches } from "./components/Branches.js";
export { ActivityFeed } from "./components/ActivityFeed.js";
export { ReplayTimeline } from "./components/ReplayTimeline.js";
export { VerdictCard } from "./components/Verdict.js";
export * from "./components/primitives.js";

export {
  applyEvent,
  reduceRun,
  initialRunState,
  type RunViewModel,
  type ScenarioView,
  type ActivityLine,
  type GateState
} from "./runState.js";
export { useRunModel } from "./useRunModel.js";
export {
  createSseSource,
  createPlayerSource,
  type RunSource,
  type PlayerControls,
  type DemoCapture
} from "./source.js";
