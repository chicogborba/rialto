import { cn } from "@/lib/utils";
import { fmtK, fmtUsd, HIRED, MATCH, SOLO } from "./compare-data";
import { DuoCanvas } from "./DuoCanvas";
import { Emoji, Slap } from "./Stickers";

function Tag({ side, model, price, hired }: { side: string; model: string; price: string; hired?: boolean }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 border-t-2 border-ink p-3 md:p-5", hired ? "bg-signal text-ink" : "bg-surface")}>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{side}</p>
        <p className="truncate text-sm font-bold uppercase md:text-xl">{model}</p>
      </div>
      <p className="tnum font-mono text-3xl font-bold leading-none md:text-6xl">{price}</p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="border-l-4 border-line-hi pl-4">
      <p className={cn("tnum font-mono text-3xl font-bold leading-none md:text-5xl", tone)}>{value}</p>
      <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}

const ratio = Math.round(MATCH.costUsd / HIRED.costUsd);

/** 3D: the robot a language model wrote as code vs. the one a 3D API generated. Same prompt, real outputs. */
export function Compare() {
  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-4 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-24">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-signal">Exhibit A · 3D asset</p>
        <h2 id="compare-title" className="mt-3 text-[clamp(2.6rem,9vw,8.5rem)] font-bold uppercase leading-[0.84] tracking-[-0.05em]">
          Same prompt.<span className="block"><span className="sy-mark">Different league.</span></span>
        </h2>
        <p className="mt-6 inline-block border border-line-hi px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em]"><span className="text-signal">Prompt ▸</span> &ldquo;a robot&rdquo;</p>

        <div className="relative mt-8 border-2 border-ink shadow-[8px_8px_0_var(--color-line-hi)]">
          <div className="relative h-[48vh] min-h-[320px] bg-[radial-gradient(ellipse_at_center,#23261f_0%,#0b0c0a_72%)] md:h-[62vh]">
            <DuoCanvas modelUrl={HIRED.url} className="absolute inset-0 size-full" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-ink" />
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-paper font-mono text-lg font-bold text-ink md:size-20 md:text-2xl">VS</span>
            <Emoji label="Yikes" tone="fail" rotate={-12} className="absolute left-3 top-3 md:left-8 md:top-8">🤮</Emoji>
            <Emoji label="Chef's kiss" tone="signal" rotate={10} delay={0.6} className="absolute right-3 top-3 md:right-8 md:top-8">🤩</Emoji>
            <Slap tone="paper" rotate={-5} delay={0.3} className="absolute bottom-4 left-3 md:left-8">bro tried</Slap>
            <Slap tone="signal" rotate={4} delay={0.9} className="absolute bottom-4 right-3 md:right-8">ate ✨ no crumbs</Slap>
            <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">drag to spin</p>
          </div>
          <div className="grid grid-cols-2">
            <Tag side="In-house · code" model={SOLO.model} price={fmtUsd(SOLO.costUsd)} />
            <Tag side="Hired · API" model={HIRED.model} price={fmtUsd(HIRED.costUsd)} hired />
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Stat value={`${fmtK(SOLO.triangles)} → ${fmtK(HIRED.triangles)}`} label="Triangles · untextured → PBR" />
          <Stat value={`≈${fmtUsd(MATCH.costUsd)}`} label="To spit that mesh out as LLM tokens" tone="text-fail" />
          <Stat value={`~${ratio}×`} label="Cheaper to just hire it" tone="text-signal" />
        </div>

        <p className="mt-8 max-w-5xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-muted">
          Real outputs, not routed through Rialto. Right: Meshy-7 from the 3D Arena benchmark (MIT), simplified {fmtK(HIRED.originalTriangles)} → {fmtK(HIRED.triangles)} triangles; {HIRED.credits} API credits ≈ {fmtUsd(HIRED.costUsd)}.
          Left: three.js code written by {SOLO.model} in one pass ({SOLO.outputTokens.toLocaleString("en-US")} output tokens).
          Token costs are estimates at $20/MTok output, excluding thinking; the cheap in-house number buys the left robot, not the right one. &ldquo;Spit that mesh out&rdquo; = geometry as OBJ-style text, no texture.
        </p>
      </div>
    </section>
  );
}
