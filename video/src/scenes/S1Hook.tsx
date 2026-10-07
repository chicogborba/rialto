import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, bounce, eInOut, mix3, prog, rnd } from "../lib/anim";
import { C, mono } from "../theme";
import { DURATIONS, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Cloud, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, Sfx, hard } from "../ui/Ui";

/** the tower falls just before the narrator says "scratch" */
const COLLAPSE = 110;
const CUBES = [C.cyan, C.gold, C.red, C.lime, C.purple, "#ffffff"];

/** Scene 1 — the agent tries to build the thing by hand, and it falls apart. */
export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const slow = wordAt("hook", "1c", 0);
  const pricey = wordAt("hook", "1c", 2);
  const placed = CUBES.filter((_, i) => f >= 12 + i * 16).length;
  const fallen = f >= COLLAPSE;
  const shake = fallen ? Math.sin(f * 2.4) * 0.12 * (1 - prog(f, COLLAPSE, COLLAPSE + 18)) : 0;
  const cam = mix3([0, 3.4, 11.5], [0.9, 2.8, 9], eInOut(prog(f, 0, DURATIONS.hook)));
  const wobble = Math.sin(f * 0.3) * 0.012 * Math.pow(placed, 1.4);
  const reaching = CUBES.reduce((m, _, i) => Math.max(m, arc(f, 6 + i * 16, 14)), 0);
  const tokens = Math.round(prog(f, 0, DURATIONS.hook - 10) * 412_000).toLocaleString("en-US");
  const minutes = Math.floor(prog(f, 0, DURATIONS.hook - 10) * 23);
  const row = (on: boolean, at: number): React.CSSProperties => ({ padding: "2px 14px", background: on ? C.red : "transparent", color: on ? "#fff" : C.ink, scale: 1 + arc(f, at, 10, 0.12) });

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
            const tt = Math.min(t, Math.sqrt((2 * restY) / 9.8) + 0.05);
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

      <Pop at={4} style={{ left: 96, top: 92, transformOrigin: "left top" }}>
        <Chip>task ▸ “make a robot hero for my game”</Chip>
      </Pop>
      <Pop at={14} style={{ right: 96, top: 92, transformOrigin: "right top" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 34, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "12px 10px", textAlign: "right", minWidth: 330 }}>
          <div style={row(f >= pricey, pricey)}>{tokens} tokens</div>
          <div style={row(f >= slow, slow)}>{String(minutes).padStart(2, "0")} min</div>
        </div>
      </Pop>
      <Sfx at={COLLAPSE} name="whip" volume={0.3} />
      <Narration scene="hook" mark={["smart", "scratch", "slow", "expensive"]} />
    </AbsoluteFill>
  );
};
