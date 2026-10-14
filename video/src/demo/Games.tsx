import type React from "react";
import { arc, rnd } from "../lib/anim";
import { C, display, mono } from "../theme";

/** Stand-ins for the two builds of the game, until the real footage is named in src/demo.ts. */
export const Placeholder: React.FC = () => (
  <div style={{ position: "absolute", right: 10, bottom: 8, fontFamily: mono, fontSize: 17, fontWeight: 800, color: "#fff", background: "rgba(23,18,15,.72)", padding: "3px 9px" }}>stand-in · gameplay goes here</div>
);

/** What an agent ships on its own: grey boxes, twelve frames a second. */
export const ScratchGame: React.FC<{ f: number }> = ({ f }) => {
  const t = Math.floor(f / 5) * 5; // choppy on purpose
  const x = 90 + ((t * 3) % 560);
  const y = arc(t % 40, 0, 40, 90);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#a4a8ad", overflow: "hidden", fontFamily: '"Times New Roman", serif' }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "#777b80" }} />
      <div style={{ position: "absolute", left: x, bottom: 120 + y, width: 70, height: 70, background: "#5d6166", border: "2px solid #3d4043" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 220 + i * 200, bottom: 120, width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "60px solid #8b8f94" }} />
      ))}
      <div style={{ position: "absolute", left: 20, top: 14, fontSize: 34, color: "#33363a" }}>Score: 0&nbsp;&nbsp;&nbsp;hero_final2.obj (missing)</div>
      <div style={{ position: "absolute", right: 20, top: 14, fontSize: 30, color: "#b03030" }}>12 FPS</div>
    </div>
  );
};

/** The same prompt with specialists hired for the art, the voice and the music. */
export const RialtoGame: React.FC<{ f: number }> = ({ f }) => {
  const hop = arc(f % 34, 0, 34, 130);
  const squash = arc(f % 34, 30, 6, 0.18);
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#8fdcf2,#fdf3d6 78%)", overflow: "hidden", fontFamily: display }}>
      <div style={{ position: "absolute", right: 90, top: 50, width: 110, height: 110, borderRadius: 60, background: C.gold, boxShadow: `0 0 0 16px rgba(255,210,63,.3)` }} />
      {[0, 1].map((layer) =>
        [0, 1, 2, 3].map((i) => (
          <div key={`${layer}-${i}`} style={{ position: "absolute", left: ((i * 330 - f * (2 + layer * 3)) % 1320 + 1320) % 1320 - 260, bottom: 96, width: 380, height: 150 + layer * 40 + rnd(i, layer) * 80, borderRadius: "50% 50% 0 0", background: layer ? "#6dbb86" : "#a8dba0" }} />
        )),
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 100, background: "#7fc96b", borderTop: `8px solid ${C.ink}`, backgroundImage: "repeating-linear-gradient(90deg,transparent 0 60px,rgba(23,18,15,.12) 60px 120px)", backgroundPositionX: -f * 9 }} />
      {[0, 1, 2, 3, 4].map((i) => {
        const cx = ((i * 230 - f * 9) % 1150 + 1150) % 1150 - 100;
        const taken = cx < 250;
        return taken ? null : <div key={i} style={{ position: "absolute", left: cx, bottom: 210 + Math.sin(f * 0.2 + i) * 10, width: 46 * Math.abs(Math.cos(f * 0.16 + i)) + 6, height: 46, borderRadius: 23, background: C.gold, border: `4px solid ${C.ink}` }} />;
      })}
      {/* the hero: a proper character with a cape */}
      <div style={{ position: "absolute", left: 190, bottom: 100 + hop, width: 104, height: 84, scale: `${1 + squash} ${1 - squash}`, transformOrigin: "bottom" }}>
        <div style={{ position: "absolute", left: -34, top: 14, width: 50, height: 56, background: C.red, border: `4px solid ${C.ink}`, rotate: `${-18 - hop * 0.12}deg` }} />
        <div style={{ position: "absolute", inset: 0, background: "#4f7cff", border: `5px solid ${C.ink}` }} />
        <div style={{ position: "absolute", left: 52, top: 22, width: 12, height: 26, background: C.lime }} />
        <div style={{ position: "absolute", left: 76, top: 22, width: 12, height: 26, background: C.lime }} />
      </div>
      <div style={{ position: "absolute", left: 22, top: 16, fontWeight: 700, fontSize: 40, color: C.ink, background: C.lime, border: `4px solid ${C.ink}`, padding: "0 14px 3px" }}>★ {String(Math.floor(f / 3) * 10).padStart(5, "0")}</div>
      <div style={{ position: "absolute", right: 22, top: 20, fontFamily: mono, fontWeight: 800, fontSize: 26, color: C.ink }}>60 FPS</div>
    </div>
  );
};

