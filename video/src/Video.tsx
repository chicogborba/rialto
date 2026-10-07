import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Sequence, Series, useVideoConfig } from "remotion";
import { S1Hook } from "./scenes/S1Hook";
import { S2BuildOrHire } from "./scenes/S2BuildOrHire";
import { S3Wall } from "./scenes/S3Wall";
import { S4Reveal } from "./scenes/S4Reveal";
import { S5How } from "./scenes/S5How";
import { S6Result } from "./scenes/S6Result";
import { S7Sellers } from "./scenes/S7Sellers";
import { S8Cta } from "./scenes/S8Cta";
import { C } from "./theme";

export const DURATIONS = { hook: 210, buildOrHire: 240, wall: 270, reveal: 180, how: 450, result: 210, sellers: 180, cta: 180 } as const;
export const TOTAL = Object.values(DURATIONS).reduce((a, b) => a + b, 0);

const SFX = "https://remotion.media";
/** [frame in the full video, file, volume] */
const CUES: [number, string, number][] = [
  [118, "whip.wav", 0.7],
  [210, "whoosh.wav", 0.5],
  [350, "ding.wav", 0.5],
  [450, "whoosh.wav", 0.5],
  [494, "switch.wav", 0.9],
  [554, "switch.wav", 0.9],
  [614, "switch.wav", 0.9],
  [656, "mouse-click.wav", 0.8],
  [667, "mouse-click.wav", 0.8],
  [678, "mouse-click.wav", 0.8],
  [689, "mouse-click.wav", 0.8],
  [720, "whoosh.wav", 0.6],
  [770, "page-turn.wav", 0.9],
  [900, "whoosh.wav", 0.5],
  [1104, "ding.wav", 0.4],
  [1146, "whip.wav", 0.5],
  [1176, "ding.wav", 0.7],
  [1284, "ding.wav", 0.7],
  [1350, "whoosh.wav", 0.5],
  [1362, "switch.wav", 0.7],
  [1386, "switch.wav", 0.7],
  [1410, "switch.wav", 0.7],
  [1560, "whoosh.wav", 0.5],
  ...[0, 1, 2, 3, 4, 5].map((i): [number, string, number] => [1560 + 42 + i * 24, "ding.wav", 0.35]),
  [1740, "whoosh.wav", 0.6],
];

export const RialtoPitch: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
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
      {CUES.map(([from, file, volume], i) => (
        <Sequence key={i} name={`sfx ${file}`} from={from} layout="none">
          <Audio src={`${SFX}/${file}`} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
