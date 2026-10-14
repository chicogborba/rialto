import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { PromptChip } from "./demo/scenes/D1Hook";
import { C, display, mono } from "./theme";
import { Critter } from "./three/Critter";
import { Coin, Parcel, Stall, Tree } from "./three/Props";
import { Stage } from "./three/Stage";
import { Logo, SolanaMark } from "./ui/Brand";
import { hard } from "./ui/Ui";

/**
 * The covers of the two videos, as one composition of two frames (0: the pitch, 1: the demo), so
 * that they are a pair: the same paper, the same corner for the logo, the same label for what kind
 * of video it is, the same place for the headline. Render with
 *   npx remotion render Thumbs out/thumbs --sequence --image-format=png
 */
const Shell: React.FC<{ kind: string; length: string; accent: string; children: React.ReactNode }> = ({ kind, length, accent, children }) => (
  <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
    <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 4px, transparent 4px)`, backgroundSize: "52px 52px" }} />
    {/* a slab of colour behind the picture side */}
    <div style={{ position: "absolute", right: -260, top: -220, width: 1180, height: 1600, background: accent, border: `8px solid ${C.ink}`, rotate: "9deg" }} />
    <div style={{ position: "absolute", left: 84, top: 70 }}>
      <Logo height={112} />
    </div>
    <div style={{ position: "absolute", right: 70, top: 64, display: "flex", alignItems: "center", gap: 18, fontFamily: mono, fontWeight: 800, fontSize: 46, color: C.lime, background: C.ink, border: `6px solid ${C.ink}`, boxShadow: `10px 10px 0 #fffdf7`, padding: "8px 28px 10px", rotate: "2deg" }}>
      <span style={{ color: "#fffdf7" }}>▶</span> {kind} <span style={{ color: "#a9a394" }}>· {length}</span>
    </div>
    {children}
    <div style={{ position: "absolute", left: 84, bottom: 66, display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 40, color: C.ink, background: "#fffdf7", border: `6px solid ${C.ink}`, boxShadow: hard(9), padding: "6px 22px 8px" }}>galleriarialto.com</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: mono, fontWeight: 800, fontSize: 34, color: "#fffdf7", background: C.ink, border: `6px solid ${C.ink}`, padding: "9px 20px 11px" }}>
        paid on <SolanaMark height={30} style={{ verticalAlign: 0 }} /> Solana
      </div>
    </div>
  </AbsoluteFill>
);

const Headline: React.FC<{ top: number; size: number; lines: [string, boolean][] }> = ({ top, size, lines }) => (
  <div style={{ position: "absolute", left: 84, top, fontFamily: display, fontWeight: 700, fontSize: size, letterSpacing: size * -0.055, lineHeight: 0.98, color: C.ink }}>
    {lines.map(([text, marked]) => (
      <div key={text} style={{ whiteSpace: "nowrap", marginBottom: size * 0.08 }}>
        {marked ? <span style={{ background: C.lime, border: `7px solid ${C.ink}`, boxShadow: hard(12), padding: `0 ${size * 0.16}px ${size * 0.06}px`, display: "inline-block", rotate: "-1.5deg" }}>{text}</span> : text}
      </div>
    ))}
  </div>
);

/** The pitch: the critter at a stall, buying. */
const Pitch: React.FC = () => (
  <Shell kind="PITCH" length="2 MIN" accent={C.orange}>
    <Stage bare cam={[0, 3.4, 15.5]} target={[0, 2.5, 0]} fov={36}>
      <Tree position={[8.2, 0, -2.5]} scale={1.5} />
      <Stall position={[6.1, 0, -0.4]} rotation={[0, -0.42, 0]} scale={1.5} color={C.lime} label="APIs" />
      <Critter position={[2.3, 0, 1.2]} yaw={0.55} scale={1.45} eyes="happy" look={[1, 0.3]} armR={1} steady />
      <Coin position={[4.25, 4.3, 1]} rotation={[0.3, 0.6, 0.2]} scale={1.9} />
      <Parcel position={[5.2, 2.75, 1.3]} rotation={[0.2, 0.5, 0.1]} scale={1.15} />
    </Stage>
    <Headline top={258} size={182} lines={[["Agents", false], ["that hire.", true]]} />
    <div style={{ position: "absolute", left: 90, top: 720, width: 900, fontFamily: display, fontWeight: 700, fontSize: 54, letterSpacing: -2, lineHeight: 1.12, color: C.ink }}>
      The market where AI agents find, compare and pay for APIs.
    </div>
  </Shell>
);

const Shot: React.FC<{ src: string; left: number; top: number; height: number; rotate: number; lime?: boolean; tag: string; note: string }> = ({ src, left, top, height, rotate, lime = false, tag, note }) => (
  <div style={{ position: "absolute", left, top, rotate: `${rotate}deg` }}>
    <div style={{ height, aspectRatio: "2 / 3", border: `8px solid ${C.ink}`, boxShadow: lime ? `16px 16px 0 ${C.lime}, 16px 16px 0 8px ${C.ink}` : hard(16), background: C.ink, overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: lime ? "none" : "saturate(0.75)" }} />
    </div>
    <div style={{ position: "absolute", left: -26, bottom: -34, display: "flex", alignItems: "baseline", gap: 14, fontFamily: display, fontWeight: 700, fontSize: 64, letterSpacing: -3, color: C.ink, background: lime ? C.lime : "#fffdf7", border: `7px solid ${C.ink}`, boxShadow: hard(9), padding: "0 20px 6px", rotate: `${-rotate * 1.5}deg`, whiteSpace: "nowrap" }}>
      {tag}
      <span style={{ fontFamily: mono, fontWeight: 800, fontSize: 26, letterSpacing: 0 }}>{note}</span>
    </div>
  </div>
);

/** The demo: one request, the game an agent made alone and the game it made with Rialto. */
const Demo: React.FC = () => (
  <Shell kind="DEMO" length="2:24" accent={C.cyan}>
    <Shot src="demo/thumb-rialto.jpg" left={1350} top={190} height={690} rotate={4} lime tag="$1.08" note="art · music · voice" />
    <Shot src="demo/thumb-plain.jpg" left={1040} top={236} height={450} rotate={-5} tag="$0" note="boxes · silent" />
    <Stage bare cam={[0, 3.4, 15.5]} target={[0, 2.5, 0]} fov={36}>
      <Critter position={[0.72, 0, 5.6]} yaw={0.5} scale={0.6} eyes="happy" look={[1, 0.6]} armR={1} steady />
    </Stage>
    <Headline top={250} size={128} lines={[["Same prompt.", false], ["Two more words.", true]]} />
    <div style={{ position: "absolute", left: 88, top: 640, rotate: "-1deg" }}>
      <PromptChip rialto at={-100} size={34} prompt="Make a game" />
    </div>
    <div style={{ position: "absolute", left: 90, top: 760, width: 860, fontFamily: display, fontWeight: 700, fontSize: 46, letterSpacing: -1.8, lineHeight: 1.12, color: C.ink }}>
      Claude Code builds the same game twice. Once it can shop.
    </div>
  </Shell>
);

export const Thumbs: React.FC = () => (useCurrentFrame() === 0 ? <Pitch /> : <Demo />);
