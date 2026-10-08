import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, pop, rnd } from "../lib/anim";
import { C, display } from "../theme";
import { wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box } from "../three/Props";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, hard } from "../ui/Ui";

const PALETTE = [C.cyan, C.gold, C.lime, C.purple, C.mint, "#ffffff", C.red];

/** Scene 8 — logo and tagline. Deliberately calm: nothing crosses the critter. */
export const S8Cta: React.FC = () => {
  const f = useCurrentFrame();
  const tagline = wordAt("cta", "8a", 1); // "Agents"
  return (
    <AbsoluteFill>
      <Stage cam={[0, 2.2, 11.6 - f * 0.005]} target={[0, 2.0, 0]}>
        {/* blocks resting on both sides and behind; they only bob a little */}
        {Array.from({ length: 26 }).map((_, i) => {
          const side = i % 2 ? 1 : -1;
          const size = 0.34 + rnd(i, 2) * 0.46;
          return (
            <Box
              key={i}
              size={[size, size, size]}
              color={PALETTE[i % PALETTE.length]}
              position={[side * (2.8 + rnd(i, 1) * 7.5), size / 2 + Math.max(0, Math.sin(f * 0.07 + i * 1.7)) * 0.22 * rnd(i, 3), -0.4 - rnd(i, 4) * 6]}
              rotation={[0, rnd(i, 5) * 3, 0]}
              scale={Math.max(0.001, pop(f, 2 + i * 1.2, 10))}
            />
          );
        })}
        <Critter position={[0, 0, 1]} scale={1.2} yaw={Math.sin(f * 0.04) * 0.12} eyes="happy" armR={1} hop={arc(f, 8, 16, 0.7)} squash={arc(f, tagline, 12, 0.35)} />
      </Stage>
      <Pop at={8} style={{ left: 0, right: 0, top: 48, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 220, letterSpacing: -12, lineHeight: 1, color: C.ink, background: C.lime, border: `7px solid ${C.ink}`, padding: "0 48px 12px", boxShadow: `16px 16px 0 ${C.ink}` }}>RIALTO</div>
      </Pop>
      <Pop at={tagline} rotate={-2} style={{ left: 0, right: 0, top: 312, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 84, letterSpacing: -3, color: C.paper, background: C.ink, padding: "4px 34px 10px" }}>Agents that hire.</div>
      </Pop>
      <Pop at={tagline + 34} style={{ left: 96, top: 560, transformOrigin: "left center" }} rotate={-3}>
        <Chip size={32} bg="#fffdf7" fg={C.ink} style={{ boxShadow: hard(6) }}>Claude Code · Codex · MCP</Chip>
      </Pop>
      <Pop at={tagline + 44} style={{ right: 96, top: 540, transformOrigin: "right center" }} rotate={3}>
        <Chip size={32} bg={C.purple} fg="#fff" style={{ boxShadow: hard(6) }}>◎ built for Solana · x402-style</Chip>
      </Pop>
      <Narration scene="cta" captions={false} />
    </AbsoluteFill>
  );
};
