"use client";

import { useEffect, useState } from "react";
import { useActive } from "@/hooks/useActive";
import { Slap } from "./Stickers";

const SLOT_MS = 400; // Solana's target slot time

function Fact({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="border-2 border-ink bg-surface p-5 shadow-[6px_6px_0_var(--color-sol-a)]">
      <p className="tnum font-mono text-4xl font-bold leading-none md:text-6xl">{value}</p>
      <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}

/** Why the payment rail is Solana: machine-speed blocks and fees small enough for per-call pricing. */
export function Solana() {
  const { ref, active } = useActive<HTMLDivElement>();
  const [slots, setSlots] = useState(0);

  // count slots only while the section is on screen
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSlots((n) => n + 1), SLOT_MS);
    return () => clearInterval(id);
  }, [active]);

  return (
    <section id="solana" aria-labelledby="solana-title" className="scroll-mt-4 overflow-hidden border-t border-line">
      <div ref={ref} className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-28">
        <div className="flex flex-wrap items-center gap-4">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-sol-b">Built for Solana ◎</p>
          <Slap tone="paper" rotate={-3} still>ridiculously fast, actually</Slap>
        </div>
        <h2 id="solana-title" className="mt-4 text-[clamp(3rem,11vw,10.5rem)] font-bold uppercase leading-[0.82] tracking-[-0.06em]">
          Machines<br />don&apos;t wait.
          <span className="sy-sol-text block">Solana doesn&apos;t either.</span>
        </h2>

        {/* the race */}
        <div className="mt-12 grid gap-4 font-mono">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-4 text-xs font-bold uppercase tracking-[0.12em]">
              <span>◎ Solana block</span>
              <span className="tnum text-sol-b" aria-live="off">{slots.toLocaleString("en-US")} blocks since you scrolled here</span>
            </div>
            <div className="h-8 border-2 border-ink bg-surface md:h-10">
              <div className="sy-block-fill sy-sol-bg h-full" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-4 text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <span>💳 Card settlement</span>
              <span>still pending… days</span>
            </div>
            <div className="h-8 border-2 border-ink bg-surface md:h-10">
              <div className="h-full w-[1.5%] bg-line-hi" />
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Fact value={<>~400<span className="text-2xl md:text-3xl"> ms</span></>} label="Per block. Faster than your agent can blink." />
          <Fact value={<>5,000<span className="text-2xl md:text-3xl"> lamports</span></>} label="Base fee per signature. A fraction of a cent." />
          <Fact value="USDC" label="Dollar-native settlement. No volatility in the invoice." />
        </div>

        <p className="mt-12 max-w-5xl text-[clamp(1.5rem,3.8vw,3.2rem)] font-bold uppercase leading-[0.98] tracking-[-0.04em]">
          A <span className="sy-mark">$0.012</span> API call can&apos;t ride card rails — the fee is bigger than the bill. On Solana it <span className="sy-sol-text">just clears</span>. ⚡
        </p>
        <p className="mt-6 max-w-3xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-muted">
          Rialto routes x402 payments in USDC on Solana. This demo build targets Solana devnet and simulates settlement (see the SIMULATED badge); the live rail is the next milestone.
          Card comparison assumes typical processing of ~2.9% + $0.30 per charge.
        </p>
      </div>
    </section>
  );
}
