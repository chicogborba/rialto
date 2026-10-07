import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, eInOut, mix3, prog } from "../lib/anim";
import type { V3 } from "../lib/anim";
import { C, mono } from "../theme";
import { DURATIONS, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Cloud, Tree } from "../three/Props";
import { Antenna, BODY_Y, CHISEL, Chips, Chisel, Mallet, STONE, STONE_DARK, Stand, ToolBox, WonkyHead, jolt, swing, tumble } from "../three/Sculpt";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, Sfx, hard } from "../ui/Ui";

/** one tap of the mallet each; the last one is one too many */
const STRIKES = [12, 28, 44, 60, 76, 92];
/** the statue falls apart just before the narrator says "scratch" */
const COLLAPSE = 110;
const TAPS = [...STRIKES, COLLAPSE];

// The workshop has its own frame: the agent at the origin facing +z, the stone to its right.
const TIP: V3 = [CHISEL.tip[0], BODY_Y + CHISEL.tip[1], CHISEL.tip[2]];
const STAND = 0.2;
/** the stone is modelled 1.5 wide and drawn a little bigger; `rest` turns a height above the ground into its units */
const SIZE = 1.2;
const rest = (above: number) => (above - STAND) / SIZE;
/** the waste stone, knocked off in this order: each strike frees one corner of the block */
const WASTE: { at: V3; push: V3 }[] = [
  { at: [-0.375, 1.6, 0], push: [0.1, 0, -0.8] },
  { at: [0.375, 1.6, 0], push: [0.8, 0, -0.35] },
  { at: [-0.375, 0.96, 0], push: [-0.1, 0, 1.2] },
  { at: [0.375, 0.96, 0], push: [1.0, 0, 0.55] },
];
const HEAD: V3 = [0, 0.99, 0];
/** what the base breaks into */
const BASE = [-1, 1].flatMap((x) => [0, 1].flatMap((y) => [-1, 1].map((z) => ({ at: [x * 0.375, 0.155 + y * 0.31, z * 0.275] as V3, push: [x * (0.3 + y * 0.35), 0, z * (0.3 + y * 0.4) + 0.15] as V3 }))));

