import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, rnd } from "../lib/anim";
import { C, display, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Box } from "../three/Props";
import { Stage } from "../three/Stage";
import { Chip, Pop, hard } from "../ui/Ui";

const PALETTE = [C.cyan, C.gold, C.lime, C.purple, C.mint, "#ffffff", C.red];

/** Scene 8 — logo, tagline, where to find it. */
export const S8Cta: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Stage cam={[0, 2.2, 11.5 - f * 0.006]} target={[0, 2.25, 0]}>
        {Array.from({ length: 30 }).map((_, i) => {
          const a = (i / 30) * Math.PI * 2 + f * 0.012;
          const r = 5.2 + rnd(i, 1) * 3.5;
          const size = 0.34 + rnd(i, 2) * 0.4;
          return <Box key={i} size={[size, size, size]} color={PALETTE[i % PALETTE.length]} position={[Math.sin(a) * r, size / 2 + arc((f + i * 7) % 60, 0, 22, 0.5 + rnd(i, 3)), Math.cos(a) * r * 0.5 - 2]} rotation={[0, a * 2, 0]} />;
        })}
        <Critter position={[0, 0, 1]} yaw={Math.sin(f * 0.05) * 0.2} eyes={f % 70 < 40 ? "happy" : "open"} armR={1} hop={arc(f, 10, 16, 0.8) + arc(f % 60, 30, 16, 0.35)} />
      </Stage>
      <Pop at={4} style={{ left: 0, right: 0, top: 64, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 230, letterSpacing: -12, lineHeight: 1, color: C.ink, background: C.lime, border: `8px solid ${C.ink}`, padding: "0 48px 12px", boxShadow: `18px 18px 0 ${C.ink}` }}>RIALTO</div>
      </Pop>
      <Pop at={20} rotate={-2} style={{ left: 0, right: 0, top: 338, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 86, letterSpacing: -3, color: C.paper, background: C.ink, padding: "4px 34px 10px" }}>Agents that hire.</div>
      </Pop>
      <Pop at={40} style={{ left: 96, top: 560, transformOrigin: "left center" }} rotate={-3}>
        <Chip size={34} bg="#fffdf7" fg={C.ink} style={{ boxShadow: hard(8) }}>🤖 Claude Code · Codex · MCP</Chip>
      </Pop>
      <Pop at={50} style={{ right: 96, top: 540, transformOrigin: "right center" }} rotate={3}>
        <Chip size={34} bg={C.purple} fg="#fff" style={{ boxShadow: hard(8) }}>◎ built for Solana · x402-style</Chip>
      </Pop>
      <Pop at={64} style={{ left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 44, color: C.ink, background: "#fffdf7", border: `6px solid ${C.ink}`, boxShadow: hard(10), padding: "14px 32px" }}>github.com/chicogborba/rialto</div>
      </Pop>
    </AbsoluteFill>
  );
};
