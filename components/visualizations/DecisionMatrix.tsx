"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@/lib/money";
import { MOTION } from "@/lib/agent/timing";
import { DIMENSION_LABELS } from "@/lib/routing/weights";
import type { NormalizedScores, ScoredCandidate, Weights } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Label } from "@/components/primitives";

const DIMS = ["price", "quality", "latency", "trust"] as const;

function Segments({ value, selected }: { value: number; selected: boolean }) {
  const filled = Math.max(1, Math.round(value * 10));
  return (
    <div className="flex gap-px" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={cn("h-3 flex-1", i < filled ? (selected ? "bg-signal" : "bg-paper/70") : "bg-line")} />
      ))}
    </div>
  );
}

function valueLabel(n: NormalizedScores, d: (typeof DIMS)[number]): string {
  return `${DIMENSION_LABELS[d]} ${Math.round(n[d] * 100)}%`;
}

interface DecisionMatrixProps {
  scored: ScoredCandidate[];
  weights: Weights;
  selectedId?: string | null;
  className?: string;
}

/** Providers competing on price / quality / latency / trust, ranked by the agent's weighting. */
export function DecisionMatrix({ scored, weights, selectedId, className }: DecisionMatrixProps) {
  const reduce = useReducedMotion();
  const winner = selectedId ?? scored[0]?.candidate.provider.id;
  const maxW = Math.max(weights.quality, weights.price, weights.latency, weights.trust, 0.0001);

  return (
    <div className={cn("space-y-5", className)}>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_64px] gap-3 border-b border-line pb-2">
            <Label>Provider</Label>
            {DIMS.map((d) => (
              <Label key={d}>{DIMENSION_LABELS[d]}</Label>
            ))}
            <Label className="text-right">Score</Label>
          </div>
          <div role="table" aria-label="Provider decision matrix">
            {scored.map((s) => {
              const isWinner = s.candidate.provider.id === winner;
              return (
                <motion.div
                  key={s.candidate.provider.id}
                  layout={!reduce}
                  transition={reduce ? { duration: 0 } : MOTION.move}
                  role="row"
                  className={cn(
                    "grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_64px] items-center gap-3 border-b border-line px-1 py-2.5",
                    isWinner && "border-l-2 border-l-signal bg-raised",
                  )}
                >
                  <div role="cell" className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold">{s.candidate.provider.name}</span>
                      {isWinner && (
                        <span className="bg-signal px-1 py-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-ink">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="tnum font-mono text-[11px] text-muted">
                      {formatUsd(s.candidate.service.priceMicro)} · {s.candidate.provider.latencyMs}ms
                    </div>
                  </div>
                  {DIMS.map((d) => (
                    <div role="cell" key={d} aria-label={valueLabel(s.normalized, d)}>
                      <Segments value={s.normalized[d]} selected={isWinner} />
                    </div>
                  ))}
                  <div role="cell" className={cn("tnum text-right font-mono text-sm font-bold", isWinner ? "text-signal" : "text-paper")}>
                    {s.score.toFixed(2)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <Label>Agent weighting</Label>
        <div className="mt-2 space-y-1.5">
          {(["quality", "price", "latency", "trust"] as const).map((d) => (
            <div key={d} className="grid grid-cols-[72px_1fr_40px] items-center gap-3">
              <Label tone="paper">{DIMENSION_LABELS[d]}</Label>
              <div className="h-2 bg-line">
                <motion.div
                  className="h-full bg-signal"
                  initial={false}
                  animate={{ width: `${(weights[d] / maxW) * 100}%` }}
                  transition={reduce ? { duration: 0 } : MOTION.snap}
                />
              </div>
              <span className="tnum text-right font-mono text-[11px] text-muted">{Math.round(weights[d] * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
