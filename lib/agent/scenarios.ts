import type { DagNode, PriorityPreset, ScenarioId } from "@/lib/types";
import { toMicro } from "@/lib/money";

export interface Scenario {
  id: ScenarioId;
  keywords: string[];
  dag: DagNode[];
  defaultPreset: PriorityPreset;
  confidenceCap: number;
}

/** First matching scenario wins; `generic` is the fallback. */
export const SCENARIOS: Scenario[] = [
  {
    id: "sprites",
    keywords: ["sprite", "pixel art", "pixel-art", "game asset", "spritesheet"],
    dag: [{ id: "s1", capability: "image.sprites", dependsOn: [] }],
    defaultPreset: "accuracy",
    confidenceCap: 1,
  },
  {
    id: "vision",
    keywords: ["image", "photo", "picture", "damage", "container", "inspect"],
    dag: [{ id: "s1", capability: "vision.damage_detection", dependsOn: [] }],
    defaultPreset: "accuracy",
    confidenceCap: 1,
  },
  {
    id: "research",
    keywords: ["stock", "nvidia", "market", "earnings", "dropped", "shares", "why did"],
    dag: [
      { id: "s1", capability: "market.quotes", dependsOn: [] },
      { id: "s2", capability: "news.search", dependsOn: [] },
      { id: "s3", capability: "filings.sec", dependsOn: [] },
      { id: "s4", capability: "web.search", dependsOn: [] },
      { id: "s5", capability: "llm.analysis", dependsOn: ["s1", "s2", "s3", "s4"] },
    ],
    defaultPreset: "balanced",
    confidenceCap: 1,
  },
  {
    id: "translate",
    keywords: ["translate", "portuguese", "spanish", "document", "summarize"],
    dag: [
      { id: "s1", capability: "text.translate", dependsOn: [] },
      { id: "s2", capability: "text.summarize", dependsOn: ["s1"] },
    ],
    defaultPreset: "cost",
    confidenceCap: 1,
  },
];

export const GENERIC_SCENARIO: Scenario = {
  id: "generic",
  keywords: [],
  dag: [
    { id: "s1", capability: "web.search", dependsOn: [] },
    { id: "s2", capability: "llm.analysis", dependsOn: ["s1"] },
  ],
  defaultPreset: "balanced",
  confidenceCap: 0.55,
};

export function matchScenario(goal: string): Scenario {
  const g = goal.toLowerCase();
  return SCENARIOS.find((s) => s.keywords.some((k) => g.includes(k))) ?? GENERIC_SCENARIO;
}

export const GOAL_CHIPS: { label: string; goal: string }[] = [
  { label: "Analyze an image", goal: "Analyze this image and determine whether the container has structural damage." },
  { label: "Research a stock move", goal: "Research why NVIDIA dropped today and produce a sourced explanation." },
  { label: "Translate + summarize", goal: "Translate this document to Portuguese and summarize the important parts." },
  { label: "Make game sprites", goal: "Make a pixel-art sprite sheet for my game's hero: idle, run and jump." },
];

export function presetFromGoal(goal: string): PriorityPreset | null {
  const g = goal.toLowerCase();
  if (/accuracy matters|accurate|most accurate/.test(g)) return "accuracy";
  if (/\bcheap|low cost|lowest cost|under \$|below \$/.test(g)) return "cost";
  if (/\bfast\b|\bquick|urgent/.test(g)) return "speed";
  return null;
}

/** "under $0.005" / "below $0.01" → micro-USDC, else null. */
export function budgetFromGoal(goal: string): number | null {
  const m = goal.toLowerCase().match(/(?:under|below|less than|max(?:imum)?)\s*\$\s*(\d+(?:\.\d+)?)/);
  return m ? toMicro(parseFloat(m[1])) : null;
}
