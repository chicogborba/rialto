import { replay } from "@/lib/agent/reducer";
import type { RunEvent } from "@/lib/agent/events";
import { RECORDED_RESEARCH_RUN } from "@/lib/agent/recorded/research";
import { RECORDED_VISION_RUN } from "@/lib/agent/recorded/vision";
import { formatUsd } from "@/lib/money";
import type { Candidate } from "@/lib/types";

/** Everything the landing page shows is derived from the two recorded runs — no duplicated mock data. */

export function findEvent<T extends RunEvent["type"]>(events: RunEvent[], type: T): Extract<RunEvent, { type: T }> | undefined {
  return events.find((e): e is Extract<RunEvent, { type: T }> => e.type === type);
}

export { RECORDED_RESEARCH_RUN, RECORDED_VISION_RUN };

export const VISION_FOUND: Candidate[] = findEvent(RECORDED_VISION_RUN, "discovery.completed")?.found ?? [];
export const VISION_QUALIFIED: Candidate[] = findEvent(RECORDED_VISION_RUN, "qualification.completed")?.qualified ?? [];

const researchFinal = replay(RECORDED_RESEARCH_RUN);

/** Marquee lines from settled purchases in the recorded research run. */
export const TICKER_ITEMS: string[] = Object.values(researchFinal.steps)
  .flatMap((s) => s.attempts)
  .filter((a) => a.stage === "settled")
  .map((a) => {
    const p = researchFinal.providers[a.providerId];
    return `${p?.name ?? a.providerId} · ${a.requirements?.resource.split("/").pop() ?? ""} · ${formatUsd(a.amountMicro ?? 0)} · SIMULATED`;
  });

/** Six marketplace rows spanning capabilities (first candidate of each capability group). */
export const MARKET_PREVIEW: Candidate[] = (() => {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const e of [...RECORDED_VISION_RUN, ...RECORDED_RESEARCH_RUN]) {
    if (e.type !== "discovery.completed") continue;
    for (const c of e.found) {
      if (seen.has(c.service.capability)) continue;
      seen.add(c.service.capability);
      out.push(c);
    }
  }
  const more = RECORDED_RESEARCH_RUN.filter((e) => e.type === "discovery.completed").flatMap((e) => (e.type === "discovery.completed" ? e.found : []));
  for (const c of more) if (out.length < 6 && !out.includes(c)) out.push(c);
  return out.slice(0, 6);
})();
