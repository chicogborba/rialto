"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialRunState, reduceRun, type RunState } from "@/lib/agent/reducer";
import type { RunEvent } from "@/lib/agent/events";
import { emitDataChanged } from "@/lib/client/data-events";
import { SseParser } from "@/lib/client/sse";
import type { MicroUsdc, PriorityPreset, Weights } from "@/lib/types";

export interface StartRunInput {
  goal: string;
  budgetMicro?: MicroUsdc;
  preset?: PriorityPreset;
  weights?: Weights;
  speed?: number;
  ephemeral?: boolean;
}

type Action = { kind: "event"; event: RunEvent } | { kind: "reset" } | { kind: "fail"; message: string };

function reducer(state: RunState, action: Action): RunState {
  switch (action.kind) {
    case "reset":
      return initialRunState();
    case "event":
      return reduceRun(state, action.event);
    case "fail":
      return {
        ...state,
        status: "failed",
        error: { message: action.message },
      };
  }
}

/** Starts a run (POST /api/runs) and folds the SSE stream into RunState. */
export function useAgentRun(): { state: RunState; start: (input: StartRunInput) => Promise<void>; reset: () => void } {
  const [state, dispatch] = useReducer(reducer, undefined, initialRunState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ kind: "reset" });
  }, []);

  const start = useCallback(async (input: StartRunInput) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ kind: "reset" });
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        const message = detail && typeof detail.error === "string" ? detail.error : `HTTP ${res.status}`;
        dispatch({ kind: "fail", message: message === "invalid_body" ? "Invalid input" : message });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          dispatch({ kind: "event", event });
          if (event.type === "run.completed" || event.type === "run.failed") emitDataChanged();
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      dispatch({ kind: "fail", message: e instanceof Error ? e.message : "stream failed" });
    }
  }, []);

  return { state, start, reset };
}
