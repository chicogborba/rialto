import type { RunEvent } from "@/lib/agent/events";
import { RECORDED_SPRITES_RUN } from "@/lib/agent/recorded/sprites";
import { RECORDED_VISION_RUN } from "@/lib/agent/recorded/vision";
import { formatUsd } from "@/lib/money";
import { REJECTION_LABELS } from "@/lib/routing/qualify";
import type { Candidate } from "@/lib/types";

/** Everything the landing page shows is derived from the two recorded runs — no duplicated mock data. */

export function findEvent<T extends RunEvent["type"]>(events: RunEvent[], type: T): Extract<RunEvent, { type: T }> | undefined {
  return events.find((e): e is Extract<RunEvent, { type: T }> => e.type === type);
}

export { RECORDED_VISION_RUN };

export const VISION_FOUND: Candidate[] = findEvent(RECORDED_VISION_RUN, "discovery.completed")?.found ?? [];
export const VISION_QUALIFIED: Candidate[] = findEvent(RECORDED_VISION_RUN, "qualification.completed")?.qualified ?? [];

// ---------- 3D story (hero) ----------

export interface StoryNode {
  id: string;
  name: string;
  price: string;
  quality: string;
  rejected: boolean;
  rejectLabel: string | null;
  winner: boolean;
  score: number;
  /** normalised 0..1 scores for the deep-dive bars: quality, price, speed, trust */
  dims: [number, number, number, number];
}

// The hero story replays the recorded sprite-generation run.
const storyFound = findEvent(RECORDED_SPRITES_RUN, "discovery.completed")?.found ?? [];
const storyQual = findEvent(RECORDED_SPRITES_RUN, "qualification.completed");
const storyScored = findEvent(RECORDED_SPRITES_RUN, "evaluation.scored");
const storyDecision = findEvent(RECORDED_SPRITES_RUN, "decision.made");
const storyExec = findEvent(RECORDED_SPRITES_RUN, "execution.completed");

/** The five specialists of the recorded sprite run, with their real outcome. */
export const STORY_NODES: StoryNode[] = storyFound.map((c) => {
  const rejection = storyQual?.rejected.find((r) => r.candidate.provider.id === c.provider.id);
  const scored = storyScored?.scored.find((s) => s.candidate.provider.id === c.provider.id);
  return {
    id: c.provider.id,
    name: c.provider.name,
    price: formatUsd(c.service.priceMicro),
    quality: `${c.provider.qualityScore}%`,
    rejected: Boolean(rejection),
    rejectLabel: rejection ? REJECTION_LABELS[rejection.reason] : null,
    winner: storyDecision?.selectedId === c.provider.id,
    score: scored?.score ?? 0,
    dims: scored ? [scored.normalized.quality, scored.normalized.price, scored.normalized.latency, scored.normalized.trust] : [0, 0, 0, 0],
  };
});

const winnerNode = STORY_NODES.find((n) => n.winner);
export const STORY_FACTS = {
  found: STORY_NODES.length,
  rejected: STORY_NODES.filter((n) => n.rejected).length,
  winner: winnerNode?.name ?? "",
  price: winnerNode?.price ?? "",
  latencyMs: storyExec?.latencyMs ?? 0,
  goal: findEvent(RECORDED_SPRITES_RUN, "run.started")?.goal ?? "",
};
