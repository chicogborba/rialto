"use client";

import { useEffect, useState } from "react";
import { heroReady } from "@/lib/client/boot";
import { Buddy } from "./Buddy";
import { HIRED } from "./compare-data";

/** Longest we keep the page covered: a slow connection should still get in. */
const MAX_WAIT_MS = 8000;
const TASKS = 4;

/**
 * Covers the page until the 3D is actually ready: hero scene on screen, fonts in, and the comparison
 * model and its code already downloaded, so nothing pops in while you scroll.
 */
export function Preloader() {
  const [done, setDone] = useState(0);
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");

  useEffect(() => {
    const tasks: Promise<unknown>[] = [
      heroReady,
      document.fonts.ready,
      fetch(HIRED.url).then((r) => r.arrayBuffer()),
      import("./scene/DuoScene"),
    ].map((task) => task.catch(() => undefined));
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setDone(TASKS);
      setPhase("leaving");
      document.documentElement.style.overflow = "";
      setTimeout(() => setPhase("gone"), 450);
    };
    document.documentElement.style.overflow = "hidden";
    tasks.forEach((task) => task.then(() => setDone((n) => Math.min(TASKS, n + 1))));
    Promise.all(tasks).then(finish);
    const timer = setTimeout(finish, MAX_WAIT_MS);
    return () => {
      clearTimeout(timer);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      id="sy-preload"
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-cream transition-opacity duration-500"
      style={{ opacity: phase === "leaving" ? 0 : 1, pointerEvents: phase === "leaving" ? "none" : "auto" }}
    >
      <Buddy mood="happy" className="w-28 md:w-36" />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-coal/60">Opening the market…</p>
      <div className="h-3 w-56 border-2 border-coal md:w-72">
        <div className="h-full origin-left bg-coal transition-transform duration-300" style={{ transform: `scaleX(${Math.max(0.06, done / TASKS)})` }} />
      </div>
      <noscript>
        <style>{"#sy-preload{display:none}"}</style>
      </noscript>
    </div>
  );
}
