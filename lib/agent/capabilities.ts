import type { CapabilityId } from "@/lib/types";

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  "data.lookup": "Public data lookup",
  "image.sprites": "Sprite generation",
  "image.generate": "Image generation",
  "image.vector": "Vector graphics (SVG)",
  "image.edit": "Image editing",
  "image.background_removal": "Background removal",
  "image.upscale": "Image upscaling",
  "vision.describe": "Image understanding",
  "vision.damage_detection": "Damage detection",
  "market.quotes": "Market data",
  "news.search": "News search",
  "filings.sec": "SEC filings",
  "web.search": "Web search",
  "llm.analysis": "Analysis model",
  "text.translate": "Translation",
  "text.summarize": "Summarization",
  "audio.speech": "Text to speech",
  "audio.sfx": "Sound effects",
  "audio.music": "Music generation",
  "audio.transcribe": "Speech to text",
  "video.generate": "Video generation",
  "model.3d": "3D model generation",
  "model.image_to_3d": "Image to 3D model",
};

export const CAPABILITY_SHORT: Record<CapabilityId, string> = {
  "data.lookup": "LOOKUP",
  "image.sprites": "SPRITES",
  "image.generate": "IMAGE",
  "image.vector": "VECTOR",
  "image.edit": "EDIT",
  "image.background_removal": "CUTOUT",
  "image.upscale": "UPSCALE",
  "vision.describe": "DESCRIBE",
  "vision.damage_detection": "VISION",
  "market.quotes": "MARKET",
  "news.search": "NEWS",
  "filings.sec": "FILINGS",
  "web.search": "SEARCH",
  "llm.analysis": "ANALYSIS",
  "text.translate": "TRANSLATE",
  "text.summarize": "SUMMARY",
  "audio.speech": "SPEECH",
  "audio.sfx": "SFX",
  "audio.music": "MUSIC",
  "audio.transcribe": "TRANSCRIPT",
  "video.generate": "VIDEO",
  "model.3d": "3D MODEL",
  "model.image_to_3d": "IMAGE TO 3D",
};

export const ALL_CAPABILITIES = Object.keys(CAPABILITY_LABELS) as CapabilityId[];

/** Capabilities where a second independent source is worth considering. */
export const CORROBORABLE: ReadonlySet<CapabilityId> = new Set<CapabilityId>(["news.search"]);

export function isCapabilityId(v: string): v is CapabilityId {
  return (ALL_CAPABILITIES as string[]).includes(v);
}
