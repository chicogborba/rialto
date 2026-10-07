/**
 * The story the 3D scene tells as you scroll, one line per beat, in the same words as the pitch
 * video. `at` is the scroll progress (0..1) where the beat starts; the scene's timeline is built on
 * the same numbers. Words starting with * get the highlighter; `chapter` is the small label on top.
 */
export const BEATS = [
  { at: 0, chapter: "The problem", text: "Your agent builds everything *from *scratch.", bad: true },
  { at: 0.14, chapter: "The problem", text: "Every API wants a *sign-up, a *card, a *key.", bad: true },
  { at: 0.28, chapter: "The fix", text: "*Rialto: the phone book for AI agents.", bad: false },
  { at: 0.42, chapter: "How it works", text: "It *finds the right service,", bad: false },
  { at: 0.56, chapter: "How it works", text: "*compares price, speed and trust,", bad: false },
  { at: 0.7, chapter: "How it works", text: "and *pays *per *call.", bad: false },
  { at: 0.84, chapter: "How it works", text: "*Done. No sign-up. No card.", bad: false },
] as const;
