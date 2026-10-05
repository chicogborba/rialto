"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@/lib/money";
import type { RunState } from "@/lib/agent/reducer";
import { MOTION } from "@/lib/agent/timing";
import { CountUp, Label } from "@/components/primitives";

const W = 720;
const H = 120;
const NODES = [
  { id: "user", x: 70, label: "USER" },
  { id: "wallet", x: 250, label: "AGENT WALLET" },
  { id: "provider", x: 470, label: "PROVIDERS" },
  { id: "result", x: 650, label: "RESULT" },
] as const;

/** USDC moving through the system. Subtle square particles, one per settled payment. */
export function MoneyFlow({ state, startMicro = 10_000_000 }: { state: RunState; startMicro?: number }) {
  const reduce = useReducedMotion();
  const settled = state.events.filter((e) => e.type === "payment.settled");
  const last = settled[settled.length - 1];
  const balance = state.wallet?.balanceMicro ?? startMicro;
  const spent = startMicro - balance;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Money flow: user funds agent wallet, wallet pays providers, providers return a result">
        {NODES.slice(0, -1).map((n, i) => (
          <line key={n.id} x1={n.x + 44} x2={NODES[i + 1].x - 44} y1={60} y2={60} className="stroke-line-hi" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {NODES.map((n) => (
          <g key={n.id} transform={`translate(${n.x - 44}, 36)`}>
            <rect width={88} height={48} className={n.id === "wallet" ? "fill-surface stroke-signal" : "fill-surface stroke-line-hi"} strokeWidth={1} />
            <text x={44} y={28} textAnchor="middle" className="fill-paper font-mono" fontSize={9} letterSpacing={1}>{n.label}</text>
          </g>
        ))}
        <AnimatePresence>
          {last && !reduce && (
            <>
              <motion.rect key={`p-${last.seq}`} width={6} height={6} className="fill-signal" y={57}
                initial={{ x: NODES[1].x + 44, opacity: 0 }} animate={{ x: NODES[2].x - 50, opacity: [0, 1, 1, 0] }}
                transition={{ duration: MOTION.particleSeconds * 1.4, ease: "linear" }} />
              <motion.rect key={`d-${last.seq}`} width={6} height={6} className="fill-data" y={57}
                initial={{ x: NODES[2].x + 44, opacity: 0 }} animate={{ x: NODES[3].x - 50, opacity: [0, 1, 1, 0] }}
                transition={{ duration: MOTION.particleSeconds * 1.4, delay: 0.5, ease: "linear" }} />
            </>
          )}
        </AnimatePresence>
      </svg>
      <dl className="mt-3 grid grid-cols-3 gap-4 font-mono">
        <div><dt><Label>Wallet balance</Label></dt><dd className="tnum text-xl font-bold"><CountUp value={balance} format={(n) => formatUsd(Math.round(n))} /></dd></div>
        <div><dt><Label>Spent</Label></dt><dd className="tnum text-xl font-bold text-pay"><CountUp value={spent} format={(n) => formatUsd(Math.round(n))} /></dd></div>
        <div><dt><Label>Payments</Label></dt><dd className="tnum text-xl font-bold"><CountUp value={settled.length} /></dd></div>
      </dl>
    </div>
  );
}
