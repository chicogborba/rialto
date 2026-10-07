import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, eInOut, lerp, prog } from "../lib/anim";
import { C, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Box, Cloud, Coin, Stall, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Caption, Chip, Pop, hard } from "../ui/Ui";

const BUYERS = [C.orange, C.cyan, "#ff8fb3", C.gold, C.orange, C.mint];
const arrive = (i: number) => 30 + i * 24;

/** Scene 7 — the other side of the market: publish an API, get paid per call. */
export const S7Sellers: React.FC = () => {
  const f = useCurrentFrame();
  const calls = BUYERS.filter((_, i) => f >= arrive(i) + 12).length;
  const lastHit = BUYERS.reduce((m, _, i) => m + arc(f, arrive(i) + 12, 8, 1), 0);

  return (
    <AbsoluteFill>
      <Stage cam={[0.9, 3.7, 10.8]} target={[1.5, 1.5, 0]}>
        <Cloud position={[-10, 9, -18]} scale={1.8} />
        <Cloud position={[10, 10, -20]} scale={2} />
        <Tree position={[-6.5, 0, -5]} scale={1.3} />
        <Tree position={[8.8, 0, -4]} scale={1.2} color="#6dbb86" />
        <Stall position={[2.4, 0, -0.6]} color={C.purple} label="YOUR API 🛠️" />
        <Box size={[0.6, 0.7 + lastHit * 0.08, 0.6]} position={[2.4, 1.42, -0.2]} color={C.cyan} opacity={0.55} shadow={false} />
        {Array.from({ length: calls }).map((_, i) => (
          <Box key={i} size={[0.44, 0.07, 0.44]} position={[2.4, 1.12 + i * 0.08, -0.2]} color={C.gold} shadow={false} />
        ))}
        <Critter position={[5.4, 0, 0.4]} yaw={-0.55} scale={0.9} color={C.purple} eyes="happy" armR={1} hop={lastHit * 0.35} seed={3} />
        {BUYERS.map((color, i) => {
          const a = arrive(i);
          if (f < a - 34 || f > a + 46) return null;
          const inP = eInOut(prog(f, a - 34, a));
          const outP = eInOut(prog(f, a + 14, a + 46));
          const coin = prog(f, a + 2, a + 12);
          return (
            <group key={i}>
              <Critter
                position={[lerp(lerp(-12, 0.3, inP), 10, outP), 0, lerp(1.8, 5.5, outP)]}
                yaw={lerp(1.57, 1.1, prog(f, a - 6, a)) + outP * 0.3}
                scale={0.62}
                color={color}
                walk={f < a || f > a + 14 ? 1 : 0}
                eyes={f > a + 10 ? "happy" : "open"}
                armR={arc(f, a, 12, 1)}
                seed={i}
              />
              {f >= a + 2 && f < a + 13 ? <Coin position={[lerp(0.9, 2.4, coin), 1.2 + Math.sin(coin * Math.PI) * 1.6, lerp(1.6, -0.2, coin)]} spin={f * 0.6} rotation={[0, f * 0.5, 0]} /> : null}
            </group>
          );
        })}
      </Stage>
      <Pop at={6} style={{ left: 96, top: 96, transformOrigin: "left top" }}>
        <Chip size={32}>you set the price · Rialto adds a small fee</Chip>
      </Pop>
      <Pop at={36} style={{ right: 96, top: 96, transformOrigin: "right top" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 46, color: C.ink, background: C.lime, border: `6px solid ${C.ink}`, boxShadow: hard(10), padding: "16px 28px", scale: 1 + lastHit * 0.06 }}>
          📞 {calls} calls → 💰 ${(calls * 0.002).toFixed(3)}
        </div>
      </Pop>
      <Caption from={8} to={86} accent={C.purple}>Got an API? *Publish it. 🛠️</Caption>
      <Caption from={96} to={176}>Get *paid on *every *call. 💰</Caption>
    </AbsoluteFill>
  );
};
