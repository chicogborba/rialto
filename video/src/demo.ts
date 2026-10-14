/**
 * The game made twice, by the same agent from the same request: once alone, once with Rialto.
 * Everything here is taken from the two recorded sessions and from the agent's statement; nothing
 * is estimated. While a slot is null the video marks it as still to come.
 */
export const PROMPT = "Make a game where you dodge cars in traffic";
export const WITH_RIALTO = ", use rialto";

/** Gameplay of each build, filmed by `scripts/record-demo.mjs gamePlain gameRialto` (paths under public/). */
export const DEMO_FOOTAGE: { scratch: string | null; rialto: string | null } = {
  scratch: "demo/takes/game-plain.mp4",
  rialto: "demo/takes/game-rialto.mp4",
};

/**
 * What each build cost on top of the Claude plan both sessions ran on, and what the game is made of.
 * The build without Rialto is the session of the first recording (Claude Code's default effort); the one
 * with Rialto is the later session (high effort).
 */
export const DEMO_NUMBERS: Record<"scratch" | "rialto", { cost: string | null; time: string | null; quality: string | null }> = {
  scratch: { cost: "$0", time: null, quality: "coloured boxes, no sound" },
  rialto: { cost: "$1.08", time: null, quality: "bought art, music, sound and a voice" },
};

/** What a player sees and hears in each build. `scratch` is what the plain build has instead, or false for nothing. */
export const FEATURES: { emoji: string; label: string; scratch: string | false; rialto: string }[] = [
  { emoji: "🖼️", label: "Title screen art", scratch: false, rialto: "FLUX.2 Pro" },
  { emoji: "🚓", label: "Car sprites", scratch: "boxes", rialto: "11 · Ideogram" },
  { emoji: "🛣️", label: "Road textures", scratch: "flat colour", rialto: "3 · Seamless Tiles" },
  { emoji: "🎵", label: "Soundtrack", scratch: false, rialto: "Stable Audio 2.5" },
  { emoji: "💥", label: "Sound effects", scratch: false, rialto: "4 · ElevenLabs" },
  { emoji: "🎙️", label: "Announcer voice", scratch: false, rialto: "4 lines · ElevenLabs" },
];

/** One call the agent paid for while building the Rialto version, as its statement lists it. */
export interface Purchase {
  emoji: string;
  /** what it is in the game: "player car", "soundtrack" */
  what: string;
  provider: string;
  usd: number;
}
/** The bill, one line per provider. */
export const RECEIPT: Purchase[] = [
  { emoji: "🚓", what: "11 sprites: cars, bus, coin, explosion", provider: "Ideogram Transparent Sprites", usd: 0.51975 },
  { emoji: "🛣️", what: "3 seamless textures: road, roadside", provider: "Seamless Tiles", usd: 0.063 },
  { emoji: "🖼️", what: "title screen art", provider: "FLUX.2 Pro", usd: 0.0525 },
  { emoji: "🎵", what: "soundtrack", provider: "Stable Audio 2.5", usd: 0.2625 },
  { emoji: "💥", what: "4 sound effects", provider: "ElevenLabs Sound Effects", usd: 0.126 },
  { emoji: "🎙️", what: "4 announcer lines", provider: "ElevenLabs v4 Turbo", usd: 0.052 },
];

/** Every purchase in the order it was made: what the terminal scene names as it goes by. */
export const PURCHASES: Purchase[] = [
  { emoji: "🏎️", what: "player car", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚙", what: "blue sedan", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚕", what: "taxi", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚚", what: "delivery truck", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚙", what: "hatchback", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🛣️", what: "road texture", provider: "Seamless Tiles", usd: 0.021 },
  { emoji: "🛣️", what: "roadside texture", provider: "Seamless Tiles", usd: 0.021 },
  { emoji: "🖼️", what: "title screen art", provider: "FLUX.2 Pro", usd: 0.0525 },
  { emoji: "🎵", what: "soundtrack", provider: "Stable Audio 2.5", usd: 0.2625 },
  { emoji: "💥", what: "sound effect", provider: "ElevenLabs Sound Effects", usd: 0.0315 },
  { emoji: "💥", what: "sound effect", provider: "ElevenLabs Sound Effects", usd: 0.0315 },
  { emoji: "💥", what: "sound effect", provider: "ElevenLabs Sound Effects", usd: 0.0315 },
  { emoji: "🎙️", what: "announcer line", provider: "ElevenLabs v4 Turbo", usd: 0.013 },
  { emoji: "🎙️", what: "announcer line", provider: "ElevenLabs v4 Turbo", usd: 0.013 },
  { emoji: "🚕", what: "taxi", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚓", what: "police car", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚙", what: "hatchback", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🚌", what: "city bus", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🔥", what: "explosion sprite", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🪙", what: "coin sprite", provider: "Ideogram Transparent Sprites", usd: 0.04725 },
  { emoji: "🛣️", what: "road texture", provider: "Seamless Tiles", usd: 0.021 },
  { emoji: "💥", what: "sound effect", provider: "ElevenLabs Sound Effects", usd: 0.0315 },
  { emoji: "🎙️", what: "announcer line", provider: "ElevenLabs v4 Turbo", usd: 0.013 },
  { emoji: "🎙️", what: "announcer line", provider: "ElevenLabs v4 Turbo", usd: 0.013 },
];
