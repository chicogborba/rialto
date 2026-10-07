import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, eInOut, mix3, prog, rnd } from "../lib/anim";
import type { V3 } from "../lib/anim";
import { C, display } from "../theme";
import { wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Cloud, Stall, StreetClock, Tree } from "../three/Props";
import { BODY_Y, CHISEL, Chips, Chisel, HeroStatue, Mallet, STONE, STONE_DARK, Sparkle, Stand, ToolBox, WonkyHead, jolt, swing, tumble } from "../three/Sculpt";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, Sfx } from "../ui/Ui";

const Big: React.FC<{ children: React.ReactNode; bg: string }> = ({ children, bg }) => (
  <div style={{ fontFamily: display, fontWeight: 700, fontSize: 92, letterSpacing: -4, lineHeight: 1.1, color: C.ink, background: bg, border: `5px solid ${C.ink}`, padding: "0 30px 4px", boxShadow: `10px 10px 0 ${C.ink}`, whiteSpace: "nowrap" }}>{children}</div>
);

// Both workshops share one layout: the sculptor at the origin facing +z, the stone to its right.
const TIP: V3 = [CHISEL.tip[0], BODY_Y + CHISEL.tip[1], CHISEL.tip[2]];
const chisel = (bite: number, color?: string) => <Chisel color={color} position={[CHISEL.butt[0] + CHISEL.aim[0] * bite, CHISEL.butt[1] + CHISEL.aim[1] * bite, CHISEL.butt[2]]} rotation={[0, 0, CHISEL.angle]} />;

/** the amateur keeps tapping; on this tap the head comes off */
const TAPS = [8, 24, 40, 56, 72, 88, 104];
const OOPS = TAPS[3];
/** the specialist's block: two chunks wide, three rows tall, one row gone per tap */
const BLOCK = { w: 1.9, h: 2.85, d: 1.02 };
const ROWS = [2, 1, 0];
const STAND = 0.3;
/** the statue is modelled about 2.7 tall and drawn bigger than the sculptor */
const SIZE = 1.22;
const CENTRE = TIP[0] + (BLOCK.w / 2) * SIZE;

