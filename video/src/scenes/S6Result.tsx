import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { arc } from "../lib/anim";
import { C, display } from "../theme";
import { wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Cloud, Confetti, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Narration, Sfx } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** each word slams in as the narrator says it */
const WORDS = [
  { text: "Cheaper", bg: C.lime, word: 1, rotate: -3, x: 0 },
  { text: "Faster", bg: C.cyan, word: 2, rotate: 2, x: 70 },
  { text: "Better", bg: C.gold, word: 6, rotate: -2, x: 20 },
];

/** Scene 6 — the payoff for the buyer. */
export const S6Result: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hits = WORDS.map((w) => wordAt("result", "6a", w.word));
  return (
    <AbsoluteFill>
      <Stage cam={[0.9, 3, 12.2 - f * 0.004]} target={[0.9, 1.9, 0]}>
        <Cloud position={[-9, 9, -18]} scale={1.8} />
        <Cloud position={[11, 10, -20]} scale={2} />
        <Tree position={[-7.5, 0, -5]} scale={1.3} />
        <Tree position={[-9.5, 0, -8]} scale={1.6} color="#6dbb86" />
        <Critter position={[-3.4, 0, 0.6]} yaw={0.45} eyes="happy" armL={1} armR={1} hop={hits.reduce((m, at) => m + arc(f, at, 14, 0.8), 0) + arc(f % 46, 0, 18, 0.25)} scale={1.1} />
        <Confetti t={f / fps} amount={1} position={[-3.4, 0, 0]} count={30} />
      </Stage>
      {WORDS.map((w, i) => (
        <div
          key={w.text}
          style={{
            position: "absolute",
            left: 900 + w.x,
            top: 130 + i * 190,
            fontFamily: display,
            fontWeight: 700,
            fontSize: 132,
            letterSpacing: -6,
            lineHeight: 1.1,
            color: C.ink,
            background: w.bg,
            border: `6px solid ${C.ink}`,
            boxShadow: `12px 12px 0 ${C.ink}`,
            padding: "0 36px 6px",
            whiteSpace: "nowrap",
            rotate: `${w.rotate}deg`,
            // a short, small pop: big slams overlapped the word above and read as a flicker
            opacity: interpolate(f, [hits[i], hits[i] + 3], [0, 1], clamp),
            scale: interpolate(f, [hits[i], hits[i] + 8], [1.3, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          {w.text}
        </div>
      ))}
      {hits.map((at) => (
        <Sfx key={at} at={at} name="switch" volume={0.45} />
      ))}
      <Narration scene="result" mark={["key", "wallet", "limit"]} />
    </AbsoluteFill>
  );
};
