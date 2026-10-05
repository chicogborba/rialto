"use client";

import { useEffect, useRef, useState } from "react";
import { describeEvent, familyOf, type EventFamily, type RunEvent } from "@/lib/agent/events";
import { nameOfProvider, type RunState } from "@/lib/agent/reducer";
import { cn } from "@/lib/utils";
import { Label } from "@/components/primitives";

const FAMILY_TONE: Record<EventFamily, string> = {
  plan: "text-paper",
  payment: "text-pay",
  success: "text-signal",
  failure: "text-fail",
  neutral: "text-muted",
};

function clock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`;
}

interface EventLogProps {
  state: RunState;
  variant?: "terminal" | "timeline";
  /** hide noisy event types */
  filter?: (e: RunEvent) => boolean;
  className?: string;
  maxHeightClass?: string;
}

/** Live event stream. Terminal variant for the console, timeline variant for the landing page. */
export function EventLog({ state, variant = "terminal", filter, className, maxHeightClass = "max-h-64" }: EventLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const events = filter ? state.events.filter(filter) : state.events;

  useEffect(() => {
    const el = ref.current;
    if (el && !paused) el.scrollTop = el.scrollHeight;
  }, [events.length, paused]);

  const nameOf = (id: string) => nameOfProvider(state, id);

  return (
    <div className={cn("border border-line bg-ink", className)}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <Label>{variant === "terminal" ? "Live event stream" : "Timeline"}</Label>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-paper"
          aria-pressed={paused}
        >
          {paused ? "Resume scroll" : "Pause scroll"}
        </button>
      </div>
      <div ref={ref} className={cn("overflow-y-auto p-3", maxHeightClass)} role="log" aria-live="polite" aria-label="Agent events">
        {events.length === 0 ? (
          <p className="font-mono text-xs text-muted">{variant === "terminal" ? "> awaiting goal_" : "Waiting for the agent…"}</p>
        ) : (
          <ul className="space-y-1">
            {events.map((e) => (
              <li
                key={e.seq}
                className={cn(
                  "flex gap-3 font-mono text-xs leading-relaxed [animation:sy-in_0.12s_ease-out]",
                  FAMILY_TONE[familyOf(e)],
                )}
              >
                {variant === "timeline" ? (
                  <>
                    <span className="tnum shrink-0 text-muted">{clock(e.ts)}</span>
                    <span className="uppercase tracking-wide">{describeEvent(e, nameOf)}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="shrink-0 text-muted">&gt;</span>
                    <span>{describeEvent(e, nameOf)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
