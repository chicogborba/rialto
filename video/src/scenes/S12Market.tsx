import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { arc, pop, rnd, spring } from "../lib/anim";
import { C, display, mono } from "../theme";
import { CUES, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Cloud, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { SolanaTag } from "../ui/Brand";
import { Narration, Sfx, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CROWD = [C.orange, C.cyan, "#ff8fb3", C.gold, C.mint, C.orange, "#8fb4ff", C.cyan, "#ff8fb3", C.mint, C.gold, C.orange, "#8fb4ff", C.cyan];
/**
 * Public figures, each with where it comes from. Check them again before the pitch goes out:
 *  - ChatGPT weekly users: widely reported for 2026 (secondary sources; OpenAI's last own figure was lower)
 *  - Codex weekly users: OpenAI, 2 June 2026
 *  - x402 payments: x402.org dashboard, 30 days to 24 Aug 2026; Solana's share: Crypto Briefing, Aug 2026
 */
const STATS = [
  { big: "900M", line: "people use ChatGPT every week", source: "reported, 2026", bg: C.lime, word: 0 },
  { big: "5M+", line: "use Codex every week", source: "OpenAI, Jun 2026", bg: C.cyan, word: 8 },
  { big: "75M", line: "x402 payments in 30 days", source: "x402.org, Aug 2026", bg: C.gold, word: 16 },
] as const;

/** Scene 12 — the market, in numbers anyone can look up, and how Rialto earns from it. */
export const S12Market: React.FC = () => {
  const f = useCurrentFrame();
  const at = STATS.map((s) => wordAt("market", "12d", s.word));
  const solana = wordAt("market", "12d", 22);
  const model = CUES.market["12b"];
  const cut = wordAt("market", "12b", 8);
  const split = interpolate(f, [cut - 6, cut + 16], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const away = spring(f - (model - 10));
  return (
    <AbsoluteFill>
      <Stage cam={[0, 5.6 + f * 0.003, 14.2]} target={[0, 3.4, 0]}>
        <Cloud position={[-11, 10, -18]} scale={1.8} />
        <Cloud position={[10, 11, -20]} scale={2} />
        <Tree position={[-10, 0, -6]} scale={1.4} />
        <Tree position={[10.5, 0, -5]} scale={1.3} color="#6dbb86" />
        {/* the customers: more of them with every number */}
        {CROWD.map((color, i) => {
          const row = Math.floor(i / 5);
          const col = (i % 5) - 2 + (row % 2 ? 0.5 : 0);
          const enter = i < 4 ? 6 + i * 4 : i < 9 ? at[1] + (i - 4) * 4 : at[2] + (i - 9) * 4;
          return <Critter key={i} position={[col * 2.5, 0, 0.2 + row * 2]} scale={0.62 * Math.max(0.001, pop(f, enter, 10))} color={color} seed={i} yaw={(rnd(i, 3) - 0.5) * 0.4} eyes={f > model ? "happy" : "open"} armR={f > cut ? 1 : 0} hop={arc(f, enter, 14, 0.9) + arc(f, cut + i * 2, 12, 0.5)} />;
        })}
      </Stage>

      {/* three numbers, side by side, each slamming in on its word */}
      {STATS.map((s, i) =>
        f < at[i] ? null : (
          <div key={s.big} style={{ position: "absolute", left: 110 + i * 580, top: 70, width: 540, scale: spring(f - at[i]) * (1 - away * 0.999), rotate: `${(i - 1) * 2}deg`, transformOrigin: "center top" }}>
            <div style={{ border: `6px solid ${C.ink}`, boxShadow: hard(14), background: s.bg, padding: "6px 30px 22px" }}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 190, letterSpacing: -9, lineHeight: 1.05, color: C.ink }}>{s.big}</div>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 43, letterSpacing: -1.5, lineHeight: 1.1, color: C.ink }}>{s.line}</div>
              {i === 2 && f >= solana ? (
                <div style={{ marginTop: 12, fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: -1, display: "flex", alignItems: "center", gap: 12, scale: spring(f - solana), transformOrigin: "left center" }}>
                  ≈ 70% on <SolanaTag size={40} />
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 14, marginLeft: 6, fontFamily: mono, fontWeight: 800, fontSize: 22, color: "#6b6558" }}>source: {s.source}</div>
          </div>
        ),
      )}

      {/* the business model as one bar: the seller keeps its price, Rialto adds five percent on top */}
      {f >= model ? (
        <div style={{ position: "absolute", left: 260, right: 260, top: 110, scale: spring(f - model) }}>
          <div style={{ display: "flex", border: `6px solid ${C.ink}`, boxShadow: hard(12), height: 150, fontFamily: display, fontWeight: 700, fontSize: 62, letterSpacing: -2, color: C.ink, overflow: "hidden", background: C.ink }}>
            <div style={{ flex: 1, background: C.cyan, display: "flex", alignItems: "center", paddingLeft: 34 }}>the API keeps its price</div>
            <div style={{ width: 360 * split, background: C.lime, borderLeft: split > 0.02 ? `6px solid ${C.ink}` : "none", display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden" }}>+5% Rialto</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 26, opacity: f > cut + 14 ? 1 : 0 }}>
            <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 36, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "8px 22px", rotate: "-1deg" }}>every call = one sale · no subscriptions · no invoices</div>
          </div>
        </div>
      ) : null}
      {at.map((frame) => (
        <Sfx key={frame} at={frame} name="switch" volume={0.5} />
      ))}
      <Sfx at={solana} name="ding" volume={0.25} />
      <Sfx at={model} name="whoosh" volume={0.2} />
      <Narration scene="market" mark={["nine", "hundred", "million", "five", "seventy-five", "solana.", "sale,", "percent."]} />
    </AbsoluteFill>
  );
};
