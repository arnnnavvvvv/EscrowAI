// Process backend — boots each branch as a local `node` process. Used for development and as the Docker fallback.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BranchInstance, TargetManifest } from "./types.js";
import { freePort, waitForHealth } from "./net.js";

/**
 * A deliberately minimal environment for the target process. The process backend runs
 * PR-controlled code on the host, so it must not inherit the parent env (which can hold
 * GITHUB_TOKEN / GROQ_API_KEY and other secrets). Only what Node needs to run plus the two
 * variables the target reads.
 */
function sandboxEnv(port: number, effectsLog: string): NodeJS.ProcessEnv {
  const passthrough: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "Path", "SystemRoot", "windir", "HOME", "TEMP", "TMP", "TMPDIR"]) {
    if (process.env[key] != null) passthrough[key] = process.env[key];
  }
  return { ...passthrough, PORT: String(port), EFFECTS_LOG_PATH: effectsLog, NODE_ENV: "test" };
}

/** Boot one branch working tree as a node process on a fresh port. */
async function bootInstance(
  role: "base" | "pr",
  branch: string,
  dir: string,
  manifest: TargetManifest,
  say: (line: string) => void
): Promise<BranchInstance> {
  let child: ChildProcess | undefined;
  let effectsLog = "";

  const start = async (): Promise<{ baseUrl: string }> => {
    const port = await freePort();
    effectsLog = join(await mkdtemp(join(tmpdir(), "escrowai-effects-")), "effects.log");
    say(`${role}: starting node process on :${port}`);
    child = spawn(process.execPath, ["src/server.js"], {
      cwd: dir,
      env: sandboxEnv(port, effectsLog),
      stdio: "ignore",
      windowsHide: true
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      await waitForHealth(baseUrl + manifest.health);
    } catch (err) {
      await stop();
      throw err;
    }
    say(`${role}: healthy`);
    return { baseUrl };
  };

  const stop = async (): Promise<void> => {
    if (!child) return;
    const dead = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      child?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    child.kill("SIGKILL");
    await dead;
    child = undefined;
    await rm(effectsLog, { force: true }).catch(() => {});
  };

  let { baseUrl } = await start();

  return {
    role,
    branch,
    get baseUrl() {
      return baseUrl;
    },
    manifest,
    async reset() {
      await stop();
      ({ baseUrl } = await start());
    },
    stop
  };
}

/** Boot both branches as processes; stop the base instance if the PR instance fails to come up. */
export async function createProcessSandbox(args: {
  baseDir: string;
  baseManifest: TargetManifest;
  prDir: string;
  prManifest: TargetManifest;
  baseBranch: string;
  prBranch: string;
  say: (line: string) => void;
}) {
  const base = await bootInstance("base", args.baseBranch, args.baseDir, args.baseManifest, args.say);
  try {
    const pr = await bootInstance("pr", args.prBranch, args.prDir, args.prManifest, args.say);
    return { base, pr };
  } catch (err) {
    await base.stop();
    throw err;
  }
}
