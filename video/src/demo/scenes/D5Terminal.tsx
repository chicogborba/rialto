import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import build from "../../../public/demo/takes/term-rialto.json";
import { PURCHASES } from "../../demo";
import { prog, spring } from "../../lib/anim";
import { C, mono } from "../../theme";
import { Narration, Sfx, hard } from "../../ui/Ui";
import { BrowserShot, type Take } from "../Browser";
import { Host } from "../Host";
import { BUILD, DEMO_CUES, DEMO_DURATIONS } from "../timeline";

/**
 * Scene 5 — the customer's side, in a real terminal. This is a recording of an actual shell: the
 * connect command, then Claude Code, then the request for the game. Claude shops on Rialto for what
 * the game needs and pays for each call. Only the wait while it works is fast-forwarded, and the
 * scene says so; each purchase is named as it shows up in the terminal.
 */
export const D5Terminal: React.FC = () => {
  const f = useCurrentFrame();
  const fastForward = f >= BUILD.fastFrom && f < BUILD.fastTo;
  const bought = BUILD.buys.filter((at) => f >= at).length;
  // the newest purchases, newest at the bottom: the list scrolls like a till roll
  const shown = PURCHASES.slice(0, Math.min(bought, PURCHASES.length));
  const first = Math.max(0, shown.length - 8);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${f * 0.4}px ${-f * 0.25}px` }} />
      <BrowserShot
        name="term-rialto"
        take={build as unknown as Take}
        title="traffic-game — zsh"
        zoom={[
          // the command is the widest thing on screen: seen whole first, then in on the conversation
          [0, 1, 0, 0],
          [BUILD.paste + 40, 1, 0, 0],
          [BUILD.paste + 70, 1.34, 0, 0],
          [BUILD.ask - 10, 1.34, 0, 0],
          [BUILD.ask + 20, 1.34, 0, 0.12],
          [BUILD.fastFrom, 1.34, 0, 0.12],
          // while it works the whole window, so the tool calls can be seen going by
          [BUILD.fastFrom + 30, 1.12, 0, 0.5],
          [DEMO_DURATIONS.terminal, 1.12, 0, 0.5],
        ]}
      />
      {fastForward ? (
        <div style={{ position: "absolute", right: 250, top: 104, scale: spring(f - BUILD.fastFrom), fontFamily: mono, fontWeight: 800, fontSize: 40, color: C.ink, background: C.gold, border: `5px solid ${C.ink}`, boxShadow: hard(8), padding: "8px 22px", rotate: "2deg" }}>⏩ {BUILD.speed}× while Claude works</div>
      ) : null}
      {/* the till roll: what Claude has bought so far. It clears once Claude's own summary is on screen */}
      <div style={{ position: "absolute", right: 236, top: 206, width: 400, display: "flex", flexDirection: "column", gap: 10, opacity: 1 - prog(f, BUILD.fastTo + 14, BUILD.fastTo + 26) }}>
        {shown.slice(first).map((p, i) => {
          const at = BUILD.buys[first + i];
          return (
            <div key={`${p.what}-${first + i}`} style={{ scale: spring(f - at), transformOrigin: "right center", display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontWeight: 800, fontSize: 27, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(6), padding: "7px 14px", rotate: `${(first + i) % 2 ? -0.8 : 0.8}deg` }}>
              <span style={{ fontSize: 30 }}>{p.emoji}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.what}</span>
              <span style={{ background: C.lime, padding: "0 8px" }}>${p.usd.toFixed(p.usd < 0.1 ? 3 : 2)}</span>
            </div>
          );
        })}
      </div>
      <Host beats={[BUILD.paste + 50, BUILD.sent + 6, BUILD.fastTo + 10]} />
      <Sfx at={BUILD.paste} name="switch" volume={0.35} />
      <Sfx at={BUILD.sent} name="mouse-click" volume={0.45} />
      {BUILD.buys.slice(0, PURCHASES.length).map((at) => (
        <Sfx key={at} at={at} name="ding" volume={0.16} />
      ))}
      <Narration cues={DEMO_CUES.terminal} mark={["command", "claude", "ask", "rialto.", "shops", "art,", "music,", "sound", "paid", "usdc", "solana.", "sign-up", "key.", "card."]} />
    </AbsoluteFill>
  );
};
