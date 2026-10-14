import type { CapabilityId } from "@/lib/types";

/** The emoji and awning colour of each kind of API, for the stalls in the catalog. */
export const LOOK: Record<CapabilityId, { emoji: string; color: string }> = {
  "data.lookup": { emoji: "🗂️", color: "#c6ff3d" },
  "image.sprites": { emoji: "🎮", color: "#c6ff3d" },
  "image.generate": { emoji: "🖼️", color: "#ff8fb3" },
  "image.vector": { emoji: "✒️", color: "#b98cff" },
  "image.edit": { emoji: "🪄", color: "#ffd23f" },
  "image.background_removal": { emoji: "🫥", color: "#5ce1e6" },
  "image.upscale": { emoji: "🔬", color: "#c6ff3d" },
  "vision.describe": { emoji: "👀", color: "#ee7a35" },
  "vision.damage_detection": { emoji: "👁️", color: "#5ce1e6" },
  "market.quotes": { emoji: "📈", color: "#ffd23f" },
  "news.search": { emoji: "📰", color: "#ff8fb3" },
  "filings.sec": { emoji: "📑", color: "#b98cff" },
  "web.search": { emoji: "🔎", color: "#5ce1e6" },
  "llm.analysis": { emoji: "🧠", color: "#ee7a35" },
  "text.translate": { emoji: "🌍", color: "#5ce1e6" },
  "text.summarize": { emoji: "✂️", color: "#ffd23f" },
  "audio.speech": { emoji: "🔊", color: "#b98cff" },
  "audio.sfx": { emoji: "💥", color: "#ffd23f" },
  "audio.music": { emoji: "🎵", color: "#ff8fb3" },
  "audio.transcribe": { emoji: "📝", color: "#c6ff3d" },
  "video.generate": { emoji: "🎬", color: "#ee7a35" },
  "model.3d": { emoji: "🧊", color: "#5ce1e6" },
  "model.image_to_3d": { emoji: "🗿", color: "#b98cff" },
};
