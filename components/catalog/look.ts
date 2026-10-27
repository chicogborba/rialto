import { AudioLines, Boxes, BrainCircuit, Clapperboard, Database, Eraser, Eye, FileAudio, FileText, Gamepad2, Image, Languages, Mic, Music, Newspaper, PenTool, Rotate3d, ScanSearch, Scissors, Search, Sparkles, TrendingUp, Wand2, type LucideIcon } from "lucide-react";
import type { CapabilityId } from "@/lib/types";

/** The icon and awning colour of each kind of API: the stalls in the catalog and the API forms. */
export const LOOK: Record<CapabilityId, { icon: LucideIcon; color: string }> = {
  "data.lookup": { icon: Database, color: "#c6ff3d" },
  "image.sprites": { icon: Gamepad2, color: "#c6ff3d" },
  "image.generate": { icon: Image, color: "#ff8fb3" },
  "image.vector": { icon: PenTool, color: "#b98cff" },
  "image.edit": { icon: Wand2, color: "#ffd23f" },
  "image.background_removal": { icon: Eraser, color: "#5ce1e6" },
  "image.upscale": { icon: Sparkles, color: "#c6ff3d" },
  "vision.describe": { icon: Eye, color: "#ee7a35" },
  "vision.damage_detection": { icon: ScanSearch, color: "#5ce1e6" },
  "market.quotes": { icon: TrendingUp, color: "#ffd23f" },
  "news.search": { icon: Newspaper, color: "#ff8fb3" },
  "filings.sec": { icon: FileText, color: "#b98cff" },
  "web.search": { icon: Search, color: "#5ce1e6" },
  "llm.analysis": { icon: BrainCircuit, color: "#ee7a35" },
  "text.translate": { icon: Languages, color: "#5ce1e6" },
  "text.summarize": { icon: Scissors, color: "#ffd23f" },
  "audio.speech": { icon: Mic, color: "#b98cff" },
  "audio.sfx": { icon: AudioLines, color: "#ffd23f" },
  "audio.music": { icon: Music, color: "#ff8fb3" },
  "audio.transcribe": { icon: FileAudio, color: "#c6ff3d" },
  "video.generate": { icon: Clapperboard, color: "#ee7a35" },
  "model.3d": { icon: Boxes, color: "#5ce1e6" },
  "model.image_to_3d": { icon: Rotate3d, color: "#b98cff" },
};

/** The look of a capability that may not be in the table (old rows): a plain box. */
export const lookOf = (capability: string) => LOOK[capability as CapabilityId] ?? { icon: Boxes, color: "#ecdfc6" };
