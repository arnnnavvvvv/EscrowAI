// Hook — subscribes to a RunSource and folds its events into the RunViewModel the components render.

import { useEffect, useReducer } from "react";
import type { RunEvent } from "@escrowai/protocol";
import { applyEvent, initialRunState, type RunViewModel } from "./runState.js";
import type { RunSource } from "./source.js";

/** Subscribe to a source and keep the folded view model in state. Re-subscribes if the source identity changes. */
export function useRunModel(source: RunSource | null): RunViewModel {
  const [state, dispatch] = useReducer(
    (s: RunViewModel, e: RunEvent | "reset") => (e === "reset" ? initialRunState : applyEvent(s, e)),
    initialRunState
  );

  useEffect(() => {
    if (!source) return;
    dispatch("reset");
    return source.subscribe((event) => dispatch(event));
  }, [source]);

  return state;
}
