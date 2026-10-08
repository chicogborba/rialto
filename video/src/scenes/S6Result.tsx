import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { arc } from "../lib/anim";
import { C, display } from "../theme";
import { CUES, DURATIONS, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Cloud, Confetti, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Narration, Sfx } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** what you get, then how you stay in control: each label lands as the narrator says its word */
const WHAT = [
  { text: "Cheaper", bg: C.lime, word: 1, rotate: -3, x: 0 },
  { text: "Faster", bg: C.cyan, word: 2, rotate: 2, x: 70 },
  { text: "Better", bg: C.gold, word: 6, rotate: -2, x: 20 },
];
const HOW = [
  { text: "🔑 One key", bg: C.lime, word: 1, rotate: 2, x: 30 },
  { text: "👛 One wallet", bg: C.cyan, word: 3, rotate: -2, x: 0 },
  { text: "✋ Your limit", bg: C.gold, word: 6, rotate: 3, x: 50 },
];

/** Scene 6 — the payoff for the buyer. */
export const S6Result: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  /** the first three labels clear out just before the second line starts; the second three stay */
  const swap = CUES.result["6b"] - 10;
  const never = DURATIONS.result + 100;
  const labels = [
    ...WHAT.map((w, i) => ({ ...w, row: i, at: wordAt("result", "6a", w.word), out: swap + i * 3 })),
    ...HOW.map((w, i) => ({ ...w, row: i, at: wordAt("result", "6b", w.word), out: never })),
  ];
  return (
    <AbsoluteFill>
      <Stage cam={[0.3, 3, 12.2 - f * 0.004]} target={[0.3, 1.9, 0]}>
        <Cloud position={[-9, 9, -18]} scale={1.8} />
        <Cloud position={[11, 10, -20]} scale={2} />
        <Tree position={[-7.5, 0, -5]} scale={1.3} />
        <Tree position={[-9.5, 0, -8]} scale={1.6} color="#6dbb86" />
        <Critter position={[-3, 0, 0.6]} yaw={0.45} eyes="happy" armL={1} armR={1} hop={labels.reduce((m, l) => m + arc(f, l.at, 14, 0.8), 0) + arc(f % 46, 0, 18, 0.25)} scale={1.15} />
        <Confetti t={f / fps} amount={1} position={[-3, 0, 0]} count={30} />
      </Stage>
      {labels.map((l) =>
        f < l.at || f > l.out + 8 ? null : (
          <div
            key={l.text}
            style={{
              position: "absolute",
              left: 900 + l.x,
              top: 130 + l.row * 190,
              fontFamily: display,
              fontWeight: 700,
              fontSize: l.text.length > 8 ? 108 : 132,
              letterSpacing: l.text.length > 8 ? -4 : -6,
              lineHeight: 1.1,
              color: C.ink,
              background: l.bg,
              border: `6px solid ${C.ink}`,
              boxShadow: `12px 12px 0 ${C.ink}`,
              padding: "0 36px 6px",
              whiteSpace: "nowrap",
              rotate: `${l.rotate}deg`,
              opacity: interpolate(f, [l.at, l.at + 3, l.out, l.out + 6], [0, 1, 1, 0], clamp),
              scale: interpolate(f, [l.at, l.at + 8, l.out, l.out + 8], [1.3, 1, 1, 0.7], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
            }}
          >
            {l.text}
          </div>
        ),
      )}
      {labels.map((l) => (
        <Sfx key={l.text} at={l.at} name="switch" volume={0.45} />
      ))}
      <Narration scene="result" mark={["cheaper", "faster", "better", "key", "wallet", "limit"]} />
    </AbsoluteFill>
  );
};
