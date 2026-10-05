"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatUsd } from "@/lib/money";
import { MOTION } from "@/lib/agent/timing";
import { cn } from "@/lib/utils";
import { NODE_H, NODE_W } from "./graph-layout";
import { STAGE_BADGE, type NodeVisual } from "./graph-derive";

const BADGE_FILL = { pay: "fill-pay", signal: "fill-signal", fail: "fill-fail", data: "fill-data" } as const;

function Badge({ text, tone }: { text: string; tone: keyof typeof BADGE_FILL }) {
  const w = text.length * 6.2 + 10;
  return (
    <g transform={`translate(${NODE_W - 6 - w}, 5)`}>
      <rect width={w} height={14} className={BADGE_FILL[tone]} />
      <text x={w / 2} y={10.5} textAnchor="middle" className="fill-ink font-mono" fontSize={8.5} fontWeight={700}>
        {text}
      </text>
    </g>
  );
}

interface GraphNodeProps {
  visual: NodeVisual;
  x: number;
  y: number;
}

/** One candidate provider inside a capability group. Position + emphasis animate; state comes from props. */
export function GraphNode({ visual: v, x, y }: GraphNodeProps) {
  const reduce = useReducedMotion();
  const selected = v.role === "selected";
  const stageBadge = v.stage ? STAGE_BADGE[v.stage] : undefined;
  const barW = NODE_W - 16;

  const stroke = v.failed
    ? "stroke-fail"
    : selected
      ? "stroke-signal"
      : v.role === "second"
        ? "stroke-signal"
        : "stroke-line-hi";

  return (
    <motion.g
      initial={{ opacity: 0, x, y: y - 10 }}
      animate={{ opacity: v.opacity, x, y, scale: selected ? 1.04 : 1 }}
      transition={reduce ? { duration: 0 } : { ...MOTION.move, opacity: MOTION.snap }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      {selected && <rect x={4} y={4} width={NODE_W} height={NODE_H} className="fill-signal" />}
      <rect
        width={NODE_W}
        height={NODE_H}
        className={cn("fill-surface", stroke)}
        strokeWidth={selected || v.failed ? 1.5 : 1}
        strokeDasharray={v.role === "second" ? "4 3" : undefined}
      />
      <text x={8} y={17} className={cn("font-display", v.failed ? "fill-fail" : "fill-paper")} fontSize={12} fontWeight={700}>
        {v.provider.name}
      </text>
      {v.role === "rejected" && (
        <line x1={8} x2={8 + v.provider.name.length * 7} y1={13} y2={13} className="stroke-fail" strokeWidth={1.5} />
      )}
      <text x={8} y={31} className="fill-muted font-mono" fontSize={9.5}>
        {`${formatUsd(v.service.priceMicro)} · ${v.provider.qualityScore}% · ${v.provider.latencyMs}ms`}
      </text>

      {v.score !== null && v.role !== "rejected" && (
        <g>
          <rect x={8} y={NODE_H - 6} width={barW} height={3} className="fill-line" />
          <motion.rect
            x={8}
            y={NODE_H - 6}
            height={3}
            className={selected ? "fill-signal" : "fill-muted"}
            initial={{ width: 0 }}
            animate={{ width: barW * v.score }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          />
        </g>
      )}

      {v.rejectionLabel ? (
        <text x={NODE_W - 8} y={15} textAnchor="end" className="fill-fail font-mono" fontSize={8.5} fontWeight={700}>
          {v.rejectionLabel}
        </text>
      ) : stageBadge ? (
        <Badge text={stageBadge.text} tone={stageBadge.tone} />
      ) : v.score !== null && v.rank !== null ? (
        <text x={NODE_W - 8} y={15} textAnchor="end" className="fill-muted font-mono" fontSize={9}>
          {`#${v.rank} · ${v.score.toFixed(2)}`}
        </text>
      ) : null}
    </motion.g>
  );
}
