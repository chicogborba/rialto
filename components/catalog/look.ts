import type { CapabilityId } from "@/lib/types";

/** The emoji and awning colour of each kind of API, for the stalls in the catalog. */
export const LOOK: Record<CapabilityId, { emoji: string; color: string }> = {
  "data.lookup": { emoji: "🗂️", color: "#c6ff3d" },
  "image.sprites": { emoji: "🎮", color: "#c6ff3d" },
  "vision.damage_detection": { emoji: "👁️", color: "#5ce1e6" },
  "market.quotes": { emoji: "📈", color: "#ffd23f" },
  "news.search": { emoji: "📰", color: "#ff8fb3" },
  "filings.sec": { emoji: "📑", color: "#b98cff" },
  "web.search": { emoji: "🔎", color: "#5ce1e6" },
  "llm.analysis": { emoji: "🧠", color: "#ee7a35" },
  "text.translate": { emoji: "🌍", color: "#5ce1e6" },
  "text.summarize": { emoji: "✂️", color: "#ffd23f" },
};
