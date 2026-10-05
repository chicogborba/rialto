"use client";

import { formatUsd } from "@/lib/money";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import type { RunState } from "@/lib/agent/reducer";
import { isRecord, parseResult, type RunResultStep } from "@/lib/agent/result";
import { REJECTION_HINTS } from "@/lib/routing/qualify";
import { Label, Panel } from "@/components/primitives";

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function StepOutput({ step }: { step: RunResultStep }) {
  const o = isRecord(step.output) ? step.output : null;
  if (!o) return <p className="font-mono text-xs text-muted">No output.</p>;
  switch (step.capability) {
    case "vision.damage_detection":
      return (
        <div className="space-y-2">
          <div className={`inline-block px-2 py-1 font-mono text-sm font-bold uppercase ${o.damageDetected ? "bg-fail text-ink" : "bg-signal text-ink"}`}>
            {o.damageDetected ? "Structural damage detected" : "No structural damage"}
          </div>
          <ul className="space-y-1 text-sm">
            {arr(o.findings).filter(isRecord).map((f, i) => (
              <li key={i} className="border-l-2 border-line-hi pl-3">
                <strong>{str(f.location)}</strong> — {str(f.type)} · <span className="font-mono text-xs">{str(f.severity)} · {Math.round(Number(f.confidence) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{str(o.recommendation)}</p>
        </div>
      );
    case "llm.analysis":
      return <p className="text-sm leading-relaxed">{str(o.analysis)}</p>;
    case "text.translate":
      return <p className="text-sm leading-relaxed">{str(o.translation)}</p>;
    case "text.summarize":
      return <ul className="list-disc space-y-1 pl-5 text-sm">{arr(o.summary).map((b, i) => <li key={i}>{str(b)}</li>)}</ul>;
    case "news.search":
      return <ul className="space-y-1 text-sm">{arr(o.headlines).filter(isRecord).map((h, i) => <li key={i}>{str(h.title)} <span className="font-mono text-[11px] text-muted">{str(h.source)}</span></li>)}</ul>;
    case "market.quotes":
      return <p className="tnum font-mono text-sm">{str(o.symbol)} {String(o.price)} ({String(o.changePct)}%) vol {String(o.volume)}</p>;
    default:
      return <pre className="overflow-x-auto font-mono text-[11px] text-muted">{JSON.stringify(o, null, 1).slice(0, 600)}</pre>;
  }
}

export function ResultView({ state }: { state: RunState }) {
  if (state.status === "failed") {
    return (
      <Panel title="Run failed" status={<Label tone="fail">No charge for failed calls</Label>}>
        <p className="text-sm">{state.error?.message}</p>
        {state.error?.rejected && state.error.rejected.length > 0 && (
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {state.error.rejected.map((r) => (
              <li key={r.candidate.service.id}>
                <span className="text-fail">✕ {r.candidate.provider.name}</span> — {REJECTION_HINTS[r.reason]}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }
  const result = parseResult(state.result);
  if (state.status !== "completed" || !result) {
    return <p className="font-mono text-xs text-muted">Result appears here when the run completes.</p>;
  }
  const s = state.savings;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 border border-line bg-surface p-4 md:grid-cols-4">
        <div><Label>Total cost</Label><div className="tnum mt-1 font-mono text-xl font-bold text-signal">{formatUsd(state.totalCostMicro)}</div></div>
        <div><Label>Latency (critical path)</Label><div className="tnum mt-1 font-mono text-xl font-bold">{state.totalLatencyMs}ms</div></div>
        <div><Label>Saved vs premium</Label><div className="tnum mt-1 font-mono text-xl font-bold">{s ? formatUsd(s.savedMicro) : "—"}</div></div>
        <div><Label>Cheapest route</Label><div className="tnum mt-1 font-mono text-sm">{s ? `${formatUsd(s.cheapestBaselineMicro)} · ${s.qualityDeltaVsCheapest >= 0 ? "+" : ""}${s.qualityDeltaVsCheapest} pts` : "—"}</div></div>
      </div>
      {result.steps.map((st) => (
        <Panel key={st.stepId} title={`${st.stepId} · ${CAPABILITY_LABELS[st.capability]}`} status={<Label tone="paper">{st.provider}</Label>}>
          <StepOutput step={st} />
        </Panel>
      ))}
    </div>
  );
}
