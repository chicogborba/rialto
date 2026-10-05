"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { formatUsd } from "@/lib/money";
import { activeAttempt, type RunState } from "@/lib/agent/reducer";
import { CAPABILITY_SHORT } from "@/lib/agent/capabilities";
import { MOTION } from "@/lib/agent/timing";
import { cn } from "@/lib/utils";
import { deriveGroupNodes, runStateLabel, type NodeVisual } from "./graph-derive";
import {
  edgePath, layoutGraph, slotX, slotY, GROUP_PAD, HEADER_H, NODE_H, NODE_W,
  type Box, type GroupLayout,
} from "./graph-layout";
import { GraphNode } from "./GraphNode";

function Edge({ d, drawn, active }: { d: string; drawn: boolean; active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.path
      d={d}
      fill="none"
      strokeWidth={active ? 1.5 : 1}
      vectorEffect="non-scaling-stroke"
      className={active ? "stroke-signal" : "stroke-line-hi"}
      strokeDasharray={drawn ? undefined : "3 4"}
      initial={{ pathLength: reduce ? 1 : 0, opacity: drawn ? 1 : 0.4 }}
      animate={{ pathLength: 1, opacity: drawn ? 1 : 0.4 }}
      transition={reduce ? { duration: 0 } : MOTION.draw}
    />
  );
}

function CoreNode({
  box, label, sub, tone = "line", pulse = false,
}: { box: Box; label: string; sub?: string; tone?: "line" | "signal" | "pay" | "fail"; pulse?: boolean }) {
  const stroke = { line: "stroke-line-hi", signal: "stroke-signal", pay: "stroke-pay", fail: "stroke-fail" }[tone];
  return (
    <g transform={`translate(${box.x}, ${box.y})`}>
      {tone === "signal" && <rect x={4} y={4} width={box.w} height={box.h} className="fill-signal" />}
      <rect width={box.w} height={box.h} className={cn("fill-surface", stroke)} strokeWidth={tone === "line" ? 1 : 1.5} />
      <text x={10} y={19} className="fill-muted font-mono" fontSize={9} letterSpacing={1.2}>
        {label}
      </text>
      <text x={10} y={36} className={cn("font-display", pulse && "sy-pulse", tone === "fail" ? "fill-fail" : "fill-paper")} fontSize={13} fontWeight={700}>
        {sub}
      </text>
    </g>
  );
}

function Particle({ from, to, tone }: { from: { x: number; y: number }; to: { x: number; y: number }; tone: "pay" | "data" }) {
  return (
    <motion.rect
      width={7}
      height={7}
      className={tone === "pay" ? "fill-pay" : "fill-data"}
      initial={{ x: from.x - 3, y: from.y - 3, opacity: 0 }}
      animate={{ x: [from.x - 3, to.x - 3], y: [from.y - 3, to.y - 3], opacity: [0, 1, 1, 0] }}
      transition={{ duration: MOTION.particleSeconds, ease: "linear", repeat: Infinity }}
    />
  );
}

const PAY_STAGES = new Set(["requested", "required_402", "policy_ok", "signing"]);
const EXEC_STAGES = new Set(["verified", "executing"]);

