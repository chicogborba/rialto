"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { explain } from "@/lib/routing/explain";
import { scoreCandidates } from "@/lib/routing/score";
import { DIMENSION_LABELS, PRESET_LABELS, weightsFor } from "@/lib/routing/weights";
import { formatUsd, toMicro } from "@/lib/money";
import type { Candidate, PriorityPreset, Weights } from "@/lib/types";
import { Label, SegTabs } from "@/components/primitives";
import { DecisionMatrix } from "./DecisionMatrix";

const CYCLE: Exclude<PriorityPreset, "custom">[] = ["accuracy", "cost", "speed", "balanced"];
const TABS = (["accuracy", "balanced", "cost", "speed", "custom"] as const).map((id) => ({ id, label: PRESET_LABELS[id] }));

/** Client-side re-scoring with the same pure `scoreCandidates` the server uses. No API call. */
export function InteractiveMatrix({ candidates }: { candidates: Candidate[] }) {
  const reduce = useReducedMotion();
  const [preset, setPreset] = useState<PriorityPreset>("accuracy");
  const [custom, setCustom] = useState<Weights>({ quality: 6, price: 3, latency: 2, trust: 5 });
  const [maxPrice, setMaxPrice] = useState("");
  const [touched, setTouched] = useState(false);

  // auto-cycle presets until the visitor interacts (never under reduced motion)
  useEffect(() => {
    if (touched || reduce) return;
    const t = setInterval(() => setPreset((p) => CYCLE[(CYCLE.indexOf(p as (typeof CYCLE)[number]) + 1) % CYCLE.length]), 3200);
    return () => clearInterval(t);
  }, [touched, reduce]);

  const weights = useMemo(() => weightsFor(preset, custom), [preset, custom]);
  const cap = parseFloat(maxPrice);
  const pool = useMemo(
    () => (Number.isFinite(cap) ? candidates.filter((c) => c.service.priceMicro <= toMicro(cap)) : candidates),
    [candidates, cap],
  );
  const scored = useMemo(() => scoreCandidates(pool, weights), [pool, weights]);
  const winner = scored[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>Priority</Label>
          <SegTabs className="mt-2" label="Priority preset" tabs={TABS} value={preset} onChange={(p) => { setTouched(true); setPreset(p); }} />
        </div>
        <label className="block">
          <Label>Max price (USD)</Label>
          <input inputMode="decimal" value={maxPrice} placeholder="no cap" onChange={(e) => { setTouched(true); setMaxPrice(e.target.value.replace(/[^0-9.]/g, "")); }}
            className="tnum mt-2 block min-h-10 w-32 border border-line-hi bg-ink px-3 font-mono text-sm focus-visible:border-signal" />
        </label>
      </div>
      {preset === "custom" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["quality", "price", "latency", "trust"] as const).map((k) => (
            <label key={k} className="grid grid-cols-[72px_1fr_20px] items-center gap-3">
              <Label tone="paper">{DIMENSION_LABELS[k]}</Label>
              <input type="range" min={0} max={10} value={custom[k]} onChange={(e) => { setTouched(true); setCustom({ ...custom, [k]: Number(e.target.value) }); }} className="h-10 accent-[var(--color-signal)]" />
              <span className="tnum font-mono text-xs text-muted">{custom[k]}</span>
            </label>
          ))}
        </div>
      )}
      {winner ? (
        <>
          <DecisionMatrix scored={scored} weights={weights} />
          <div className="border border-signal bg-surface p-4 shadow-hard" aria-live="polite">
            <Label tone="signal">Agent selects</Label>
            <div className="mt-1 text-2xl font-bold">{winner.candidate.provider.name} <span className="tnum font-mono text-base text-muted">{formatUsd(winner.candidate.service.priceMicro)}</span></div>
            <p className="mt-1 font-mono text-xs text-muted">{explain(winner, scored, weights).summary}</p>
          </div>
        </>
      ) : (
        <p role="status" className="border border-fail p-4 font-mono text-sm text-fail">No provider under that price. The agent would stop and report why.</p>
      )}
    </div>
  );
}
