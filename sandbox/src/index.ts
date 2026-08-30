// Public entry — materialise the scenario, pick a backend, boot both branches, hand back a Sandbox.

import { rm } from "node:fs/promises";
import { materialize } from "./materialize.js";
import { createProcessSandbox } from "./process-backend.js";
import { createDockerSandbox, dockerAvailable } from "./docker-backend.js";
import type { CreateSandboxOptions, Sandbox } from "./types.js";

export * from "./types.js";
export { dockerAvailable } from "./docker-backend.js";

/**
 * Boot the sandbox for one scenario. Defaults to Docker; falls back to local processes when
 * `backend: "auto"` (the default) and the daemon is down, so development and the demo never
 * hard-block on Docker.
 */
export async function createSandbox(opts: CreateSandboxOptions): Promise<Sandbox> {
  const say = opts.onProgress ?? (() => {});
  const wanted = opts.backend ?? "auto";

  const { scenario, manifest, baseDir, prDir } = await materialize({
    targetDir: opts.targetDir,
    scenarioDir: opts.scenarioDir,
    workDir: opts.workDir,
    onProgress: say
  });

  let backend: "docker" | "process";
  if (wanted === "docker") {
    backend = "docker";
  } else if (wanted === "process") {
    backend = "process";
  } else {
    backend = (await dockerAvailable()) ? "docker" : "process";
    if (backend === "process") {
      say("docker daemon not reachable — using the local process backend");
    }
  }

  const runId = Date.now().toString(36);
  const instances =
    backend === "docker"
      ? await createDockerSandbox({
          baseDir,
          prDir,
          baseBranch: scenario.baseBranch,
          prBranch: scenario.prBranch,
          manifest,
          runId,
          say
        })
      : await createProcessSandbox({
          baseDir,
          prDir,
          baseBranch: scenario.baseBranch,
          prBranch: scenario.prBranch,
          manifest,
          say
        });

  return {
    ...instances,
    backend,
    async teardown() {
      await Promise.allSettled([instances.base.stop(), instances.pr.stop()]);
      await rm(opts.workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}
