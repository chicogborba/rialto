"use client";

import { motion, useReducedMotion } from "motion/react";
import { Slap } from "./Stickers";

const REASONS = [
  { emoji: "🧠", n: "01", title: "Your model is a generalist.", body: "Cracked at reasoning. Mid at meshes, pixels and live data.", tone: "bg-surface text-paper" },
  { emoji: "🛠️", n: "02", title: "Specialists already exist.", body: "Some API out there does that one job way better.", tone: "bg-paper text-ink" },
  { emoji: "💸", n: "03", title: "x402 made them payable.", body: "One HTTP 402, settled in USDC on Solana. No account, no API key dance.", tone: "bg-pay text-ink" },
  { emoji: "🚦", n: "04", title: "Somebody has to pick.", body: "Switchyard scouts, vets, hires and pays. No human in the loop.", tone: "bg-signal text-ink" },
] as const;

/** The pitch, in four cards. */
export function Why() {
  const reduce = useReducedMotion();
  return (
    <section id="why" aria-labelledby="why-title" className="scroll-mt-4 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-28">
        <div className="relative">
          <h2 id="why-title" className="text-[clamp(4.5rem,20vw,18rem)] font-bold uppercase leading-[0.78] tracking-[-0.07em]">
            Why<span className="text-signal">?</span>
          </h2>
          <Slap tone="pay" rotate={7} className="absolute right-0 top-2 md:right-[18%] md:top-8 md:text-base">fr tho 🤔</Slap>
        </div>

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {REASONS.map((r, i) => (
            <motion.li
              key={r.n}
              // transform-only entrance: if the observer never fires the card is still readable
              initial={reduce ? false : { y: 48, rotate: i % 2 ? 4 : -4 }}
              whileInView={{ y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: i * 0.08 }}
              className={`sy-pop relative flex min-h-64 flex-col justify-between border-2 border-ink p-5 shadow-[6px_6px_0_var(--color-line-hi)] ${r.tone}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-sm font-bold opacity-60">{r.n}</span>
                <span aria-hidden className="text-6xl leading-none md:text-7xl">{r.emoji}</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold uppercase leading-[0.95] tracking-tight md:text-3xl">{r.title}</h3>
                <p className="mt-3 text-base font-medium opacity-80">{r.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>

        <p className="mt-12 max-w-4xl text-[clamp(1.6rem,4.2vw,3.6rem)] font-bold uppercase leading-[0.95] tracking-[-0.04em]">
          x402 lets agents <span className="sy-mark-pay">pay</span>. We let them decide <span className="sy-mark">who gets paid</span>.
        </p>
      </div>
    </section>
  );
}
