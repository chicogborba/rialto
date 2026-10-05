import type { CapabilityId } from "@/lib/types";

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  "image.sprites": "Sprite generation",
  "vision.damage_detection": "Damage detection",
  "market.quotes": "Market data",
  "news.search": "News search",
  "filings.sec": "SEC filings",
  "web.search": "Web search",
  "llm.analysis": "Analysis model",
  "text.translate": "Translation",
  "text.summarize": "Summarization",
};

export const CAPABILITY_SHORT: Record<CapabilityId, string> = {
  "image.sprites": "SPRITES",
  "vision.damage_detection": "VISION",
  "market.quotes": "MARKET",
  "news.search": "NEWS",
  "filings.sec": "FILINGS",
  "web.search": "SEARCH",
  "llm.analysis": "ANALYSIS",
  "text.translate": "TRANSLATE",
  "text.summarize": "SUMMARY",
};

export const ALL_CAPABILITIES = Object.keys(CAPABILITY_LABELS) as CapabilityId[];

/** Capabilities where a second independent source is worth considering. */
export const CORROBORABLE: ReadonlySet<CapabilityId> = new Set<CapabilityId>(["news.search"]);

export function isCapabilityId(v: string): v is CapabilityId {
  return (ALL_CAPABILITIES as string[]).includes(v);
}
