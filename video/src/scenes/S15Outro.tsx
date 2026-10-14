import { Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { arc, pop, prog } from "../lib/anim";
import { Avatar, TEAM } from "../team/Team";
import { Logo, SolanaMark } from "../ui/Brand";
import { C, display, mono } from "../theme";
import { Stage } from "../three/Stage";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** the recording runs this long; after that its last frame stays up */
const CLIP = 116;
/** when the recording steps aside to make room for the closing card */
const ASIDE = 78;
const FACTS = [
  ["🤖", "Claude Code · Codex · any MCP agent"],
  ["sol", "x402 payments · USDC on Solana"],
  ["🔌", "publish your API in 3 steps"],
  ["⚡", "paid in about a second · fee under 1¢"],
];

/** The lid opens again: the three of them, having watched it. The picture steps aside and the closing card builds up next to it. */
export const S15Outro: React.FC = () => {
  const f = useCurrentFrame();
  const aside = interpolate(f, [ASIDE, ASIDE + 26], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  const first = 104;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.4}px ${-f * 0.2}px` }} />
      <div style={{ position: "absolute", left: 285 - aside * 215, top: 90 + aside * 150, width: 1350, height: 900, scale: (1 - aside * 0.42) * interpolate(f, [0, 14], [1.12, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }), transformOrigin: "left top", rotate: `${-1.2 - aside * 1.8}deg` }}>
        <div style={{ position: "absolute", inset: 0, border: `8px solid ${C.ink}`, boxShadow: `22px 22px 0 ${C.lime}, 22px 22px 0 8px ${C.ink}`, overflow: "hidden", background: "#000" }}>
          {f < CLIP - 1 ? <Video src={staticFile("clips/after.mp4")} objectFit="cover" style={{ width: "100%", height: "100%" }} /> : <Img src={staticFile("clips/after-last.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <Pop at={30} rotate={-3} style={{ left: -60, bottom: -40, transformOrigin: "left bottom" }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 96, letterSpacing: -4, lineHeight: 1.05, color: C.ink, background: C.lime, border: `6px solid ${C.ink}`, boxShadow: hard(12), padding: "4px 34px 12px", whiteSpace: "nowrap" }}>“I told you guys.”</div>
        </Pop>
      </div>

      {/* the three of them, as they appear in the pitch, under their own picture */}
      {f >= first + 88 ? (
        <Stage bare cam={[0, 2.4, 16]} target={[0, 4.2, 0]}>
          {TEAM.map((m, i) => (
            <Avatar key={m.id} who={m.id} position={[-7.2 + i * 2.5, 0, 0]} scale={0.85 * Math.max(0.001, pop(f, first + 90 + i * 4, 10))} eyes="happy" armR={1} hop={arc(f, first + 90 + i * 4, 14, 0.7)} />
          ))}
        </Stage>
      ) : null}

      {/* the closing card, one piece at a time */}
      {f >= first ? <Logo height={196} t={f - first} style={{ position: "absolute", left: 960, top: 66 }} /> : null}
      <Pop at={first + 30} rotate={-2} style={{ left: 968, top: 296, transformOrigin: "left top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 72, letterSpacing: -3, color: C.paper, background: C.ink, padding: "4px 30px 10px" }}>Agents that hire.</div>
      </Pop>
      {FACTS.map(([icon, text], i) => (
        <Pop key={text} at={first + 44 + i * 9} rotate={i % 2 ? 1 : -1} style={{ left: 970 + (i % 2) * 24, top: 440 + i * 92, transformOrigin: "left center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: mono, fontWeight: 800, fontSize: 33, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(7), padding: "8px 20px 8px 10px", whiteSpace: "nowrap" }}>
            <span style={{ width: 54, height: 54, display: "grid", placeItems: "center", fontSize: 32, background: icon === "sol" ? C.ink : C.lime, border: `3px solid ${C.ink}` }}>{icon === "sol" ? <SolanaMark height={26} style={{ verticalAlign: 0 }} /> : icon}</span>
            {text}
          </div>
        </Pop>
      ))}
      <Pop at={first + 84} rotate={-1} style={{ left: 970, top: 826, transformOrigin: "left center" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 38, color: C.ink, background: C.gold, border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "8px 24px" }}>galleriarialto.com</div>
      </Pop>
      <div style={{ position: "absolute", left: 970, top: 930, fontFamily: mono, fontWeight: 800, fontSize: 24, color: C.ink, whiteSpace: "nowrap", opacity: prog(f, first + 100, first + 110) }}>github.com/chicogborba/rialto · Francisco, Rodrigo &amp; Isadora</div>
      <Sfx at={first} name="ding" volume={0.3} />
      <Narration scene="outro" captions={false} />
      {FACTS.map((_, i) => (
        <Sfx key={i} at={first + 44 + i * 9} name="switch" volume={0.3} />
      ))}
    </AbsoluteFill>
  );
};
