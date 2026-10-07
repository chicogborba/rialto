import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, bounce, eInOut, mix3, prog, rnd } from "../lib/anim";
import { C, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Box, Cloud, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Caption, Chip, Pop, hard } from "../ui/Ui";

const COLLAPSE = 118;
const CUBES = [C.cyan, C.gold, C.red, C.lime, C.purple, "#ffffff"];

/** Scene 1 — the agent tries to build the thing by hand, and it falls apart. */
export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const placed = CUBES.filter((_, i) => f >= 12 + i * 16).length;
  const fallen = f >= COLLAPSE;
  const shake = fallen ? Math.sin(f * 2.4) * 0.12 * (1 - prog(f, COLLAPSE, COLLAPSE + 18)) : 0;
  const cam = mix3([0, 3.4, 11.5], [0.9, 2.8, 9], eInOut(prog(f, 0, 210)));
  const wobble = Math.sin(f * 0.3) * 0.012 * Math.pow(placed, 1.4);
  const reaching = CUBES.reduce((m, _, i) => Math.max(m, arc(f, 6 + i * 16, 14)), 0);
  const tokens = Math.round(prog(f, 0, 200) * 412_000).toLocaleString("en-US");
  const minutes = Math.floor(prog(f, 0, 200) * 23);

  return (
    <AbsoluteFill>
      <Stage cam={[cam[0] + shake, cam[1] + shake * 0.6, cam[2]]} target={[1, 1.4, 0]}>
        <Tree position={[-6, 0, -6]} />
        <Tree position={[7.5, 0, -8]} scale={1.3} color="#6dbb86" />
        <Tree position={[-9.5, 0, -10]} scale={1.5} />
        <Cloud position={[-7, 7.5, -14]} scale={1.4} />
        <Cloud position={[8, 8.5, -16]} scale={1.8} />
        <Critter
          position={[-0.7, 0, 0.4]}
          yaw={0.5}
          armR={fallen ? 0 : reaching}
          eyes={!fallen ? "open" : f < COLLAPSE + 24 ? "wide" : "sad"}
          look={fallen ? [0.6, -0.8] : [0.8, 0.4 + placed * 0.08]}
          hop={arc(f, COLLAPSE, 10, 0.5)}
          squash={prog(f, COLLAPSE + 26, COLLAPSE + 44) * 0.55}
          pitch={prog(f, COLLAPSE + 26, COLLAPSE + 44) * 0.14}
        />
        {/* the hand-made tower */}
        <group position={[2.5, 0, 0]} rotation={[0, 0, fallen ? 0 : wobble]}>
          {CUBES.map((color, i) => {
            const start = 12 + i * 16;
            if (f < start) return null;
            const size = 0.82 - i * 0.05;
            const restY = 0.4 + i * 0.74;
            const drop = bounce(prog(f, start, start + 12));
            const t = Math.max(0, (f - COLLAPSE) / 30);
            const land = Math.sqrt((2 * restY) / 9.8) + 0.05;
            const tt = Math.min(t, land);
            const dir = rnd(i, 1) - 0.35;
            return (
              <Box
                key={i}
                size={[size, size * 0.86, size]}
                color={color}
                position={[(rnd(i, 4) - 0.5) * 0.16 + dir * 3.4 * tt, fallen ? Math.max(size * 0.43, restY - 4.9 * tt * tt) : restY + (1 - drop) * 3, (rnd(i, 2) - 0.3) * 2.6 * tt]}
                rotation={[tt * (2 + rnd(i, 5) * 4), rnd(i, 3) * 0.5 + tt * 2, tt * (rnd(i, 6) - 0.5) * 6]}
              />
            );
          })}
        </group>
      </Stage>

      <Pop at={4} style={{ left: 96, top: 96, transformOrigin: "left top" }}>
        <Chip>task ▸ “make a robot hero for my game” 🎮</Chip>
      </Pop>
      <Pop at={14} style={{ right: 96, top: 96, transformOrigin: "right top" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 38, background: "#fffdf7", border: `5px solid ${C.ink}`, boxShadow: hard(8), padding: "14px 24px", color: C.ink, textAlign: "right", minWidth: 380 }}>
          <div>🔥 {tokens} tokens</div>
          <div>⏱ {String(minutes).padStart(2, "0")} min</div>
        </div>
      </Pop>
      <Pop at={COLLAPSE + 6} rotate={-7} style={{ right: 330, top: 330 }}>
        <Chip bg={C.red} fg="#fff" size={54}>💥 from scratch</Chip>
      </Pop>
      <Caption from={8} to={104}>Your agent is *smart.</Caption>
      <Caption from={112} to={206} accent={C.red}>But it builds everything *from *scratch. 😮‍💨</Caption>
    </AbsoluteFill>
  );
};
