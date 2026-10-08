/**
 * What the agent goes shopping for in the hero. `say` finishes the headline ("an API for …"),
 * `sign` is the name board of the stall he buys it from, `color` its awning and the parcel's band.
 * Shared by the headline and the 3D scene, which must not pull three.js into the first paint.
 */
export const NEEDS = [
  { say: "game sprites", sign: "SPRITES", color: 0xc6ff3d },
  { say: "a voice-over", sign: "VOICE", color: 0x5ce1e6 },
  { say: "a 3D model", sign: "3D", color: 0xffd23f },
  { say: "live market data", sign: "DATA", color: 0xff8fa3 },
  { say: "a translation", sign: "TRANSLATE", color: 0x8fb4ff },
] as const;

/** Seconds per stall: he walks to it, pays, gets his parcel, and the headline moves on. */
export const NEED_SECONDS = 4.6;
/** How much of that is the walk. */
export const WALK_SECONDS = 1.7;