/** Scene 1 — the agent tries to carve the thing itself, and it falls apart. */
export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const slow = wordAt("hook", "1c", 0);
  const pricey = wordAt("hook", "1c", 2);
  const fallen = f >= COLLAPSE;
  const shake = fallen ? Math.sin(f * 2.4) * 0.12 * (1 - prog(f, COLLAPSE, COLLAPSE + 18)) : 0;
  const cam = mix3([0.4, 3.4, 10.4], [1.1, 2.8, 8.4], eInOut(prog(f, 0, DURATIONS.hook)));
  const tokens = Math.round(prog(f, 0, DURATIONS.hook - 10) * 412_000).toLocaleString("en-US");
  const minutes = Math.floor(prog(f, 0, DURATIONS.hook - 10) * 23);
  const row = (on: boolean, at: number): React.CSSProperties => ({ padding: "2px 14px", background: on ? C.red : "transparent", color: on ? "#fff" : C.ink, scale: 1 + arc(f, at, 10, 0.12) });

  const bite = jolt(f, TAPS) * 0.07;
  const cracked = f >= STRIKES[5];
  const proud = f >= STRIKES[3] + 4 && f < STRIKES[4];
  const dropped = prog(f, COLLAPSE + 4, COLLAPSE + 16);
  const lean = cracked ? 0.06 + 0.2 * prog(f, STRIKES[5], STRIKES[5] + 5) : 0.06;

  return (
    <AbsoluteFill>
      <Stage cam={[cam[0] + shake, cam[1] + shake * 0.6, cam[2]]} target={[0.7, 1.35, 0]}>
        <Tree position={[-6, 0, -6]} />
        <Tree position={[7.5, 0, -8]} scale={1.3} color="#6dbb86" />
        <Tree position={[-9.5, 0, -10]} scale={1.5} />
        <Cloud position={[-7, 7.5, -14]} scale={1.4} />
        <Cloud position={[8, 8.5, -16]} scale={1.8} />

        <group position={[-1, 0, 0.5]} rotation={[0, 0.42, 0]}>
          <ToolBox position={[-1.9, 0, 0.3]} rotation={[0, 0.3, 0]} />
          <Critter
            steady
            armR={fallen ? Math.max(0, 0.9 - prog(f, COLLAPSE + 2, COLLAPSE + 12)) : swing(f, TAPS)}
            armL={fallen ? 0 : 0.2}
            eyes={fallen ? (f < COLLAPSE + 24 ? "wide" : "sad") : proud ? "happy" : f >= STRIKES[4] && f < STRIKES[4] + 12 ? "wide" : "open"}
            look={fallen ? [0.7, -0.7] : [0.9, 0.1]}
            hop={arc(f, COLLAPSE, 10, 0.5) + (proud ? arc(f, STRIKES[3] + 4, 8, 0.12) : 0)}
            squash={prog(f, COLLAPSE + 26, COLLAPSE + 44) * 0.55}
            pitch={prog(f, COLLAPSE + 26, COLLAPSE + 44) * 0.14}
            handR={dropped <= 0 ? <Mallet /> : null}
          >
            {f < COLLAPSE + 2 ? <Chisel position={[CHISEL.butt[0] + CHISEL.aim[0] * bite, CHISEL.butt[1] + CHISEL.aim[1] * bite, CHISEL.butt[2]]} rotation={[0, 0, CHISEL.angle]} /> : null}
          </Critter>
          {/* both tools end up on the floor */}
          {f >= COLLAPSE + 2 ? <Chisel {...tumble(f - COLLAPSE - 2, [CHISEL.butt[0], BODY_Y + CHISEL.butt[1], 0.04], 0.07, 21, [-0.25, 0, 0.5])} /> : null}
          {dropped > 0 ? <Mallet position={[1.5, Math.max(0.2, 1.3 - dropped * dropped * 1.1), 0.1 + dropped * 0.5]} rotation={[dropped * 1.57, 0.4, dropped * 0.4]} /> : null}

          <Stand position={[TIP[0] + 0.75 * SIZE, 0, 0]} w={2.2} d={1.7} h={STAND} />
          <group position={[TIP[0] + 0.75 * SIZE, STAND, 0]} scale={SIZE}>
            {/* the head it was trying to free: lopsided from the start */}
            <WonkyHead
              antenna={f < STRIKES[4]}
              position={fallen ? tumble(f - COLLAPSE, HEAD, rest(0.38), 9, [-0.1, 0, 1.25]).position : HEAD}
              // it rolls off and ends up on its side, still looking at you
              rotation={mix3([0, 0, lean], [-0.3, 0.25, 1.35], prog(f, COLLAPSE, COLLAPSE + 14))}
            />
            {f >= STRIKES[4] ? <Antenna {...tumble(f - STRIKES[4], [0.08, 1.45, 0], rest(0.06), 4, [0.55, 0, 0.75])} /> : null}
            {WASTE.map((chunk, i) => (
              <Box
                key={i}
                size={[0.75, i < 2 ? 0.6 : 0.68, 1.1]}
                color={STONE}
                // a corner breaks off, loses half its bulk on the way down and stays where it lands
                scale={1 - 0.45 * prog(f, STRIKES[i], STRIKES[i] + 8)}
                {...(f >= STRIKES[i] ? tumble(f - STRIKES[i], chunk.at, rest(0.2), i, chunk.push) : { position: chunk.at })}
              />
            ))}
            {fallen ? (
              BASE.map((piece, i) => <Box key={i} size={[0.75, 0.31, 0.55]} color={STONE} {...tumble(f - COLLAPSE, piece.at, 0.16, 30 + i, piece.push)} />)
            ) : (
              <Box size={[1.5, 0.62, 1.1]} position={[0, 0.31, 0]} color={STONE} />
            )}
            {cracked && !fallen
              ? [
                  [-0.2, 0.5, 0.5],
                  [-0.08, 0.36, -0.6],
                  [-0.16, 0.2, 0.4],
                ].map(([x, y, r], i) => <Box key={i} size={[0.05, 0.2, 0.02]} position={[x, y, 0.555]} rotation={[0, 0, r]} color={STONE_DARK} shadow={false} />)
              : null}
          </group>
          {TAPS.map((at, i) => (
            <Chips key={at} at={at} origin={TIP} seed={i} count={i === TAPS.length - 1 ? 12 : 6} dir={i === TAPS.length - 1 ? 0 : -1} />
          ))}
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
      {STRIKES.map((at) => (
        <Sfx key={at} at={at} name="mouse-click" volume={0.1} />
      ))}
      <Sfx at={COLLAPSE} name="whip" volume={0.3} />
      <Narration scene="hook" mark={["smart", "scratch", "slow", "expensive"]} />
    </AbsoluteFill>
  );
};
