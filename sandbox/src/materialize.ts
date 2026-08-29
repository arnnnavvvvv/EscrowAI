// Turns the committed target source + a scenario patch into a real two-branch git checkout the backends can boot.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScenarioManifest, TargetManifest } from "./types.js";

const run = promisify(execFile);

/** Run a git command in a given directory. */
async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, windowsHide: true });
  return stdout.trim();
}

export interface Materialized {
  scenario: ScenarioManifest;
  /** Working tree checked out at the base branch, with its own manifest. */
  baseDir: string;
  baseManifest: TargetManifest;
  /** Working tree checked out at the PR branch (patch applied), with its own manifest. */
  prDir: string;
  prManifest: TargetManifest;
}

/** Read and parse a target's `.escrowai.json`. */
async function readManifest(dir: string): Promise<TargetManifest> {
  return JSON.parse(await readFile(join(dir, ".escrowai.json"), "utf8")) as TargetManifest;
}

/**
 * Copy the target into `workDir/repo`, commit it as the base branch, branch off, apply the
 * scenario patch, and expose both as separate working trees via `git worktree`.
 */
export async function materialize(opts: {
  targetDir: string;
  scenarioDir: string;
  workDir: string;
  onProgress?: (line: string) => void;
}): Promise<Materialized> {
  const { targetDir, scenarioDir, workDir, onProgress } = opts;
  const say = onProgress ?? (() => {});

  const scenario = JSON.parse(
    await readFile(join(scenarioDir, "scenario.json"), "utf8")
  ) as ScenarioManifest;

  await rm(workDir, { recursive: true, force: true });
  const repoDir = join(workDir, "repo");
  await mkdir(repoDir, { recursive: true });

  say("copying target source");
  await cp(targetDir, repoDir, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|\.git)[/\\]/.test(src + "/")
  });

  say(`initialising git repo, committing ${scenario.baseBranch}`);
  await git(repoDir, "init", "-q", "-b", scenario.baseBranch);
  await git(repoDir, "config", "user.email", "sandbox@escrowai.local");
  await git(repoDir, "config", "user.name", "EscrowAI Sandbox");
  await git(repoDir, "add", "-A");
  await git(repoDir, "commit", "-q", "-m", "target: base");

  say(`branching ${scenario.prBranch}, applying scenario patch`);
  await git(repoDir, "checkout", "-q", "-b", scenario.prBranch);
  const patch = await readFile(join(scenarioDir, scenario.patch), "utf8");
  const patchInRepo = join(repoDir, ".escrowai-scenario.patch");
  await writeFile(patchInRepo, patch);
  await git(repoDir, "apply", "--whitespace=nowarn", ".escrowai-scenario.patch");
  await rm(patchInRepo);
  await git(repoDir, "add", "-A");
  await git(repoDir, "commit", "-q", "-m", `pr: ${scenario.title}`);
  // Detach the primary worktree so both branches are free to be checked out as separate worktrees.
  await git(repoDir, "checkout", "-q", "--detach");

  const baseDir = join(workDir, "base");
  const prDir = join(workDir, "pr");
  say("checking out base and PR working trees");
  await git(repoDir, "worktree", "add", "-q", baseDir, scenario.baseBranch);
  await git(repoDir, "worktree", "add", "-q", prDir, scenario.prBranch);

  // Read each manifest from its own worktree — a PR is allowed to change ports, routes, or endpoints.
  const [baseManifest, prManifest] = await Promise.all([readManifest(baseDir), readManifest(prDir)]);

  return { scenario, baseDir, baseManifest, prDir, prManifest };
}
