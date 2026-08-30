// The demo-mode replay — the exact shared RunView the local dashboard uses, fed the recorded run instead of a live one.

import { useEffect, useState } from "react";
import { RunView, useRunModel, createPlayerSource, type PlayerControls } from "@escrowai/ui";
import { demoCapture, demoResult } from "./demo.js";

export function DemoRun() {
  const [runNo, setRunNo] = useState(0);
  const [source, setSource] = useState<PlayerControls | null>(null);

  useEffect(() => {
    // Recreate on each cycle (via runNo) so the reduced view state resets to empty before replaying.
    let restartTimer: ReturnType<typeof setTimeout>;
    const player = createPlayerSource(demoCapture, {
      speed: 1.6,
      onEnd: () => {
        restartTimer = setTimeout(() => setRunNo((n) => n + 1), 6000);
      }
    });
    setSource(player);
    return () => {
      clearTimeout(restartTimer);
      player.stop();
    };
  }, [runNo]);

  const model = useRunModel(source);

  return (
    <div className="demo">
      <div className="demo__bar">
        <span className="demo__tag">demo mode — recorded run, same UI as the live dashboard</span>
        <button className="demo__restart" onClick={() => setRunNo((n) => n + 1)}>
          ↻ replay
        </button>
      </div>
      <RunView
        model={model}
        title={demoResult.title}
        baseBranch={demoResult.baseBranch}
        prBranch={demoResult.prBranch}
      />
    </div>
  );
}
