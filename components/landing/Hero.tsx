"use client";

import Link from "next/link";
import { useReplay } from "@/hooks/useReplay";
import { useActive } from "@/hooks/useActive";
import { hardButtonClass, Sticker } from "@/components/primitives";
import { ExecutionGraph } from "@/components/visualizations/ExecutionGraph";
import { RECORDED_VISION_RUN } from "./data";

export function Hero() {
  const { ref, active } = useActive<HTMLDivElement>();
  const state = useReplay(RECORDED_VISION_RUN, { active, speed: 0.5, holdMs: 3500 });
  return (
    <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-14 pt-8 md:px-8 lg:grid-cols-12 lg:pt-16">
      <div className="lg:col-span-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal">01 / GOAL</p>
        <h1 id="hero-title" className="mt-4 text-[clamp(2.6rem,8.2vw,8rem)] font-bold uppercase leading-[0.88] tracking-[-0.045em]">
          Agents don&apos;t need APIs.
          <br />
          <span className="text-signal">They need capabilities.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-snug text-paper/80 md:text-xl">
          An autonomous procurement layer for AI agents. Discover, evaluate, purchase and compose machine-readable services over x402.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#demo" className={hardButtonClass("primary", "lg")}>Run the agent</a>
          <Link href="/app/marketplace" className={hardButtonClass("ghost", "lg")}>Explore the exchange</Link>
          <Sticker tone="pay" className="ml-2">Simulated payments</Sticker>
        </div>
        <p className="mt-6 max-w-xl font-mono text-xs text-muted">
          x402 lets agents pay. Switchyard lets them decide who gets paid.
        </p>
      </div>
      <div ref={ref} className="lg:col-span-5" aria-label="Live agent decision graph (recorded simulation)">
        <div className="border border-line bg-surface p-2">
          <div className="mb-1 flex items-center justify-between px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <span>Recorded simulation · loops</span>
            <span className="sy-pulse text-signal">● live replay</span>
          </div>
          <ExecutionGraph state={state} compact />
        </div>
      </div>
    </section>
  );
}
