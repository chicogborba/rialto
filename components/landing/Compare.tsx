"use client";

import Image from "next/image";
import { useState } from "react";
import { SegTabs } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { fmtCents, fmtK, fmtUsd, HIRED, IMAGE_HIRED, IMAGE_SOLO, MATCH, SOLO } from "./compare-data";
import { DuoCanvas } from "./DuoCanvas";

type Tab = "3d" | "image";

function Tag({ side, model, price, hired }: { side: string; model: string; price: string; hired?: boolean }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 border-t p-3 md:p-4", hired ? "border-signal bg-signal text-ink" : "border-line bg-surface")}>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{side}</p>
        <p className="truncate text-sm font-bold uppercase md:text-lg">{model}</p>
      </div>
      <p className="tnum font-mono text-3xl font-bold leading-none md:text-5xl">{price}</p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="border-l-2 border-line-hi pl-4">
      <p className={cn("tnum font-mono text-3xl font-bold leading-none md:text-5xl", tone)}>{value}</p>
      <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}

/** What one model can do alone vs. what a hired specialist API delivers — same prompt, real outputs. */
export function Compare() {
  const [tab, setTab] = useState<Tab>("3d");
  const ratio = Math.round(MATCH.costUsd / HIRED.costUsd);

  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-4 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="compare-title" className="text-[clamp(2.6rem,8.5vw,8rem)] font-bold uppercase leading-[0.85] tracking-[-0.05em]">
            Same prompt.<span className="block text-signal">Different league.</span>
          </h2>
          <div className="flex flex-col items-start gap-3">
            <p className="border border-line-hi px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em]"><span className="text-signal">Prompt ▸</span> &ldquo;a robot&rdquo;</p>
            <SegTabs label="Example" value={tab} onChange={setTab} tabs={[{ id: "3d", label: "3D asset" }, { id: "image", label: "Image" }]} />
          </div>
        </div>

        <div role="tabpanel" className="mt-8 border border-line">
          {tab === "3d" ? (
            <>
              <div className="relative h-[46vh] min-h-[300px] bg-[radial-gradient(ellipse_at_center,#1e201b_0%,#0b0c0a_70%)] md:h-[58vh]">
                <DuoCanvas modelUrl={HIRED.url} className="absolute inset-0 size-full" />
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line" />
                <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 bg-ink px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Drag to spin</p>
              </div>
              <div className="grid grid-cols-2">
                <Tag side="In-house · code" model={SOLO.model} price={fmtUsd(SOLO.costUsd)} />
                <Tag side="Hired · API" model={HIRED.model} price={fmtUsd(HIRED.costUsd)} hired />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 bg-white">
                <Image src={IMAGE_SOLO.url} alt="Robot drawn as SVG by Claude Opus 5.5" width={512} height={512} unoptimized loading="eager" className="mx-auto h-auto w-full max-w-[520px]" />
                <Image src={IMAGE_HIRED.url} alt="Robot rendered by an SDXL-class diffusion model" width={512} height={512} loading="eager" className="mx-auto h-auto w-full max-w-[520px] border-l border-black/10" />
              </div>
              <div className="grid grid-cols-2">
                <Tag side="In-house · SVG" model={IMAGE_SOLO.model} price={fmtCents(IMAGE_SOLO.costUsd)} />
                <Tag side="Hired · API" model={IMAGE_HIRED.model} price={fmtCents(IMAGE_HIRED.costUsd)} hired />
              </div>
            </>
          )}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {tab === "3d" ? (
            <>
              <Stat value={`${fmtK(SOLO.triangles)} → ${fmtK(HIRED.triangles)}`} label="Triangles · untextured → PBR" />
              <Stat value={`≈${fmtUsd(MATCH.costUsd)}`} label="To emit that mesh as LLM tokens" tone="text-fail" />
              <Stat value={`~${ratio}×`} label="Cheaper to hire for the same mesh" tone="text-signal" />
            </>
          ) : (
            <>
              <Stat value="Vector" label="In-house: flat shapes, no lighting" />
              <Stat value="Photoreal" label="Hired: materials, reflections, depth" tone="text-signal" />
              <Stat value={`${Math.round(IMAGE_SOLO.costUsd / IMAGE_HIRED.costUsd * 10) / 10}×`} label="Cheaper to hire, too" tone="text-signal" />
            </>
          )}
        </div>

        <p className="mt-8 max-w-5xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-muted">
          Real outputs, not routed through Switchyard. 3D: Meshy-7 from the 3D Arena benchmark (MIT), simplified {fmtK(HIRED.originalTriangles)} → {fmtK(HIRED.triangles)} triangles; {HIRED.credits} API credits ≈ {fmtUsd(HIRED.costUsd)}.
          Image: DreamShaper XL from iso3D (MIT); hosted SDXL ≈ $0.009. In-house: three.js code and SVG written by Claude Opus 5.5 in one pass.
          Token costs are estimates at $20/MTok output, excluding thinking; &ldquo;emit that mesh&rdquo; = geometry as OBJ-style text, no texture.
        </p>
      </div>
    </section>
  );
}
