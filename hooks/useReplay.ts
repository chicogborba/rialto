"use client";

import { useEffect, useReducer, useRef } from "react";
import { initialRunState, reduceRun, type RunState } from "@/lib/agent/reducer";
import type { RunEvent } from "@/lib/agent/events";
import { useReducedMotion } from "motion/react";

interface ReplayOptions {
  /** pause when false (off-screen / hidden tab) */
  active?: boolean;
  /** time multiplier on recorded deltas (<1 = faster) */
  speed?: number;
  loop?: boolean;
  /** hold the finished state this long before looping */
  holdMs?: number;
  /** if true, show the final state immediately and never animate */
  staticFinal?: boolean;
}

type Action = { kind: "event"; event: RunEvent } | { kind: "reset" };
const reducer = (s: RunState, a: Action): RunState =>
  a.kind === "reset" ? initialRunState() : reduceRun(s, a.event);

/** Replays a recorded run client-side with timers. No network. Pauses when `active` is false. */
export function useReplay(events: RunEvent[], opts: ReplayOptions = {}): RunState {
  const { active = true, speed = 0.5, loop = true, holdMs = 4000, staticFinal = false } = opts;
  const reduce = useReducedMotion();
  const [state, dispatch] = useReducer(reducer, undefined, initialRunState);
  const cursor = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finalOnly = staticFinal || reduce === true;

  useEffect(() => {
    if (finalOnly) {
      dispatch({ kind: "reset" });
      for (const event of events) dispatch({ kind: "event", event });
      return;
    }
    if (!active) return;
    const tick = () => {
      const i = cursor.current;
      if (i >= events.length) {
        if (!loop) return;
        timer.current = setTimeout(() => {
          cursor.current = 0;
          dispatch({ kind: "reset" });
          timer.current = setTimeout(tick, 600);
        }, holdMs);
        return;
      }
      dispatch({ kind: "event", event: events[i] });
      cursor.current = i + 1;
      const next = events[i + 1];
      const delay = next ? Math.max(30, (next.ts - events[i].ts) * speed) : 0;
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [events, active, speed, loop, holdMs, finalOnly]);

  return state;
}