export function ExecutionGraph({ state, className }: { state: RunState; className?: string }) {
  const reduce = useReducedMotion();
  const layout = useMemo(
    () => layoutGraph(state.dag, (cap) => state.capabilities[cap]?.found.length ?? 0),
    [state.dag, state.capabilities],
  );

  const nodesByStep = useMemo(() => {
    const out: Record<string, NodeVisual[]> = {};
    for (const g of layout.groups) out[g.stepId] = deriveGroupNodes(state.capabilities[g.capability], state.steps[g.stepId]);
    return out;
  }, [layout.groups, state.capabilities, state.steps]);

  const hasDag = state.dag.length > 0;
  const running = state.status === "running";
  const completed = state.status === "completed";
  const failed = state.status === "failed";
  const settledTotal = Object.values(state.steps)
    .flatMap((s) => s.attempts)
    .filter((a) => a.stage === "settled")
    .reduce((sum, a) => sum + (a.amountMicro ?? 0), 0);
  const anyPayment = Object.values(state.steps).some((s) => s.attempts.length > 0);

  const dependedOn = new Set(layout.groups.flatMap((g) => g.dependsOn));
  const roots = layout.groups.filter((g) => g.dependsOn.length === 0);
  const leaves = layout.groups.filter((g) => !dependedOn.has(g.stepId));
  const groupById = new Map<string, GroupLayout>(layout.groups.map((g) => [g.stepId, g]));
  const stepActive = (id: string) => (state.steps[id]?.status ?? "pending") !== "pending";

  const active = activeAttempt(state);
  let particle: { from: { x: number; y: number }; to: { x: number; y: number }; tone: "pay" | "data" } | null = null;
  if (running && active && !reduce) {
    const g = groupById.get(active.step.id);
    const idx = g ? (nodesByStep[g.stepId] ?? []).findIndex((n) => n.provider.id === active.attempt.providerId) : -1;
    if (g && idx >= 0) {
      const nodeCenter = { x: slotX(g) + NODE_W / 2, y: slotY(g, idx) + NODE_H / 2 };
      if (PAY_STAGES.has(active.attempt.stage)) {
        particle = { from: { x: layout.agent.x + layout.agent.w / 2, y: layout.agent.y + layout.agent.h }, to: nodeCenter, tone: "pay" };
      } else if (EXEC_STAGES.has(active.attempt.stage)) {
        particle = { from: nodeCenter, to: { x: layout.result.x + layout.result.w / 2, y: layout.result.y }, tone: "data" };
      }
    }
  }

  const summary = layout.groups
    .map((g) => {
      const nodes = nodesByStep[g.stepId] ?? [];
      const sel = nodes.find((n) => n.role === "selected");
      return `${CAPABILITY_SHORT[g.capability]}: ${nodes.length} candidates${sel ? `, selected ${sel.provider.name}` : ""}`;
    })
    .join("; ");

  return (
    <div className={cn("overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto block h-auto min-w-[620px] w-full max-h-[78vh]"
        role="group"
        aria-label="Agent execution graph"
      >
        <title>Agent execution graph</title>

        {/* edges */}
        <Edge d={edgePath(layout.goal, layout.agent)} drawn={state.status !== "idle"} active={state.status !== "idle"} />
        {hasDag ? (
          <>
            {roots.map((g) => (
              <Edge key={`a-${g.stepId}`} d={edgePath(layout.agent, g)} drawn active={stepActive(g.stepId)} />
            ))}
            {layout.groups.flatMap((g) =>
              g.dependsOn.map((d) => {
                const from = groupById.get(d);
                return from ? <Edge key={`d-${d}-${g.stepId}`} d={edgePath(from, g)} drawn active={stepActive(g.stepId)} /> : null;
              }),
            )}
            {leaves.map((g) => (
              <Edge key={`p-${g.stepId}`} d={edgePath(g, layout.pay)} drawn active={state.steps[g.stepId]?.status === "done"} />
            ))}
          </>
        ) : (
          <Edge d={edgePath(layout.agent, layout.pay)} drawn={false} active={false} />
        )}
        <Edge d={edgePath(layout.pay, layout.result)} drawn={completed || anyPayment} active={completed} />

        {/* core nodes */}
        <CoreNode box={layout.goal} label="USER GOAL" sub={state.goal ? (state.goal.length > 26 ? `${state.goal.slice(0, 25)}…` : state.goal) : "Give it a goal."} />
        <CoreNode
          box={layout.agent}
          label="AI AGENT"
          sub={runStateLabel(state)}
          tone={failed ? "fail" : running ? "pay" : "line"}
          pulse={running && !reduce}
        />

        {/* service groups */}
        {layout.groups.map((g) => {
          const nodes = nodesByStep[g.stepId] ?? [];
          return (
            <g key={g.stepId}>
              <rect x={g.x} y={g.y} width={g.w} height={g.h} className="fill-ink stroke-line" strokeWidth={1} strokeDasharray="2 3" />
              <text x={g.x + GROUP_PAD} y={g.y + 15} className="fill-muted font-mono" fontSize={9} letterSpacing={1.2}>
                {CAPABILITY_SHORT[g.capability]}
              </text>
              <text x={g.x + g.w - GROUP_PAD} y={g.y + 15} textAnchor="end" className="fill-muted font-mono" fontSize={9}>
                {nodes.length ? `${nodes.length} FOUND` : "…"}
              </text>
              {nodes.map((n, i) => (
                <GraphNode key={n.provider.id} visual={n} x={slotX(g)} y={g.y + HEADER_H + GROUP_PAD + i * (NODE_H + 6)} />
              ))}
            </g>
          );
        })}

        <CoreNode
          box={layout.pay}
          label={`x402 PAY · ${state.mode === "live" ? "LIVE" : "SIMULATED"}`}
          sub={settledTotal > 0 ? formatUsd(settledTotal) : "$0.000"}
          tone={anyPayment && running ? "pay" : "line"}
        />
        <CoreNode
          box={layout.result}
          label="RESULT"
          sub={completed ? `${formatUsd(state.totalCostMicro)} · ${state.totalLatencyMs}ms` : failed ? "NO RESULT" : "—"}
          tone={completed ? "signal" : failed ? "fail" : "line"}
        />

        {particle && <Particle key={`${active?.step.id}-${active?.attempt.stage}`} {...particle} />}
      </svg>
      <p className="sr-only" aria-live="polite">
        {summary || "Waiting for a goal."}
      </p>
    </div>
  );
}
