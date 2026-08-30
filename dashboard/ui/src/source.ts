// Run event sources — a live SSE stream for the dashboard and a timed replay of a capture for the landing page. Same interface.

import type { RunEvent } from "@escrowai/protocol";

export interface RunSource {
  /** Register a listener; returns an unsubscribe function. Replaying a source re-emits from the start. */
  subscribe(onEvent: (event: RunEvent) => void): () => void;
}

export interface DemoCapture {
  timeline: Array<{ t: number; event: RunEvent }>;
  // The summary RunResult is also in the file but the UI derives everything from the timeline.
  [key: string]: unknown;
}

/** Live source — Server-Sent Events from the dashboard's agent server. */
export function createSseSource(url: string): RunSource {
  return {
    subscribe(onEvent) {
      const es = new EventSource(url);
      es.onmessage = (msg) => {
        try {
          onEvent(JSON.parse(msg.data) as RunEvent);
        } catch {
          /* ignore keep-alive / malformed frames */
        }
      };
      return () => es.close();
    }
  };
}

export interface PlayerControls extends RunSource {
  /** (Re)start the replay from t=0. */
  restart(): void;
  /** Playback rate; 1 = the cadence of the real run. */
  setSpeed(speed: number): void;
  /** Cancel all scheduled emissions — call on unmount. */
  stop(): void;
}

/**
 * Demo source — re-emits a captured timeline at its recorded pace (optionally sped up). The
 * gaps between events are what make the run watchable, so they are preserved, just scaled.
 */
export function createPlayerSource(
  capture: DemoCapture,
  opts: { speed?: number; autoStart?: boolean; loopDelayMs?: number } = {}
): PlayerControls {
  let speed = opts.speed ?? 1.4;
  const listeners = new Set<(event: RunEvent) => void>();
  let timers: ReturnType<typeof setTimeout>[] = [];

  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const play = () => {
    clear();
    const entries = capture.timeline;
    const last = entries[entries.length - 1]?.t ?? 0;
    for (const { t, event } of entries) {
      timers.push(
        setTimeout(() => listeners.forEach((l) => l(event)), t / speed)
      );
    }
    if (opts.loopDelayMs != null) {
      timers.push(setTimeout(play, last / speed + opts.loopDelayMs));
    }
  };

  if (opts.autoStart !== false) {
    // Defer so subscribers registered synchronously after creation still catch t≈0 events.
    timers.push(setTimeout(play, 0));
  }

  return {
    subscribe(onEvent) {
      listeners.add(onEvent);
      return () => listeners.delete(onEvent);
    },
    restart: play,
    setSpeed(next) {
      speed = next;
    },
    stop: clear
  };
}
