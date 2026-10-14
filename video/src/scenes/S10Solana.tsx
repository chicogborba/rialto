import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, bounce, eInOut, eOut, lerp, pop, prog } from "../lib/anim";
import { C, display, mono } from "../theme";
import { wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Cloud, Coin, Label, Stall, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { SolanaMark } from "../ui/Brand";
import { Chip, Narration, Pop, Sfx, hard } from "../ui/Ui";

/** Scene 10 — why Solana, in eight seconds: a card fee dwarfs the call it would pay for; Solana does not. */
export const S10Solana: React.FC = () => {
  const f = useCurrentFrame();
  const slam = wordAt("solana", "10e", 7); // "hundred"
  const go = wordAt("solana", "10e", 14); // "Solana"
  const fall = bounce(prog(f, slam - 14, slam + 10));
  const away = eInOut(prog(f, go - 8, go + 6));
  // second half: he runs the coin over to the stall himself
  const run = eOut(prog(f, go + 8, go + 30));
  const toss = prog(f, go + 30, go + 42);
  const paid = go + 42;
  const x = lerp(-4.6, 0.6, run);
  return (
    <AbsoluteFill>
      <Stage cam={[0, 3.4, 12.4 - f * 0.004]} target={[0, 1.7, 0]}>
        <Cloud position={[-10, 9, -18]} scale={1.8} />
        <Cloud position={[9, 10, -20]} scale={2} />
        <Tree position={[-8.5, 0, -6]} scale={1.4} />
        <Tree position={[9.5, 0, -7]} scale={1.5} color="#6dbb86" />
        <Critter position={[x, 0, 0.6]} yaw={run > 0 && run < 1 ? 1.1 : 0.35} walk={run > 0 && run < 1 ? 1 : 0} eyes={f > paid ? "happy" : f > slam && f < go ? "sad" : "open"} armR={f < go + 30 ? 1 : 0} steady hop={arc(f, paid, 16, 0.7)} look={[0.6, f > slam - 14 && f < go ? 0.8 : 0]}>
          {f < go + 30 ? <Coin position={[1.5, 0.5, 0.2]} spin={f * 0.3} rotation={[0, f * 0.12, 0]} /> : null}
        </Critter>
        {/* the card fee: a hundred times the thing being paid for */}
        {f >= slam - 14 && away < 1 ? (
          <group position={[2.6, lerp(13, 0, fall) - away * 0.2, 0]} scale={Math.max(0.001, 1 - away)}>
            <Box size={[4.2, 4.4, 1.3]} position={[0, 2.2, 0]} color="#8d929c" />
            <Box size={[4.24, 0.7, 1.34]} position={[0, 3.5, 0]} color="#3a3f4b" />
            <Label text="CARD FEE  $0.30" w={3.8} h={1.0} position={[0, 2.1, 0.67]} bg="#8d929c" fg={C.ink} border={false} font={0.4} />
          </group>
        ) : null}
        {f >= go ? (
          <group position={[4.4, 0, -0.4]} rotation={[0, -0.4, 0]} scale={Math.max(0.001, pop(f, go + 2, 12))}>
            <Stall color={C.cyan} label="API" />
          </group>
        ) : null}
        {toss > 0 && toss < 1 ? <Coin position={[lerp(x + 1.4, 4.2, toss), 1.6 + Math.sin(toss * Math.PI) * 1.6, lerp(0.8, -0.2, toss)]} spin={f * 0.7} rotation={[0, f * 0.5, 0]} /> : null}
        {Array.from({ length: 3 }).map((_, i) =>
          run > 0.05 && run < 0.98 ? <Box key={i} size={[1.6 + i * 0.5, 0.08, 0.08]} position={[x - 1.9 - i * 0.3, 1.5 - i * 0.4, 0.6]} color={C.lime} shadow={false} /> : null,
        )}
      </Stage>
      <Pop at={8} out={go - 10} rotate={-3} style={{ left: 150, top: 150, transformOrigin: "left top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 96, letterSpacing: -4, lineHeight: 1.05, color: C.ink, background: C.lime, border: `6px solid ${C.ink}`, boxShadow: hard(12), padding: "4px 30px 10px" }}>1 call = $0.003</div>
      </Pop>
      <Pop at={slam + 4} out={go - 10} rotate={4} style={{ right: 170, top: 110, transformOrigin: "right top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 190, letterSpacing: -10, lineHeight: 1, color: "#fff", background: C.red, border: `7px solid ${C.ink}`, boxShadow: hard(14), padding: "0 36px 14px" }}>100×</div>
      </Pop>
      <Pop at={go + 2} rotate={-2} style={{ left: 130, top: 110, transformOrigin: "left top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 120, letterSpacing: -5, lineHeight: 1, color: "#fff", background: C.ink, border: `6px solid ${C.ink}`, boxShadow: `12px 12px 0 ${C.lime}`, padding: "4px 34px 14px", display: "flex", alignItems: "center", gap: 26 }}>
          <SolanaMark height={84} style={{ verticalAlign: 0 }} /> Solana
        </div>
      </Pop>
      {[
        ["≈ 1 second", wordAt("solana", "10e", 19), 150, 320, C.lime],
        ["fee < $0.001", wordAt("solana", "10e", 20), 480, 330, C.gold],
        ["x402 · USDC", paid + 8, 150, 430, "#fffdf7"],
      ].map(([text, at, left, top, bg], i) => (
        <Pop key={text} at={at as number} rotate={i % 2 ? 2 : -2} style={{ left: left as number, top: top as number, transformOrigin: "left top" }}>
          <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 44, color: C.ink, background: bg as string, border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "10px 22px" }}>{text}</div>
        </Pop>
      ))}
      <Pop at={paid} rotate={3} style={{ right: 150, top: 120, transformOrigin: "right top" }}>
        <Chip size={54} bg={C.lime} fg={C.ink} style={{ boxShadow: hard(8) }}>paid ✓</Chip>
      </Pop>
      <Sfx at={slam + 6} name="switch" volume={0.6} />
      <Sfx at={go + 8} name="whoosh" volume={0.2} />
      <Sfx at={paid} name="ding" volume={0.3} />
      <Narration scene="solana" accent={C.lime} mark={["solana?", "solana", "hundred", "second,", "free."]} />
    </AbsoluteFill>
  );
};
