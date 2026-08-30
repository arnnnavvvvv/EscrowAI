// Docker backend — builds an image per branch and runs each in its own container. The real isolation path.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BranchInstance, TargetManifest } from "./types.js";
import { freePort, waitForHealth } from "./net.js";

const run = promisify(execFile);

/** True if the Docker daemon is reachable. */
export async function dockerAvailable(): Promise<boolean> {
  try {
    await run("docker", ["info", "--format", "{{.ServerVersion}}"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** docker CLI wrapper. */
async function docker(...args: string[]): Promise<string> {
  const { stdout } = await run("docker", args, { windowsHide: true, maxBuffer: 1024 * 1024 * 16 });
  return stdout.trim();
}

/** Build the image, run the container, wait for health. */
async function bootInstance(
  role: "base" | "pr",
  branch: string,
  dir: string,
  manifest: TargetManifest,
  runId: string,
  say: (line: string) => void
): Promise<BranchInstance> {
  const image = `escrowai/${manifest.name}-${role}:${runId}`;
  const container = `escrowai-${manifest.name}-${role}-${runId}`;

  say(`${role}: docker build`);
  await docker("build", "-q", "-t", image, "-f", `${dir}/${manifest.dockerfile}`, dir);

  let hostPort = 0;
  const start = async (): Promise<string> => {
    hostPort = await freePort();
    say(`${role}: docker run → :${hostPort}`);
    await docker(
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "-p",
      `127.0.0.1:${hostPort}:${manifest.port}`,
      image
    );
    const baseUrl = `http://127.0.0.1:${hostPort}`;
    try {
      await waitForHealth(baseUrl + manifest.health);
    } catch (err) {
      await stop();
      throw err;
    }
    say(`${role}: healthy`);
    return baseUrl;
  };

  const stop = async (): Promise<void> => {
    await docker("rm", "-f", container).catch(() => {});
    await docker("rmi", "-f", image).catch(() => {});
  };

  let baseUrl = await start();

  return {
    role,
    branch,
    get baseUrl() {
      return baseUrl;
    },
    manifest,
    async reset() {
      await docker("rm", "-f", container).catch(() => {});
      baseUrl = await start();
    },
    stop
  };
}

/** Build and run both branches as containers; tear down the base instance if the PR instance fails. */
export async function createDockerSandbox(args: {
  baseDir: string;
  baseManifest: TargetManifest;
  prDir: string;
  prManifest: TargetManifest;
  baseBranch: string;
  prBranch: string;
  runId: string;
  say: (line: string) => void;
}) {
  const base = await bootInstance(
    "base",
    args.baseBranch,
    args.baseDir,
    args.baseManifest,
    args.runId,
    args.say
  );
  try {
    const pr = await bootInstance(
      "pr",
      args.prBranch,
      args.prDir,
      args.prManifest,
      args.runId,
      args.say
    );
    return { base, pr };
  } catch (err) {
    await base.stop();
    throw err;
  }
}
