import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Sequence, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, prog } from "./lib/anim";
import { S1Hook } from "./scenes/S1Hook";
import { S2BuildOrHire } from "./scenes/S2BuildOrHire";
import { S3Wall } from "./scenes/S3Wall";
import { S4Reveal } from "./scenes/S4Reveal";
import { S5How } from "./scenes/S5How";
import { S6Result } from "./scenes/S6Result";
import { S7Sellers } from "./scenes/S7Sellers";
import { S8Cta } from "./scenes/S8Cta";
import { C } from "./theme";
import { DURATIONS, ORDER, SPEECH, TOTAL, startOf } from "./timeline";
import { AudioFlags } from "./ui/Ui";

export type PitchProps = {
  narration: boolean;
  music: boolean;
  sfx: boolean;
};

/** Music level by frame: sits low under the narrator, comes up in the gaps and for the outro. */
const UNDER_VOICE = 0.065;
const OPEN = 0.13;
function musicVolume(f: number): number {
  const ducked = SPEECH.reduce((m, [start, end]) => Math.max(m, Math.min(prog(f, start - 10, start - 2), 1 - prog(f, end + 4, end + 18))), 0);
  const lastWord = SPEECH[SPEECH.length - 1][1];
  const outro = lerp(1, 1.5, prog(f, lastWord, lastWord + 20));
  return lerp(OPEN, UNDER_VOICE, ducked) * outro * prog(f, 0, 8) * (1 - prog(f, TOTAL - 36, TOTAL - 2));
}

/** Scene change: a lime panel, then an ink one, sweep across and hide the cut. */
const Wipe: React.FC<{ at: number }> = ({ at }) => {
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

export const RialtoPitch: React.FC<PitchProps> = ({ narration, music, sfx }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const cuts = ORDER.slice(1).map(startOf);
  return (
    <AudioFlags.Provider value={{ narration, music, sfx }}>
      <AbsoluteFill style={{ background: C.paper }}>
        <Series>
          <Series.Sequence name="1 · From scratch" durationInFrames={DURATIONS.hook} premountFor={fps}>
            <S1Hook />
          </Series.Sequence>
          <Series.Sequence name="2 · Build or hire" durationInFrames={DURATIONS.buildOrHire} premountFor={fps}>
            <S2BuildOrHire />
          </Series.Sequence>
          <Series.Sequence name="3 · Agents can't hire" durationInFrames={DURATIONS.wall} premountFor={fps}>
            <S3Wall />
          </Series.Sequence>
          <Series.Sequence name="4 · Rialto" durationInFrames={DURATIONS.reveal} premountFor={fps}>
            <S4Reveal />
          </Series.Sequence>
          <Series.Sequence name="5 · How it works" durationInFrames={DURATIONS.how} premountFor={fps}>
            <S5How />
          </Series.Sequence>
          <Series.Sequence name="6 · Result" durationInFrames={DURATIONS.result} premountFor={fps}>
            <S6Result />
          </Series.Sequence>
          <Series.Sequence name="7 · Sellers" durationInFrames={DURATIONS.sellers} premountFor={fps}>
            <S7Sellers />
          </Series.Sequence>
          <Series.Sequence name="8 · CTA" durationInFrames={DURATIONS.cta} premountFor={fps}>
            <S8Cta />
          </Series.Sequence>
        </Series>

        {/* a soft vignette pulls the eye to the middle of the frame */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 58%, rgba(23,18,15,0.13) 100%)" }} />
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
        {music ? <Audio name="Music" src={staticFile("music/getting-it-done.mp3")} volume={musicVolume(frame)} /> : null}
      </AbsoluteFill>
    </AudioFlags.Provider>
  );
};
