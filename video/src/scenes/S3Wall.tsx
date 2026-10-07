import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { arc, bounce, prog } from "../lib/anim";
import { C, display, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Box, Cloud, Label, Stall, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Caption, Pop, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const STOPS = [
  { x: -4.4, at: 40, stall: "🎨 IMAGE API", gate: "SIGN UP ✉️", color: C.cyan },
  { x: 0, at: 100, stall: "🎙 VOICE API", gate: "CREDIT CARD 💳", color: C.gold },
  { x: 4.4, at: 160, stall: "🧊 3D API", gate: "API KEY 🔑", color: C.purple },
];
const NOTES = ["✉️  Verify your email", "💳  Add a payment method", "🔑  14 API keys in .env", "⚠️  Secret leaked on GitHub"];

/** Scene 3 — every service wants a signup, a card and a key. The agent has none, so it bugs you. */
export const S3Wall: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 40, 66, 100, 126, 160, 186, 222], [-8.5, -4.4, -4.4, 0, 0, 4.4, 4.4, -1.6], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const z = interpolate(f, [186, 222], [0.9, 2.6], clamp) - STOPS.reduce((m, s) => m + arc(f, s.at + 3, 9, 0.75), 0);
  const yaw = interpolate(f, [0, 38, 44, 60, 66, 98, 104, 120, 126, 158, 164, 180, 190], [1.57, 1.57, 3.14, 3.14, 1.57, 1.57, 3.14, 3.14, 1.57, 1.57, 3.14, 3.14, 6.28], clamp);
  const bonk = STOPS.reduce((m, s) => m + arc(f, s.at + 7, 12, 1), 0);
  const moving = (f < 40 || (f > 66 && f < 100) || (f > 126 && f < 160) || (f > 186 && f < 222)) ? 1 : 0;
  const late = f > 186;
  const zoom = prog(f, 186, 226);

  return (
    <AbsoluteFill>
      <Stage cam={[x * 0.6, 4.6 - zoom * 0.5, 13 - zoom * 1.8]} target={[x * 0.8 + zoom * 1.6, 1.5 - zoom * 0.9, -0.8 + zoom]}>
        <Cloud position={[-10, 9, -18]} scale={1.8} />
        <Cloud position={[9, 10, -20]} scale={2} />
        <Tree position={[-8.2, 0, -4.5]} scale={1.3} />
        <Tree position={[8.2, 0, -4.8]} scale={1.3} color="#6dbb86" />
        {STOPS.map((s) => (
          <group key={s.x}>
            <Stall position={[s.x, 0, -2.8]} color={s.color} label={s.stall} />
            {f >= s.at ? (
              <group position={[s.x, 1.0 + (1 - bounce(prog(f, s.at, s.at + 12))) * 9, -0.75]}>
                <Box size={[2.9, 2.0, 0.26]} color={C.red} />
                <Label text={s.gate} w={2.7} h={0.8} position={[0, 0.3, 0.14]} font={0.42} />
                <Label text="🔒" w={0.6} h={0.6} position={[0, -0.55, 0.14]} bg={C.red} border={false} font={0.8} />
              </group>
            ) : null}
          </group>
        ))}
        <Critter
          position={[x, 0, z]}
          yaw={yaw}
          walk={moving}
          squash={Math.min(1, bonk) * 0.6}
          tilt={bonk * Math.sin(f * 1.6) * 0.1}
          eyes={bonk > 0.25 ? "shut" : late ? "sad" : "open"}
          look={late ? [0, 0.3] : [0, 0]}
          armL={late && f > 226 ? 0.5 : 0}
          armR={late && f > 226 ? 0.5 : 0}
        />
      </Stage>

      <Pop at={228} style={{ left: 110, top: 300, transformOrigin: "bottom right" }} rotate={-3}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 54, color: C.ink, background: "#fffdf7", border: `6px solid ${C.ink}`, borderRadius: 36, boxShadow: hard(10), padding: "20px 34px" }}>uh… can I borrow your card? 💳</div>
      </Pop>
      {NOTES.map((note, i) => {
        const at = 206 + i * 11;
        return (
          <div
            key={note}
            style={{
              position: "absolute",
              right: 96,
              top: 110 + i * 112,
              fontFamily: mono,
              fontWeight: 800,
              fontSize: 34,
              color: i === 3 ? "#fff" : C.ink,
              background: i === 3 ? C.red : "#fffdf7",
              border: `5px solid ${C.ink}`,
              boxShadow: hard(8),
              padding: "20px 26px",
              width: 560,
              opacity: interpolate(f, [at, at + 5], [0, 1], clamp),
              translate: interpolate(f, [at, at + 12], ["700px 0px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.34, 1.4, 0.64, 1) }),
            }}
          >
            {note}
          </div>
        );
      })}
      <Caption from={8} to={182} accent={C.red}>But your agent *can’t *hire.</Caption>
      <Caption from={196} to={266} accent={C.gold}>So it comes back to *bug *you. 🙃</Caption>
    </AbsoluteFill>
  );
};
