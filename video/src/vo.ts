import data from "./voiceover.json";

/** One narration line, as recorded by scripts/voiceover.mjs. Times are seconds from the clip start. */
export interface Line {
  text: string;
  seconds: number;
  words: { word: string; start: number; end: number }[];
}
export const VO = data as Record<string, Line>;
