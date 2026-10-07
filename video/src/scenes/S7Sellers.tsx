import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, eInOut, lerp, mix3, pop, prog, type V3 } from "../lib/anim";
import { C, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Box, Cloud, Coin, Parcel, Stall, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

const BUYERS = [C.orange, C.cyan, "#ff8fb3", C.gold, C.mint, C.orange, C.cyan, "#ff8fb3"];
/** buyer k reaches the counter and pays at this frame */
const served = (k: number) => 34 + k * 26;
const FRONT: V3 = [0.5, 0, 1.3];
const STEP: V3 = [-1.55, 0, 0.22];
const EXIT: V3 = [6.8, 0, 5.4];
const STALL: V3 = [2.7, 0, -0.6];
const JAR: V3 = [2.65, 1.5, -0.5];

/** Scene 7 — the other side of the market: publish an API, get paid per call. */
export const S7Sellers: React.FC = () => {
  const f = useCurrentFrame();
  const calls = BUYERS.filter((_, i) => f >= served(i) + 11).length;
  const sale = BUYERS.reduce((m, _, i) => m + arc(f, served(i) + 11, 8, 1), 0);

  return (
    <AbsoluteFill>
      <Stage cam={[0.9, 3.7, 11 - f * 0.004]} target={[1.2, 1.4, 0]}>
        <Cloud position={[-10, 9, -18]} scale={1.8} />
        <Cloud position={[10, 10, -20]} scale={2} />
        <Tree position={[-6.5, 0, -5]} scale={1.3} />
        <Tree position={[8.8, 0, -4]} scale={1.2} color="#6dbb86" />
        <group position={STALL} rotation={[0, -0.45, 0]}>
          <Stall color={C.purple} label="YOUR API 🛠️" />
          <Box size={[0.6, 0.7 + sale * 0.08, 0.6]} position={[0, 1.42, 0.1]} color={C.cyan} opacity={0.5} shadow={false} />
          {Array.from({ length: calls }).map((_, i) => (
            <Box key={i} size={[0.44, 0.07, 0.44]} position={[0, 1.12 + i * 0.08, 0.1]} color={C.gold} shadow={false} />
          ))}
        </group>
        <Critter position={[5.5, 0, -0.1]} yaw={-0.6} scale={0.9} color={C.purple} eyes="happy" armR={1} hop={sale * 0.3} seed={3} />

        {/* the queue: the front agent pays and leaves with its result, everyone else steps up */}
        {BUYERS.map((color, i) => {
          const at = served(i);
          if (f > at + 50) return null;
          // the next in line only steps up once the one in front has walked clear
          const stepping = BUYERS.slice(0, i).reduce((m, _, k) => m + eInOut(prog(f, served(k) + 14, served(k) + 26)), 0);
          const slot = i - stepping;
          const away = prog(f, at + 12, at + 50);
          const leaving = 1 - (1 - away) * (1 - away);
          const here: V3 = leaving > 0 ? mix3(FRONT, EXIT, leaving) : [FRONT[0] + STEP[0] * slot, 0, FRONT[2] + STEP[2] * slot];
          if (here[0] < -8) return null;
          const walking = (slot % 1 > 0.02 && slot % 1 < 0.98) || (leaving > 0 && leaving < 1) ? 1 : 0;
          const coin = prog(f, at + 2, at + 12);
          return (
            <group key={i}>
              <Critter position={here} yaw={1.05} scale={0.62} color={color} walk={walking} eyes={f > at + 8 ? "happy" : "open"} armR={arc(f, at, 12, 1)} seed={i}>
                {f >= at + 10 ? <Parcel position={[0, 1.02, 0]} scale={Math.max(0.001, pop(f, at + 10, 8)) * 0.8} /> : null}
              </Critter>
              {f >= at + 2 && f < at + 12 ? <Coin position={[lerp(here[0] + 0.5, JAR[0], coin), 1.1 + (JAR[1] - 1.1) * coin + Math.sin(coin * Math.PI) * 1.4, lerp(here[2], JAR[2], coin)]} spin={f * 0.6} rotation={[0, f * 0.5, 0]} /> : null}
            </group>
          );
        })}
      </Stage>
      <Pop at={served(0) + 8} style={{ right: 96, top: 92, transformOrigin: "right top" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 40, color: C.ink, background: C.lime, border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "12px 24px", scale: 1 + sale * 0.06 }}>
          {calls} {calls === 1 ? "call" : "calls"} → ${(calls * 0.002).toFixed(3)}
        </div>
      </Pop>
      {BUYERS.slice(0, 6).map((_, i) => (
        <Sfx key={i} at={served(i) + 11} name="ding" volume={0.12} />
      ))}
      <Narration scene="sellers" accent={C.gold} mark={["api", "publish", "paid", "every", "call"]} />
    </AbsoluteFill>
  );
};
