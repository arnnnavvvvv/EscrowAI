// Shared types for sandbox orchestration — a running branch instance and the sandbox that owns both.

/** The target manifest (`.escrowai.json`) that tells us how to boot a target and where to observe it. */
export interface TargetManifest {
  name: string;
  language: string;
  dockerfile: string;
  port: number;
  health: string;
  effectsEndpoint: string;
  stateEndpoint: string;
  failInjectionEndpoint: string;
  routes: { stripe: string; razorpay: string };
  webhookPaths: string[];
}

/** One booted copy of the target — either the base branch or the PR branch. */
export interface BranchInstance {
  /** "base" or "pr". */
  role: "base" | "pr";
  /** Branch name in the materialised repo. */
  branch: string;
  /** Root URL, e.g. http://127.0.0.1:41xxx. */
  baseUrl: string;
  manifest: TargetManifest;
  /** Restart the instance to clear all in-memory state between scenarios. */
  reset(): Promise<void>;
  /** Stop this instance. */
  stop(): Promise<void>;
}

/** Both branches booted and ready to replay against. */
export interface Sandbox {
  base: BranchInstance;
  pr: BranchInstance;
  /** Which backend actually ran the instances. */
  backend: "docker" | "process";
  /** Stop both instances and clean up the workdir. */
  teardown(): Promise<void>;
}

/** What `agent/scenarios/<id>/scenario.json` contains. */
export interface ScenarioManifest {
  id: string;
  title: string;
  prBranch: string;
  baseBranch: string;
  patch: string;
  touchedPaths: string[];
  prDescription: string;
  replaySet: string[];
  expectedFinding: {
    verdict: "block" | "pass";
    silentDrops: string[];
    summary: string;
  };
}

export interface CreateSandboxOptions {
  /** Path to the target source (the committed `sample-target/`). */
  targetDir: string;
  /** Path to the scenario directory holding scenario.json + the patch. */
  scenarioDir: string;
  /** Where to materialise the two checkouts. Cleaned on teardown. */
  workDir: string;
  /** Force a backend; defaults to docker with a process fallback when the daemon is down. */
  backend?: "docker" | "process" | "auto";
  /** Called with human-readable progress lines for the dashboard activity feed. */
  onProgress?: (line: string) => void;
}
