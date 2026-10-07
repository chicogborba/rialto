import type React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { arc, bounce, eInOut, eOut, lerp, mix3, prog, rnd } from "../lib/anim";
import { C, display } from "../theme";
import { Critter } from "../three/Critter";
import { Box, Label } from "../three/Props";
import { Stage } from "../three/Stage";
import { Caption, Chip, Pop } from "../ui/Ui";

const PALETTE = [C.cyan, C.gold, C.lime, C.purple, C.orange, C.mint, "#ffffff", C.red];
const COUNT = 80;

/** Scene 4 — the reveal: a giant phone book lands and a whole market pours out of it. */
export const S4Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const bg = interpolateColors(f, [14, 26], [C.ink, C.paper]);
  const ground = interpolateColors(f, [14, 26], ["#241c17", C.sand]);
  const drop = bounce(prog(f, 4, 34));
  const shake = Math.sin(f * 2.7) * 0.2 * (f > 14 ? 1 - prog(f, 15, 32) : 0);
  const open = eOut(prog(f, 50, 70));
  const cam = mix3([0, 3.4, 14], [0, 3.8, 12.2], eInOut(prog(f, 0, 180)));
  const cx = lerp(11, 4.2, eOut(prog(f, 62, 104)));

  return (
    <AbsoluteFill style={{ background: bg }}>
      <Stage cam={[cam[0] + shake, cam[1] + shake * 0.5, cam[2]]} target={[0, 2.9, 0]} bg={bg} ground={ground}>
        <group position={[0, 1.95 + (1 - drop) * 15, 0]} rotation={[0, -0.18, 0]} scale={0.95}>
          <Box size={[3.3, 4.4, 0.16]} position={[0, 0, -0.34]} color={C.ink} />
          <Box size={[3.1, 4.2, 0.56]} position={[0.04, 0, 0]} color="#fffaf0" />
          <Label text={"🎨 🎙 🧊\n🔎 📈 🌦\n🗺 🤖 💬"} w={2.8} h={3.9} position={[0.04, 0, 0.29]} bg="#fffaf0" border={false} font={0.2} />
          <group position={[-1.65, 0, 0.34]} rotation={[0, -open * 2.2, 0]}>
            <Box size={[3.3, 4.4, 0.16]} position={[1.65, 0, 0]} color={C.lime} />
            <Label text={"THE API\nBOOK 📖"} w={2.9} h={2.4} position={[1.65, 0.5, 0.09]} bg={C.lime} border={false} font={0.3} />
          </group>
        </group>
        {Array.from({ length: COUNT }).map((_, i) => {
          const start = 56 + i * 0.6;
          if (f < start) return null;
          const p = eOut(prog(f, start, start + 30));
          const a = (i / COUNT) * Math.PI * 2 + rnd(i, 1);
          const r = 3.6 + rnd(i, 2) * 8;
          const size = 0.34 + rnd(i, 3) * 0.46;
          return (
            <Box
              key={i}
              size={[size, size, size]}
              color={PALETTE[i % PALETTE.length]}
              position={[lerp(0.6, Math.sin(a) * r, p), lerp(2.4, size / 2, p) + Math.sin(p * Math.PI) * (3 + rnd(i, 4) * 3) + arc(f, start + 30, 8, 0.25), lerp(0.6, Math.cos(a) * r * 0.55 - 1, p)]}
              rotation={[(1 - p) * 6 * rnd(i, 5), rnd(i, 6) * 3 + (1 - p) * 4, 0]}
            />
          );
        })}
        {f > 60 ? (
          <Critter position={[cx, 0, 1.4]} yaw={-0.6} hop={f < 104 ? Math.abs(Math.sin(f * 0.32)) * 0.7 : arc(f, 120, 14, 0.9) + arc(f, 150, 14, 0.7)} eyes={f < 108 ? "wide" : "happy"} look={[-0.8, 0.5]} armL={f > 108 ? 1 : 0} armR={f > 108 ? 1 : 0} />
        ) : null}
      </Stage>

      <Pop at={20} style={{ left: 0, right: 0, top: 50, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 200, letterSpacing: -10, lineHeight: 1, color: C.ink, background: C.lime, border: `8px solid ${C.ink}`, padding: "0 44px 10px", boxShadow: `16px 16px 0 ${C.ink}` }}>RIALTO</div>
      </Pop>
      <Pop at={46} rotate={-3} style={{ left: 0, right: 0, top: 292, display: "flex", justifyContent: "center" }}>
        <Chip size={44}>the phone book for AI agents 📖</Chip>
      </Pop>
      <Caption from={86} to={176}>Every API, one call away. *Wallet *included. 💸</Caption>
    </AbsoluteFill>
  );
};
