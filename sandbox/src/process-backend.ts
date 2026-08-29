// Process backend — boots each branch as a local `node` process. Used for development and as the Docker fallback.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BranchInstance, TargetManifest } from "./types.js";
import { freePort, waitForHealth } from "./net.js";

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
      env: { ...process.env, PORT: String(port), EFFECTS_LOG_PATH: effectsLog },
      stdio: "ignore",
      windowsHide: true
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(baseUrl + manifest.health);
    say(`${role}: healthy`);
    return { baseUrl };
  };

  const stop = async (): Promise<void> => {
    if (!child) return;
    const dead = new Promise<void>((resolve) => child?.once("exit", () => resolve()));
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

/** Boot both branches as processes. */
export async function createProcessSandbox(args: {
  baseDir: string;
  prDir: string;
  baseBranch: string;
  prBranch: string;
  manifest: TargetManifest;
  say: (line: string) => void;
}) {
  const base = await bootInstance("base", args.baseBranch, args.baseDir, args.manifest, args.say);
  const pr = await bootInstance("pr", args.prBranch, args.prDir, args.manifest, args.say);
  return { base, pr };
}
