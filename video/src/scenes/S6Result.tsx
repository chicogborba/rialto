import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, display } from "../theme";
import { Critter } from "../three/Critter";
import { Cloud, Confetti, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Caption, Chip, Pop } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const WORDS = [
  { text: "CHEAPER 💸", bg: C.lime, at: 12, rotate: -3, x: 0 },
  { text: "FASTER ⚡", bg: C.cyan, at: 36, rotate: 2, x: 70 },
  { text: "BETTER ✨", bg: C.gold, at: 60, rotate: -2, x: 20 },
];

/** Scene 6 — the payoff for the buyer. */
export const S6Result: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Stage cam={[0.9, 3, 12.2 - f * 0.004]} target={[0.9, 1.9, 0]}>
        <Cloud position={[-9, 9, -18]} scale={1.8} />
        <Cloud position={[11, 10, -20]} scale={2} />
        <Tree position={[-7.5, 0, -5]} scale={1.3} />
        <Tree position={[-9.5, 0, -8]} scale={1.6} color="#6dbb86" />
        <Critter position={[-3.4, 0, 0.6]} yaw={0.45} eyes="happy" armL={1} armR={1} hop={Math.abs(Math.sin(f * 0.2)) * 0.7} scale={1.1} />
        <Confetti t={f / fps} amount={1} position={[-3.3, 0, 0]} count={50} />
      </Stage>
      {WORDS.map((w, i) => (
        <div
          key={w.text}
          style={{
            position: "absolute",
            left: 900 + w.x,
            top: 120 + i * 200,
            fontFamily: display,
            fontWeight: 700,
            fontSize: 138,
            letterSpacing: -5,
            lineHeight: 1.08,
            color: C.ink,
            background: w.bg,
            border: `8px solid ${C.ink}`,
            boxShadow: `14px 14px 0 ${C.ink}`,
            padding: "0 34px 6px",
            whiteSpace: "nowrap",
            rotate: `${w.rotate}deg`,
            opacity: f >= w.at ? 1 : 0,
            scale: interpolate(f, [w.at, w.at + 9], [2.4, 1], { ...clamp, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2) }),
          }}
        >
          {w.text}
        </div>
      ))}
      <Pop at={118} rotate={-4} style={{ left: 96, top: 96, transformOrigin: "left top" }}>
        <Chip size={40} bg="#fffdf7" fg={C.grey} style={{ textDecoration: `line-through ${C.red} 6px` }}>
          14 accounts · 14 API keys
        </Chip>
      </Pop>
      <Caption from={112} to={206}>One key. One wallet. *Your *spending *limit. 🔒</Caption>
    </AbsoluteFill>
  );
};
