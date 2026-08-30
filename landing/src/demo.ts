// Loads the recorded run that powers the demo-mode replay — captured locally with `npm run replay:sample -- --capture`.

import capture from "../../demo-data/silent-refund-drop.json";
import type { RunResult } from "@escrowai/protocol";
import type { DemoCapture } from "@escrowai/ui";

const typed = capture as unknown as { result: RunResult; timeline: DemoCapture["timeline"] };

export const demoResult = typed.result;
export const demoCapture: DemoCapture = { timeline: typed.timeline };
