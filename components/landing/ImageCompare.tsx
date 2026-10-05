"use client";

import Image from "next/image";
import { useState } from "react";
import { fmtCents, IMAGE_HIRED, IMAGE_SOLO } from "./compare-data";
import { Emoji, Slap } from "./Stickers";

const times = Math.round((IMAGE_SOLO.costUsd / IMAGE_HIRED.costUsd) * 10) / 10;

/** Image: drag the handle to wipe between the SVG a language model wrote and a diffusion API's render. */
export function ImageCompare() {
  const [pct, setPct] = useState(50);

  return (
    <section id="image" aria-labelledby="image-title" className="section-light scroll-mt-4 border-t border-ink/20">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-16 md:px-10 md:py-24 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em]">Exhibit B · image</p>
          <h2 id="image-title" className="mt-3 text-[clamp(2.6rem,8vw,7rem)] font-bold uppercase leading-[0.84] tracking-[-0.05em]">
            Pixels?<span className="block"><span className="sy-mark-pay">Not its job.</span></span>
          </h2>
          <p className="mt-6 max-w-sm text-xl font-medium">An LLM draws with code. A diffusion model draws with light. Slide it. 👉</p>

          <dl className="mt-8 grid max-w-md grid-cols-2 gap-4">
            <div className="border-2 border-ink bg-paper p-4">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">In-house · SVG</dt>
              <dd className="tnum font-mono text-4xl font-bold">{fmtCents(IMAGE_SOLO.costUsd)}</dd>
            </div>
            <div className="border-2 border-ink bg-signal p-4 shadow-[5px_5px_0_var(--color-ink)]">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Hired · API</dt>
              <dd className="tnum font-mono text-4xl font-bold">{fmtCents(IMAGE_HIRED.costUsd)}</dd>
            </div>
          </dl>
          <p className="mt-5 text-2xl font-bold uppercase tracking-tight">
            Better <span className="sy-mark">and</span> ~{times}× cheaper.
          </p>
        </div>

        <div className="lg:col-span-7">
          <div className="relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden border-2 border-ink bg-white shadow-[10px_10px_0_var(--color-ink)]">
            <Image src={IMAGE_HIRED.url} alt="Photoreal robot rendered by a diffusion image model" fill sizes="(min-width: 1024px) 640px, 100vw" loading="eager" className="object-contain" draggable={false} />
            <div className="absolute inset-0 bg-white" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
              <Image src={IMAGE_SOLO.url} alt="Flat vector robot written as SVG by Claude Opus 5.5" fill unoptimized loading="eager" className="object-contain" draggable={false} />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-ink" style={{ left: `${pct}%` }}>
              <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-signal font-mono text-lg font-bold text-ink shadow-[3px_3px_0_var(--color-ink)]">⇆</span>
            </div>
            <Emoji label="Yikes" tone="fail" rotate={-10} className="pointer-events-none absolute left-3 top-3">🤮</Emoji>
            <Emoji label="Chef's kiss" tone="signal" rotate={10} delay={0.5} className="pointer-events-none absolute right-3 top-3">🤩</Emoji>
            <Slap tone="paper" rotate={-4} className="pointer-events-none absolute bottom-3 left-3">{IMAGE_SOLO.model}</Slap>
            <Slap tone="signal" rotate={3} delay={0.4} className="pointer-events-none absolute bottom-3 right-3">{IMAGE_HIRED.kind}</Slap>
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-label="Reveal: left is the in-house SVG, right is the hired API image"
              className="absolute inset-0 size-full cursor-ew-resize opacity-0"
            />
          </div>
          <p className="mx-auto mt-5 max-w-[640px] font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-ink/60">
            Real outputs, not routed through Switchyard. Right: DreamShaper XL (SDXL-class) from the iso3D dataset (MIT); price is hosted SDXL on a public API (0.9 credits ≈ $0.009).
            Left: SVG written by {IMAGE_SOLO.model} in one pass ({IMAGE_SOLO.outputTokens.toLocaleString("en-US")} output tokens, est. at $20/MTok, excl. thinking).
          </p>
        </div>
      </div>
    </section>
  );
}
