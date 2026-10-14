import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, display, mono } from "../../theme";
import { Logo, SolanaMark } from "../../ui/Brand";
import { Narration, Pop, Sfx, hard } from "../../ui/Ui";
import { Host } from "../Host";
import { DEMO_CUES, demoWord } from "../timeline";
import { PromptChip } from "./D1Hook";

const FACTS = ["one command to connect", "pay per call, in USDC", "publish an API in a minute"];

/** Scene 9 — the name, the line, the address. */
export const D9Close: React.FC = () => {
  const f = useCurrentFrame();
  const line = demoWord("close", "d9a", 3);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.4}px ${-f * 0.2}px` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 130, display: "flex", justifyContent: "center" }}>{f >= 6 ? <Logo height={280} t={f - 6} /> : null}</div>
      <Pop at={line} rotate={-2} style={{ left: 0, right: 0, top: 452, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 92, letterSpacing: -4, color: C.paper, background: C.ink, padding: "4px 38px 14px" }}>Agents that hire.</div>
      </Pop>
      <div style={{ position: "absolute", left: 0, right: 0, top: 596, display: "flex", justifyContent: "center", gap: 20 }}>
        {FACTS.map((fact, i) => (
          <Pop key={fact} at={line + 22 + i * 8} rotate={i % 2 ? 1.5 : -1.5} style={{ position: "relative" }}>
            <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 32, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(7), padding: "8px 20px", whiteSpace: "nowrap" }}>{fact}</div>
          </Pop>
        ))}
      </div>
      {/* the whole product in one line: whatever you were going to ask, and two more words */}
      <Pop at={line + 40} rotate={1} style={{ left: 0, right: 0, top: 686, display: "flex", justifyContent: "center" }}>
        <PromptChip rialto at={line + 40} size={32} prompt="whatever you were going to ask" />
      </Pop>
      <Pop at={line + 62} rotate={-1} style={{ left: 0, right: 0, top: 790, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: mono, fontWeight: 800, fontSize: 50, color: C.ink, background: C.lime, border: `5px solid ${C.ink}`, boxShadow: hard(10), padding: "8px 30px" }}>
          galleriarialto.com
          <span style={{ background: C.ink, padding: "6px 12px", display: "flex" }}>
            <SolanaMark height={30} style={{ verticalAlign: 0 }} />
          </span>
        </div>
      </Pop>
      <Host x={0} beats={[10, line]} look={[0, 0]} wave scale={0.75} />
      <Sfx at={line} name="ding" volume={0.3} />
      <Narration cues={DEMO_CUES.close} captions={false} />
    </AbsoluteFill>
  );
};
