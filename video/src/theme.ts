import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const display = loadDisplay("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500", "800"], subsets: ["latin"] }).fontFamily;

export const C = {
  ink: "#17120f",
  paper: "#f6efe0",
  sand: "#ecdfc6",
  orange: "#ee7a35",
  lime: "#c6ff3d",
  cyan: "#5ce1e6",
  red: "#ff4d4d",
  gold: "#ffd23f",
  purple: "#9945ff",
  mint: "#14f195",
  grey: "#a9a394",
  wood: "#b98a5a",
} as const;

export { FPS } from "./timeline";
