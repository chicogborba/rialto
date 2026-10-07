import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, bounce, eInOut, lerp, mix3, pop, prog } from "../lib/anim";
import { C, display } from "../theme";
import { DURATIONS, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Building, Cloud, Parcel, Stall, StreetClock, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, Sfx } from "../ui/Ui";

const Big: React.FC<{ children: React.ReactNode; bg: string }> = ({ children, bg }) => (
  <div style={{ fontFamily: display, fontWeight: 700, fontSize: 92, letterSpacing: -4, lineHeight: 1.1, color: C.ink, background: bg, border: `5px solid ${C.ink}`, padding: "0 30px 4px", boxShadow: `10px 10px 0 ${C.ink}`, whiteSpace: "nowrap" }}>{children}</div>
);

/** Scene 2 — the old trick: build it yourself (slow, costly) or hire a specialist (done). */
export const S2BuildOrHire: React.FC = () => {
  const f = useCurrentFrame();
  const hire = wordAt("buildOrHire", "2b", 3); // "Hire"
  const p = eInOut(prog(f, hire - 12, hire + 12));
  const cam = mix3([-5.2, 4.2, 15], [5.6, 4, 14], p);
  const target = mix3([-5.2, 1.9, 0], [5.4, 1.6, 0], p);
  const built = lerp(0.5, 2.0, prog(f, 0, DURATIONS.buildOrHire));
  const bills = 8 - Math.floor(prog(f, 10, hire - 10) * 7);
  const parcel = prog(f, hire + 14, hire + 30);

  return (
    <AbsoluteFill>
      <Stage cam={cam} target={target}>
        <Cloud position={[-12, 9, -16]} scale={1.6} />
        <Cloud position={[2, 10, -20]} scale={2} />
        <Cloud position={[14, 8.5, -15]} scale={1.5} />
        <Tree position={[-12.8, 0, -4.5]} scale={1.2} />
        <Tree position={[0.6, 0, -7]} scale={1.4} color="#6dbb86" />
        <Tree position={[11, 0, -5]} scale={1.2} />

        {/* BUILD: scaffolding, a clock that will not stop and a shrinking pile of cash */}
        <group position={[-5.5, 0, -1]}>
          <Building h={built} w={3} d={2.6} color="#c9c2b2" />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Box key={`${x}${z}`} size={[0.12, 5, 0.12]} position={[x * 1.8, 2.5, z * 1.6]} color="#8d6540" />))}
          {[1.5, 3, 4.5].map((y) => (
            <Box key={y} size={[3.72, 0.1, 0.12]} position={[0, y, 1.6]} color="#8d6540" />
          ))}
        </group>
        <StreetClock position={[-8.6, 0, -3]} minutes={f * 1.6} />
        <Critter position={[-2.6, 0, 1.8]} yaw={-0.75} scale={0.72} color="#8fa3c7" armL={Math.abs(Math.sin(f * 0.45))} eyes={f > 50 ? "sad" : "open"} look={[-0.6, 0.2]} seed={2} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} size={[1.0, 0.16, 0.56]} position={[-8.9, 0.08 + i * 0.17, 2.4]} rotation={[0, (i % 3) * 0.12, 0]} color={i % 2 ? "#57b96a" : "#6fd083"} scale={i < bills ? 1 : 0.001} />
        ))}

        {/* HIRE: a specialist stall, the parcel pops out and the job is simply done */}
        <Stall position={[5.6, 0, -0.6]} color={C.cyan} label="SPECIALIST ⭐" />
        <Critter position={[8.4, 0, 0.4]} yaw={-0.5} scale={0.72} color={C.mint} eyes="happy" armR={f > hire + 8 ? 1 : 0} hop={arc(f, hire + 24, 14, 0.5)} seed={5} />
        {f >= hire + 14 ? <Parcel position={[lerp(5.6, 4.3, parcel), 1.4 - parcel * 1.1 + arc(f, hire + 14, 16, 1.2), lerp(-0.4, 1.9, parcel)]} rotation={[0, f * 0.02, 0]} scale={pop(f, hire + 14, 8)} /> : null}
        {f >= hire + 30 ? (
          <group position={[2.2, 0, -4.2]} scale={[1, Math.max(0.001, bounce(prog(f, hire + 30, hire + 50))), 1]}>
            <Building h={4.6} w={2.8} d={2.6} color={C.lime} />
          </group>
        ) : null}
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
        <Chip>done ✓</Chip>
      </Pop>
      <Sfx at={hire - 12} name="whoosh" volume={0.14} />
      <Sfx at={hire + 30} name="ding" volume={0.16} />
      <Narration scene="buildOrHire" mark={["ages", "hire", "specialist"]} />
    </AbsoluteFill>
  );
};
