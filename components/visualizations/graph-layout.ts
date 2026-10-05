import type { CapabilityId, DagNode } from "@/lib/types";

export const NODE_W = 164;
export const NODE_H = 42;
export const ROW_GAP = 6;
export const GROUP_PAD = 8;
export const GROUP_GAP = 18;
export const HEADER_H = 22;
export const CORE_W = 220;
export const CORE_H = 46;
export const V_GAP = 44;
export const MIN_W = 560;
export const MARGIN = 24;
export const GROUP_W = NODE_W + GROUP_PAD * 2;

/**
 * Layout hints: expected candidate count per capability so the graph does not jump when discovery
 * results arrive. The real count (found.length) wins when larger.
 */
const SLOT_HINT: Record<CapabilityId, number> = {
  "image.sprites": 5,
  "vision.damage_detection": 5,
  "market.quotes": 3,
  "news.search": 2,
  "filings.sec": 2,
  "web.search": 3,
  "llm.analysis": 2,
  "text.translate": 2,
  "text.summarize": 2,
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GroupLayout extends Box {
  stepId: string;
  capability: CapabilityId;
  layer: number;
  slots: number;
  dependsOn: string[];
}

export interface GraphLayout {
  width: number;
  height: number;
  goal: Box;
  agent: Box;
  pay: Box;
  result: Box;
  groups: GroupLayout[];
}

export function slotY(group: Box, slot: number): number {
  return group.y + HEADER_H + GROUP_PAD + slot * (NODE_H + ROW_GAP);
}
export function slotX(group: Box): number {
  return group.x + GROUP_PAD;
}

function layerOf(dag: DagNode[]): Map<string, number> {
  const layers = new Map<string, number>();
  const visit = (n: DagNode): number => {
    const cached = layers.get(n.id);
    if (cached !== undefined) return cached;
    const l = n.dependsOn.length ? 1 + Math.max(...n.dependsOn.map((d) => visit(dag.find((x) => x.id === d) ?? n))) : 0;
    layers.set(n.id, l);
    return l;
  };
  dag.forEach(visit);
  return layers;
}

/** Deterministic top-down layout: GOAL → AGENT → layered service groups → PAY → RESULT. */
export function layoutGraph(dag: DagNode[], foundCount: (cap: CapabilityId) => number): GraphLayout {
  const layerMap = layerOf(dag);
  const layerCount = dag.length ? Math.max(...layerMap.values()) + 1 : 0;
  const byLayer: DagNode[][] = Array.from({ length: layerCount }, () => []);
  dag.forEach((n) => byLayer[layerMap.get(n.id) ?? 0].push(n));

  const widest = byLayer.reduce((m, l) => Math.max(m, l.length * GROUP_W + Math.max(0, l.length - 1) * GROUP_GAP), 0);
  const width = Math.max(MIN_W, widest + MARGIN * 2);
  const cx = width / 2;

  let y = MARGIN;
  const goal: Box = { x: cx - CORE_W / 2, y, w: CORE_W, h: CORE_H };
  y += CORE_H + V_GAP;
  const agent: Box = { x: cx - CORE_W / 2, y, w: CORE_W, h: CORE_H };
  y += CORE_H + V_GAP;

  const groups: GroupLayout[] = [];
  byLayer.forEach((nodes, layer) => {
    const slotsList = nodes.map((n) => Math.max(foundCount(n.capability), SLOT_HINT[n.capability]));
    const heights = slotsList.map((s) => HEADER_H + GROUP_PAD * 2 + s * NODE_H + (s - 1) * ROW_GAP);
    const layerW = nodes.length * GROUP_W + (nodes.length - 1) * GROUP_GAP;
    let x = cx - layerW / 2;
    nodes.forEach((n, i) => {
      groups.push({
        stepId: n.id, capability: n.capability, layer, slots: slotsList[i],
        dependsOn: n.dependsOn, x, y, w: GROUP_W, h: heights[i],
      });
      x += GROUP_W + GROUP_GAP;
    });
    y += Math.max(...heights) + V_GAP;
  });

  const pay: Box = { x: cx - CORE_W / 2, y, w: CORE_W, h: CORE_H };
  y += CORE_H + V_GAP;
  const result: Box = { x: cx - CORE_W / 2, y, w: CORE_W, h: CORE_H };

  return { width, height: y + CORE_H + MARGIN, goal, agent, pay, result, groups };
}

/** Orthogonal edge path from the bottom-centre of `a` to the top-centre of `b`. */
export function edgePath(a: Box, b: Box): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y;
  const mid = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`;
}