/** Scene 2 — the old trick: carve it yourself (slow, costly) or hire a specialist (done). */
export const S2BuildOrHire: React.FC = () => {
  const f = useCurrentFrame();
  const hire = wordAt("buildOrHire", "2b", 3); // "Hire"
  const p = eInOut(prog(f, hire - 12, hire + 12));
  const bills = 8 - Math.floor(prog(f, 10, hire - 10) * 7);

  /** three quick taps, and it is done */
  const strikes = [hire + 16, hire + 23, hire + 30];
  const done = strikes[2];
  const polish = prog(f, done, done + 9);
  const bow = prog(f, done + 6, done + 16);
  // pan from one workshop to the other, then lean in on the finished statue
  const near = eInOut(prog(f, done + 2, done + 40));
  const cam = mix3(mix3([-6.7, 3.9, 13], [6, 3.9, 13.4], p), [6.5, 3.3, 11], near);
  const target = mix3(mix3([-6.7, 1.6, 0], [6, 2, 0], p), [6.3, 2.1, 0], near);

  return (
    <AbsoluteFill>
      <Stage cam={cam} target={target}>
        <Cloud position={[-12, 9, -16]} scale={1.6} />
        <Cloud position={[2, 10, -20]} scale={2} />
        <Cloud position={[14, 8.5, -15]} scale={1.5} />
        <Tree position={[-14.2, 0, -4.5]} scale={1.2} />
        <Tree position={[0.6, 0, -7]} scale={1.4} color="#6dbb86" />
        <Tree position={[12.6, 0, -5]} scale={1.2} />

        {/* DIY: tap, tap, tap. The clock will not stop, the cash runs out and the head falls off anyway. */}
        <StreetClock position={[-5.6, 0, -4.2]} minutes={f * 1.6} />
        <group position={[-9.2, 0, 0.9]} rotation={[0, 0.36, 0]}>
          <Critter steady color="#8fa3c7" seed={2} armR={swing(f, TAPS)} armL={0.2} eyes={f > OOPS ? "sad" : "open"} look={[0.9, 0.1]} hop={arc(f, OOPS + 1, 8, 0.25)} handR={<Mallet />}>
            {chisel(jolt(f, TAPS) * 0.07, "#4f7cff")}
          </Critter>
          <Stand position={[TIP[0] + 0.9, 0, 0]} w={2.2} d={1.7} h={0.2} />
          <group position={[TIP[0] + 0.9, 0.2, 0]} scale={1.2}>
            <Box size={[1.5, 0.62, 1.1]} position={[0, 0.31, 0]} color={STONE} />
            {[
              [-0.2, 0.5, 0.5],
              [-0.08, 0.36, -0.6],
              [-0.16, 0.2, 0.4],
            ].map(([x, y, r], i) => (
              <Box key={i} size={[0.05, 0.2, 0.02]} position={[x, y, 0.555]} rotation={[0, 0, r]} color={STONE_DARK} shadow={false} />
            ))}
            <WonkyHead antenna={false} position={f >= OOPS ? tumble(f - OOPS, [0, 0.99, 0], 0.15, 9, [0.75, 0, 1.45]).position : [0, 0.99, 0]} rotation={mix3([0, 0, 0.14], [-0.3, 0.3, 1.4], prog(f, OOPS, OOPS + 14))} />
          </group>
          {/* what is left of the earlier tries */}
          {Array.from({ length: 9 }).map((_, i) => {
            const s = 0.3 + rnd(i, 1) * 0.36;
            return <Box key={i} size={[s * 1.3, s, s]} color={STONE} position={[TIP[0] + 2.6 + rnd(i, 2) * 1.5, s * 0.42, -0.9 + rnd(i, 3) * 1.9]} rotation={[rnd(i, 4), rnd(i, 5) * 3, rnd(i, 6)]} />;
          })}
          {TAPS.map((at, i) => (
            <Chips key={at} at={at} origin={TIP} seed={40 + i} count={5} />
          ))}
        </group>
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} size={[1.0, 0.16, 0.56]} position={[-2.5, 0.08 + i * 0.17, 2.7]} rotation={[0, (i % 3) * 0.12 + 0.3, 0]} color={i % 2 ? "#57b96a" : "#6fd083"} scale={i < bills ? 1 : 0.001} />
        ))}

        {/* HIRE: the sculptor. Three taps and the hero is standing there, polished. */}
        <Stall position={[6.5, 0, -2.8]} scale={1.5} color={C.cyan} label="SPECIALIST ⭐" />
        <group position={[2.9, 0, 1]} rotation={[0, 0.3, 0]}>
          <ToolBox position={[-1.9, 0, 0.5]} rotation={[0, 0.35, 0]} />
          <Critter
            beret
            moustache
            color="#fbf6ea"
            stripes="#2f4b8f"
            seed={7}
            steady={f < done + 6}
            yaw={-0.42 * bow}
            armR={f < done + 6 ? swing(f, strikes, 3) : 1}
            armL={0.2 + bow * 0.8}
            eyes={f >= done + 4 ? "happy" : "open"}
            look={[0.9 * (1 - bow), 0.1]}
            hop={arc(f, done + 8, 12, 0.35)}
            handR={<Mallet />}
          >
            {f < done + 6 ? chisel(jolt(f, strikes) * 0.07) : null}
          </Critter>
          <Stand position={[CENTRE, 0, 0]} w={BLOCK.w * SIZE + 0.5} d={1.9} h={STAND} />
          <group position={[CENTRE, STAND, 0]} scale={SIZE}>
            <HeroStatue polish={polish} scale={1 + arc(f, done, 10, 0.07)} />
            {ROWS.flatMap((row, k) =>
              [-1, 1].map((side) => (
                <Box
                  key={`${row}${side}`}
                  size={[BLOCK.w / 2, BLOCK.h / 3, BLOCK.d]}
                  position={[(side * BLOCK.w) / 4, (row + 0.5) * (BLOCK.h / 3), 0]}
                  color={STONE}
                  scale={Math.max(0.001, 1 - prog(f, strikes[k], strikes[k] + 3))}
                />
              )),
            )}
            {polish > 0
              ? [
                  [-1.15, 2.5, 0.5],
                  [1.2, 1.9, 0.5],
                  [-0.95, 1.0, 0.6],
                  [0.75, 2.95, 0.3],
                  [1.05, 0.6, 0.6],
                ].map(([x, y, z], i) => <Sparkle key={i} position={[x, y, z]} t={(f - done) / 30} seed={i} scale={1 + (i % 2) * 0.5} />)
              : null}
          </group>
          {strikes.map((at, k) => (
            <Chips key={at} at={at} origin={[CENTRE, STAND + (ROWS[k] + 0.5) * (BLOCK.h / 3) * SIZE, 0.4]} seed={70 + k} count={12} dir={0} size={1.6} tidy />
          ))}
        </group>
        <Critter position={[9.9, 0, 1.6]} yaw={-0.6} scale={0.86} color={C.mint} eyes={f >= done ? "happy" : f >= strikes[0] ? "wide" : "open"} look={[-0.8, 0.3]} armR={f > done + 2 ? 1 : 0} hop={arc(f, done + 4, 14, 0.5)} seed={5} />
      </Stage>

      <Pop at={10} out={hire - 14} style={{ left: 96, top: 92, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18, transformOrigin: "left top" }}>
        <Big bg="#fffdf7">Build it</Big>
        <div style={{ display: "flex", gap: 14 }}>
          <Chip>weeks</Chip>
          <Chip bg={C.red} fg="#fff">$$$</Chip>
        </div>
      </Pop>
      <Pop at={hire + 2} style={{ left: 96, top: 92, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18, transformOrigin: "left top" }}>
        <Big bg={C.lime}>Hire it</Big>
        {f >= done ? <Chip>done ✓</Chip> : <Chip bg="#fffdf7" fg={C.ink}>3 taps</Chip>}
      </Pop>
      {strikes.map((at) => (
        <Sfx key={at} at={at} name="mouse-click" volume={0.12} />
      ))}
      <Sfx at={hire - 12} name="whoosh" volume={0.14} />
      <Sfx at={done} name="ding" volume={0.16} />
      <Narration scene="buildOrHire" mark={["ages", "hire", "specialist"]} />
    </AbsoluteFill>
  );
};
