import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { spring } from "../lib/anim";
import { SolanaTag } from "../ui/Brand";
import { C, display, mono } from "../theme";
import { wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Stage } from "../three/Stage";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** the command the dashboard hands you, with the key cut short */
const COMMAND = 'claude mcp add --transport http rialto https://…/api/mcp --header "Authorization: Bearer rk_live_9f…"';
const ASK = "make a robot hero for my game";

const Step: React.FC<{ n: number; at: number; title: string; accent: string; x: number; children: React.ReactNode }> = ({ n, at, title, accent, x, children }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: 220, width: 560, scale: spring(f - at), rotate: `${(n - 2) * 1.4}deg` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
        <span style={{ width: 80, height: 80, flexShrink: 0, display: "grid", placeItems: "center", fontFamily: mono, fontWeight: 800, fontSize: 54, background: C.ink, color: accent }}>{n}</span>
        <span style={{ fontFamily: display, fontWeight: 700, fontSize: 46, letterSpacing: -2, lineHeight: 1, color: C.ink, background: accent, border: `5px solid ${C.ink}`, padding: "8px 20px 12px", whiteSpace: "nowrap" }}>{title}</span>
      </div>
      <div style={{ height: 350, border: `6px solid ${C.ink}`, boxShadow: hard(14), background: "#fffdf7", overflow: "hidden", position: "relative" }}>{children}</div>
    </div>
  );
};

/** Scene 6 — how little it takes: one command, a few dollars, a question. */
export const S6Setup: React.FC = () => {
  const f = useCurrentFrame();
  const paste = wordAt("setup", "6c", 4);
  const fund = wordAt("setup", "6c", 7);
  const ask = wordAt("setup", "6c", 11);
  const typed = Math.floor(interpolate(f, [paste + 6, paste + 30], [0, COMMAND.length], clamp));
  const balance = interpolate(f, [fund + 8, fund + 30], [0, 5], clamp);
  const asked = Math.floor(interpolate(f, [ask + 6, ask + 26], [0, ASK.length], clamp));
  const done = ask + 40;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.5}px ${f * 0.3}px` }} />
      <Pop at={4} rotate={-1.5} style={{ left: 0, right: 0, top: 60, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 104, letterSpacing: -5, lineHeight: 1, color: C.paper, background: C.ink, padding: "8px 40px 18px" }}>Up and running in a minute ⏱️</div>
      </Pop>

      <Step n={1} at={paste} title="Paste one command" accent={C.lime} x={80}>
        <div style={{ position: "absolute", inset: 0, background: C.ink, padding: "22px 24px", fontFamily: mono, fontWeight: 500, fontSize: 27, lineHeight: 1.45, color: C.paper, wordBreak: "break-all" }}>
          <span style={{ color: C.lime }}>$ </span>
          {COMMAND.slice(0, typed)}
          {typed < COMMAND.length ? <span style={{ display: "inline-block", width: 14, height: 28, background: C.lime, verticalAlign: "text-bottom" }} /> : null}
          {f > paste + 34 ? <div style={{ marginTop: 16, color: C.lime, fontWeight: 800 }}>✓ rialto connected · 7 tools</div> : null}
        </div>
      </Step>

      <Step n={2} at={fund} title="Add a few dollars" accent={C.gold} x={680}>
        <div style={{ padding: "26px 30px", fontFamily: mono, fontWeight: 800, color: C.ink }}>
          <div style={{ fontSize: 26, color: "#6b6558" }}>AGENT WALLET</div>
          <div style={{ fontSize: 104, lineHeight: 1.1 }}>${balance.toFixed(2)}</div>
          <div style={{ fontSize: 28, display: "flex", alignItems: "center", gap: 12 }}>
            USDC <SolanaTag size={26} />
          </div>
          <div style={{ marginTop: 26, fontSize: 24, color: "#6b6558" }}>SPENDING LIMIT · $1 / day</div>
          <div style={{ marginTop: 8, height: 22, border: `4px solid ${C.ink}`, background: "#fff" }}>
            <div style={{ width: `${interpolate(f, [fund + 14, fund + 34], [0, 20], clamp)}%`, height: "100%", background: C.gold }} />
          </div>
        </div>
      </Step>

      <Step n={3} at={ask} title="Just ask" accent={C.cyan} x={1280}>
        <div style={{ padding: "24px 26px", fontFamily: display, fontWeight: 700, fontSize: 36, letterSpacing: -1, color: C.ink }}>
          <div style={{ background: C.cyan, border: `4px solid ${C.ink}`, padding: "10px 18px 14px", marginLeft: 50, minHeight: 60 }}>{ASK.slice(0, asked)}</div>
          {[
            ["found 3 services", done - 14],
            ["hired Tripo 3D · $0.37", done - 6],
            ["done ✓", done + 4],
          ].map(([text, at]) =>
            f >= (at as number) ? (
              <div key={text} style={{ fontFamily: mono, fontWeight: 800, fontSize: 28, marginTop: 14, background: text === "done ✓" ? C.lime : "#fff", border: `4px solid ${C.ink}`, padding: "6px 14px", width: "fit-content", scale: spring(f - (at as number)), transformOrigin: "left center" }}>{text}</div>
            ) : null,
          )}
        </div>
      </Step>

      <div style={{ position: "absolute", inset: 0 }}>
        <Stage bare cam={[0, 2.2, 17]} target={[0, 4.4, 0]}>
          <Critter position={[0, 1.0, 0]} scale={0.8} eyes={f > done ? "happy" : "open"} armR={f > done ? 1 : 0} armL={f > done ? 1 : 0} look={[f < fund ? -1 : f < ask ? 0 : 1, 1]} hop={[paste, fund, ask, done].reduce((m, at) => m + Math.sin(Math.min(1, Math.max(0, (f - at) / 12)) * Math.PI) * 0.4, 0)} />
        </Stage>
      </div>
      {[paste, fund, ask].map((at) => (
        <Sfx key={at} at={at} name="switch" volume={0.45} />
      ))}
      <Sfx at={done + 4} name="ding" volume={0.3} />
      <Narration scene="setup" mark={["minute.", "one", "command.", "dollars.", "ask."]} />
    </AbsoluteFill>
  );
};
