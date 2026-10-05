"use client";

import { formatUsd } from "@/lib/money";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import type { RunState } from "@/lib/agent/reducer";
import { DIMENSION_LABELS, priorityOrder } from "@/lib/routing/weights";
import type { CapabilityId } from "@/lib/types";
import { Label, Panel } from "@/components/primitives";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 border-b border-line py-2 last:border-b-0">
      <Label>{label}</Label>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

/** Explainable decision for one capability: who was picked, why, and what it costs. */
export function DecisionCard({ state, capability }: { state: RunState; capability: CapabilityId }) {
  const cap = state.capabilities[capability];
  if (!cap) return null;
  const selected = cap.scored.find((s) => s.candidate.provider.id === cap.selectedId);
  const alt = cap.scored.find((s) => s.candidate.provider.id === cap.alternativeId);
  const second = cap.scored.find((s) => s.candidate.provider.id === cap.secondSourceId);
  const priority = state.constraints
    ? priorityOrder(state.constraints.weights).map((d) => DIMENSION_LABELS[d]).join(" > ")
    : "—";

  return (
    <Panel title="Agent decision" status={selected ? <Label tone="signal">Decided</Label> : <Label tone="pay">Evaluating…</Label>} selected={Boolean(selected)}>
      <Row label="Capability">{CAPABILITY_LABELS[capability]}</Row>
      <Row label="Priority">{priority}</Row>
      <Row label="Candidates">
        <span className="tnum font-mono">
          {cap.found.length} discovered{cap.qualified.length || cap.rejected.length ? ` · ${cap.qualified.length} qualified` : ""}
        </span>
        {cap.rejected.length > 0 && (
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted">
            {cap.rejected.map((r) => (
              <li key={r.candidate.service.id}>
                <span className="text-fail">✕</span> {r.candidate.provider.name} — {r.reason.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        )}
      </Row>
      {selected ? (
        <>
          <Row label="Selected">
            <span className="bg-signal px-1.5 py-0.5 font-bold text-ink">{selected.candidate.provider.name}</span>
          </Row>
          <Row label="Why">
            <ul className="space-y-0.5 font-mono text-xs">
              {cap.explanation?.pros.map((p) => (
                <li key={p} className="text-signal">+ <span className="text-paper">{p}</span></li>
              ))}
              {cap.explanation?.cons.map((c) => (
                <li key={c} className="text-fail">− <span className="text-paper">{c}</span></li>
              ))}
            </ul>
            {cap.explanation && <p className="mt-2 text-xs text-muted">{cap.explanation.summary}</p>}
          </Row>
          <Row label="Expected cost">
            <span className="tnum font-mono font-bold">{formatUsd(selected.candidate.service.priceMicro)}</span>
          </Row>
          {alt && (
            <Row label="Alternative">
              <span className="font-mono text-xs">
                {alt.candidate.provider.name} — {formatUsd(alt.candidate.service.priceMicro)}
              </span>
            </Row>
          )}
          {cap.secondSourceReason && (
            <Row label="Second source">
              <span className="text-xs text-muted">
                {second ? <strong className="text-paper">{second.candidate.provider.name}. </strong> : null}
                {cap.secondSourceReason}
              </span>
            </Row>
          )}
        </>
      ) : null}
    </Panel>
  );
}
