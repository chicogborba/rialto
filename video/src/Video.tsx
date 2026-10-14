import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Sequence, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, prog } from "./lib/anim";
import { S0Boot } from "./scenes/S0Boot";
import { S0Cold } from "./scenes/S0Cold";
import { S1Hook } from "./scenes/S1Hook";
import { S2BuildOrHire } from "./scenes/S2BuildOrHire";
import { S3Wall } from "./scenes/S3Wall";
import { S4Reveal } from "./scenes/S4Reveal";
import { S5How } from "./scenes/S5How";
import { S6Setup } from "./scenes/S6Setup";
import { S7Sellers } from "./scenes/S7Sellers";
import { S10Solana } from "./scenes/S10Solana";
import { S12Market } from "./scenes/S12Market";
import { S13Team } from "./scenes/S13Team";
import { S14Vision } from "./scenes/S14Vision";
import { S15Outro } from "./scenes/S15Outro";
import { C } from "./theme";
import { DURATIONS, ORDER, SPEECH, TOTAL, startOf, type SceneId } from "./timeline";
import { AudioFlags } from "./ui/Ui";

export type PitchProps = {
  narration: boolean;
  music: boolean;
  sfx: boolean;
};

export const SCENES: Record<SceneId, { name: string; component: React.FC }> = {
  cold: { name: "0 · The boring pitch (recorded)", component: S0Cold },
  boot: { name: "0 · Claude takes over", component: S0Boot },
  hook: { name: "1 · From scratch", component: S1Hook },
  buildOrHire: { name: "2 · Build or hire", component: S2BuildOrHire },
  wall: { name: "3 · Agents can't hire", component: S3Wall },
  reveal: { name: "4 · Rialto", component: S4Reveal },
  how: { name: "5 · How it works", component: S5How },
  setup: { name: "6 · Setup in three steps", component: S6Setup },
  sellers: { name: "7 · Sellers", component: S7Sellers },
  solana: { name: "10 · Why Solana", component: S10Solana },
  market: { name: "12 · Market and model", component: S12Market },
  team: { name: "13 · Team", component: S13Team },
  vision: { name: "14 · Vision", component: S14Vision },
  outro: { name: "15 · Reaction and credits (recorded)", component: S15Outro },
};

/** The animated part has the soundtrack; the recorded opening brings its own (elevator) music. */
const MUSIC_FROM = startOf("boot");
const MUSIC_TRACK = 72 * 30;
/** Music level by frame: sits low under the narrator, comes up in the gaps, drops under the recorded reaction. */
const UNDER_VOICE = 0.065;
const OPEN = 0.13;
function musicVolume(f: number): number {
  const ducked = SPEECH.reduce((m, [start, end]) => Math.max(m, Math.min(prog(f, start - 10, start - 2), 1 - prog(f, end + 4, end + 18))), 0);
  const outro = startOf("outro");
  // under the recording the music all but disappears, then returns for the credits
  const reaction = Math.min(prog(f, outro - 6, outro + 6), 1 - prog(f, outro + 100, outro + 120));
  // the track is looped: dip across each seam so the restart is not heard as a jump
  const into = (f - MUSIC_FROM) % MUSIC_TRACK;
  const seam = f - MUSIC_FROM > 60 ? Math.min(1, prog(into, 0, 24), 1 - prog(into, MUSIC_TRACK - 24, MUSIC_TRACK)) : 1;
  return lerp(lerp(OPEN, UNDER_VOICE, ducked), 0.03, reaction) * seam * prog(f, MUSIC_FROM, MUSIC_FROM + 8) * (1 - prog(f, TOTAL - 30, TOTAL - 2));
}

/** Scene change: a lime panel, then an ink one, sweep across and hide the cut. */
export const Wipe: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at - 9 || frame > at + 9) return null;
  const panel = (delay: number, color: string) => (
    <AbsoluteFill
      style={{
        background: color,
        translate: interpolate(frame, [at - 8 + delay, at + delay, at + 8 + delay], ["-102% 0%", "0% 0%", "102% 0%"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.bezier(0.6, 0, 0.9, 0.4), Easing.bezier(0.1, 0.6, 0.4, 1)],
        }),
      }}
    />
  );
  return (
    <>
      {panel(-1, C.lime)}
      {panel(0, C.ink)}
    </>
  );
};

/** cuts into and out of the recordings are hard cuts; every other scene change gets the wipe */
const HARD: SceneId[] = ["cold", "boot", "outro"];

export const RialtoPitch: React.FC<PitchProps> = ({ narration, music, sfx }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const cuts = ORDER.slice(1)
    .filter((id) => !HARD.includes(id))
    .map(startOf);
  return (
    <AudioFlags.Provider value={{ narration, music, sfx }}>
      <AbsoluteFill style={{ background: C.paper }}>
        <Series>
          {ORDER.map((id) => {
            const Scene = SCENES[id].component;
            return (
              <Series.Sequence key={id} name={SCENES[id].name} durationInFrames={DURATIONS[id]} premountFor={fps}>
                <Scene />
              </Series.Sequence>
            );
          })}
        </Series>

        {/* a soft vignette pulls the eye to the middle of the frame (not over the recordings) */}
        {frame >= startOf("boot") && frame < startOf("outro") ? <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 58%, rgba(23,18,15,0.13) 100%)" }} /> : null}
        {cuts.map((at) => (
          <Wipe key={at} at={at} />
        ))}

        {sfx
          ? cuts.map((at) => (
              <Sequence key={at} name="sfx whoosh" from={at - 7} layout="none">
                <Audio src="https://remotion.media/whoosh.wav" volume={0.16} />
              </Sequence>
            ))
          : null}
        {music ? (
          <Sequence name="Music" from={MUSIC_FROM} layout="none">
            <Audio src={staticFile("music/getting-it-done.mp3")} loop volume={(f) => musicVolume(f + MUSIC_FROM)} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
    </AudioFlags.Provider>
  );
};
