import { Video } from "@remotion/media";
import type React from "react";
import { useContext } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { DEMO_FOOTAGE, DEMO_NUMBERS, FEATURES, PROMPT, WITH_RIALTO } from "../../demo";
import { prog, spring } from "../../lib/anim";
import { C, display, mono } from "../../theme";
import { Logo } from "../../ui/Brand";
import { AudioFlags, Narration, Sfx, hard } from "../../ui/Ui";
import { Host } from "../Host";
import { DEMO_CUES, demoWord } from "../timeline";

const W = 836;
/** the games are upright: the film of each is 600 × 780 */
const H = 600;
const FRAME = Math.round((H * 600) / 780);

/** The request as it was typed. With Rialto, the two extra words arrive a moment later, as their own tag. */
export const PromptChip: React.FC<{ rialto?: boolean; at?: number; size?: number; prompt?: string }> = ({ rialto = false, at = 0, size = 21, prompt = PROMPT }) => {
  const f = useCurrentFrame();
  const tag = at + 14;
  return (
    <div style={{ display: "flex", alignItems: "center", width: "fit-content", fontFamily: mono, fontWeight: 800, fontSize: size, color: "#efe8d8", background: C.ink, border: `5px solid ${C.ink}`, boxShadow: rialto ? `7px 7px 0 ${C.lime}` : hard(7), padding: `${size * 0.42}px ${size * 0.75}px ${size * 0.5}px`, whiteSpace: "nowrap" }}>
      <span style={{ color: rialto ? C.lime : C.grey, marginRight: size * 0.5 }}>❯</span>
      {prompt}
      {rialto && f >= tag ? (
        <span style={{ display: "inline-block", color: C.ink, background: C.lime, marginLeft: size * 0.1, padding: `${size * 0.12}px ${size * 0.42}px ${size * 0.18}px`, scale: spring(f - tag), rotate: "-2deg", transformOrigin: "left center", boxShadow: `3px 3px 0 #efe8d8` }}>{WITH_RIALTO}</span>
      ) : null}
      {/* the cursor of a line that was just typed */}
      <span style={{ width: size * 0.5, height: size * 1.05, marginLeft: size * 0.3, background: rialto ? C.lime : C.grey, opacity: Math.floor(f / 9) % 2 ? 0.15 : 0.9 }} />
    </div>
  );
};

const Side: React.FC<{ at: number; x: number; which: "scratch" | "rialto"; rows: number }> = ({ at, x, which, rows }) => {
  const f = useCurrentFrame();
  const { sfx } = useContext(AudioFlags);
  if (f < at) return null;
  const footage = DEMO_FOOTAGE[which];
  const rialto = which === "rialto";
  return (
    <div style={{ position: "absolute", left: x, top: 148, width: W, scale: spring(f - at), rotate: rialto ? "0.8deg" : "-0.8deg" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: rialto ? "flex-end" : "flex-start" }}>
        <PromptChip rialto={rialto} at={at} />
      </div>
      <div style={{ display: "flex", gap: 24, flexDirection: rialto ? "row-reverse" : "row" }}>
        <div style={{ width: FRAME, height: H, flexShrink: 0, border: `6px solid ${C.ink}`, boxShadow: rialto ? `14px 14px 0 ${C.lime}, 14px 14px 0 6px ${C.ink}` : hard(14), background: C.ink, position: "relative", overflow: "hidden" }}>
          {/* each film carries the sound its game really made: none at all, when it made none */}
          {footage ? <Video src={staticFile(footage)} muted={!sfx} volume={0.22} loop objectFit="cover" style={{ width: "100%", height: "100%" }} /> : null}
          <div style={{ position: "absolute", left: 10, bottom: 10, fontFamily: mono, fontWeight: 800, fontSize: 20, color: rialto ? C.ink : "#efe8d8", background: rialto ? C.lime : "rgba(23,18,15,.82)", border: `3px solid ${C.ink}`, padding: "2px 10px" }}>{rialto ? "🔊 sound on" : "🔇 silent"}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }}>
          {/* the bill first */}
          {f >= rows ? (
            <div style={{ scale: spring(f - rows), border: `5px solid ${C.ink}`, boxShadow: hard(8), background: rialto ? C.lime : "#fffdf7", padding: "8px 18px 10px" }}>
              <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 21, color: rialto ? C.ink : "#6b6558", textTransform: "uppercase", letterSpacing: 1 }}>💸 total cost</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontFamily: display, fontWeight: 700, fontSize: 74, letterSpacing: -3, lineHeight: 1, color: C.ink }}>
                {DEMO_NUMBERS[which].cost}
                <span style={{ fontFamily: mono, fontWeight: 800, fontSize: 17, letterSpacing: 0, color: rialto ? C.ink : "#6b6558" }}>{rialto ? "24 calls, in USDC" : "nothing bought"}</span>
              </div>
            </div>
          ) : null}
          {/* then what a player gets for it */}
          {FEATURES.map((feature, i) => {
            const shown = rows + 10 + i * 5;
            const has = rialto ? feature.rialto : feature.scratch;
            return f < shown ? null : (
              <div key={feature.label} style={{ opacity: prog(f, shown, shown + 4), translate: `${(1 - spring(f - shown)) * (rialto ? -18 : 18)}px 0`, display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontWeight: 800, fontSize: 22, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, padding: "4px 12px 5px", whiteSpace: "nowrap" }}>
                <span style={{ width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 22, color: rialto ? C.ink : "#fffdf7", background: rialto ? C.lime : has ? C.grey : C.red, border: `3px solid ${C.ink}` }}>{rialto ? "✓" : has ? "~" : "✕"}</span>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.12 }}>
                  <span style={{ display: "block", textDecoration: !rialto && !has ? "line-through" : "none", color: !rialto && !has ? "#8c8676" : C.ink }}>{feature.label}</span>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 16, color: "#6b6558" }}>{has || "none"}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Scene 1 — the promise: the same request, made twice. Footage and facts come from src/demo.ts. */
export const D1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const that = DEMO_CUES.hook.d1b;
  const same = DEMO_CUES.hook.d1c;
  const name = demoWord("hook", "d1c", 7);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.6}px ${-f * 0.3}px` }} />
      <Side at={8} x={86} which="scratch" rows={same + 16} />
      <Side at={that} x={998} which="rialto" rows={same + 26} />
      {f >= same ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 26, display: "flex", justifyContent: "center", scale: spring(f - same) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26, fontFamily: display, fontWeight: 700, fontSize: 62, letterSpacing: -3, lineHeight: 1, color: C.ink, background: "#fffdf7", border: `6px solid ${C.ink}`, boxShadow: hard(12), padding: "14px 34px 16px" }}>
            Same agent. Same prompt. The difference:
            {f >= name ? <Logo height={72} t={f - name} /> : <span style={{ width: 258, height: 72 }} />}
          </div>
        </div>
      ) : null}
      <Host x={0} beats={[8, that, name]} look={[f < that ? -1 : 1, 1]} scale={0.62} />
      <Sfx at={8} name="switch" volume={0.4} />
      <Sfx at={that} name="ding" volume={0.3} />
      <Narration cues={DEMO_CUES.hook} captions={false} />
    </AbsoluteFill>
  );
};
