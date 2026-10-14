import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CATALOG } from "../catalog";
import { eOut, prog, rnd, spring } from "../lib/anim";
import { C, display, mono } from "../theme";
import { CUES, wordAt } from "../timeline";
import { Logo } from "../ui/Brand";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

const AGENTS = ["Claude Code", "Codex", "any MCP agent"];
const HUB = { x: 800, y: 470 };
const LEFT_X = 330;
/** the API side: a grid that starts as a handful and ends as far more than fit the frame */
const COLS = 6;
const ROWS = 6;
const CELL = 112;
const GRID = { x: 1160, y: 150 };

/**
 * Scene 14 — who comes first and where it ends up, as one diagram: the agents people already use
 * plug into Rialto on the left; on the right the APIs behind it go from a few to every one there is.
 */
export const S14Vision: React.FC = () => {
  const f = useCurrentFrame();
  const goal = CUES.vision["14a"];
  const every = wordAt("vision", "14a", 2);
  const plugs = [wordAt("vision", "14d", 6), wordAt("vision", "14d", 9), wordAt("vision", "14d", 9) + 12];
  const cellAt = (i: number) => (i < 6 ? 30 + i * 6 : every + (i - 6) * 3);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.4}px ${f * 0.2}px` }} />

      {/* wires, drawn as each side connects, with payments running along them */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {AGENTS.map((_, i) => {
          const y = 300 + i * 170;
          const drawn = eOut(prog(f, plugs[i], plugs[i] + 14));
          const d = `M ${LEFT_X + 190} ${y} C ${LEFT_X + 330} ${y}, ${HUB.x - 230} ${HUB.y}, ${HUB.x - 110} ${HUB.y}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={C.ink} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} />
            </g>
          );
        })}
        {Array.from({ length: ROWS }).map((_, row) => {
          const y = GRID.y + row * CELL + CELL / 2 - 6;
          const at = cellAt(row * COLS);
          const drawn = eOut(prog(f, at - 6, at + 8));
          return <path key={row} d={`M ${HUB.x + 110} ${HUB.y} C ${HUB.x + 240} ${HUB.y}, ${GRID.x - 150} ${y}, ${GRID.x - 14} ${y}`} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} />;
        })}
      </svg>
      {/* coins along the wires: plain divs on a parametric path, so every frame is exact */}
      {AGENTS.map((_, i) => {
        if (f < plugs[i] + 14) return null;
        const t = ((f - plugs[i]) % 34) / 34;
        const y0 = 300 + i * 170;
        const x = LEFT_X + 190 + (HUB.x - 110 - LEFT_X - 190) * t;
        const y = y0 + (HUB.y - y0) * (t * t * (3 - 2 * t));
        return <div key={i} style={{ position: "absolute", left: x - 15, top: y - 15, width: 30, height: 30, borderRadius: 15, background: C.gold, border: `4px solid ${C.ink}` }} />;
      })}

      {AGENTS.map((name, i) => (
        <div key={name} style={{ position: "absolute", left: LEFT_X - 190, top: 300 + i * 170 - 48, width: 380, scale: spring(f - (10 + i * 6)), rotate: `${(i - 1) * -1.5}deg` }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 50, letterSpacing: -2, textAlign: "center", color: C.ink, background: f >= plugs[i] ? C.lime : "#fffdf7", border: `5px solid ${C.ink}`, boxShadow: hard(10), padding: "14px 10px 20px" }}>{name}</div>
        </div>
      ))}

      <div style={{ position: "absolute", left: HUB.x - 120, top: HUB.y - 120, width: 240, height: 240, scale: spring(f - 4) * (1 + Math.max(0, Math.sin(f * 0.35)) * 0.03), background: "#fffdf7", border: `7px solid ${C.ink}`, boxShadow: hard(16), display: "grid", placeItems: "center" }}>
        <Logo height={176} word={false} t={f - 4} />
      </div>

      {Array.from({ length: COLS * ROWS }).map((_, i) => {
        const at = cellAt(i);
        if (f < at) return null;
        const api = CATALOG[i % CATALOG.length];
        const hit = (f + i * 13) % 70 < 6;
        return (
          <div key={i} style={{ position: "absolute", left: GRID.x + (i % COLS) * CELL, top: GRID.y + Math.floor(i / COLS) * CELL, width: CELL - 16, height: CELL - 16, scale: spring(f - at) * (hit ? 1.12 : 1), rotate: `${(rnd(i, 1) - 0.5) * 6}deg`, background: hit ? C.lime : "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(6), display: "grid", placeItems: "center", fontSize: 50 }}>
            {api.emoji}
          </div>
        );
      })}

      <Pop at={6} out={goal - 8} rotate={-1.5} style={{ left: 110, top: 50, transformOrigin: "left top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 80, letterSpacing: -4, lineHeight: 1.05, color: C.paper, background: C.ink, padding: "6px 30px 14px" }}>First users: where agents already live</div>
      </Pop>
      <Pop at={goal + 4} rotate={-1.5} style={{ left: 110, top: 50, transformOrigin: "left top" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 80, letterSpacing: -4, lineHeight: 1.05, color: C.ink, background: C.lime, border: `6px solid ${C.ink}`, boxShadow: hard(12), padding: "2px 30px 10px" }}>The goal: every API, one call away</div>
      </Pop>
      <Pop at={every + 30} rotate={2} style={{ right: 90, top: 56, transformOrigin: "right center" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 40, color: C.ink, background: C.gold, border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "8px 22px" }}>…and counting</div>
      </Pop>
      {plugs.map((at, i) => (
        <Sfx key={i} at={at} name="switch" volume={0.4} />
      ))}
      <Sfx at={every} name="whoosh" volume={0.2} />
      <Narration scene="vision" mark={["first", "users?", "claude", "codex.", "every", "api", "agent."]} />
    </AbsoluteFill>
  );
};
