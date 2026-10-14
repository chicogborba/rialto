import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { arc, eInOut, eOut, pop, prog, rnd } from "../lib/anim";
import { Avatar, TEAM } from "../team/Team";
import { C, display, mono } from "../theme";
import { CUES, wordAt } from "../timeline";
import { Box, Cloud, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Logo } from "../ui/Brand";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

/** where each one stands in the scene, and where that is on screen (the camera does not move) */
const SPOTS = [
  { x: -4.4, px: 423 },
  { x: 0, px: 960 },
  { x: 4.4, px: 1497 },
];
const HEAD_Y = 590;
/** where the skills pour in: the R of the logo that comes out */
const CENTRE = { x: 637, y: 195 };
const TAGS = TEAM.flatMap((member, m) => member.skills.map((text, k) => ({ text, m, k, color: member.color, i: m * 10 + k })));
const SPARKS = [C.lime, C.cyan, C.gold, "#ff8fb3", C.orange, C.purple];

/**
 * Scene 13 — the team. Three people, one line each would be slow: instead their skills fly out of
 * them as tags, swirl together in the middle of the frame and come out as the product.
 */
export const S13Team: React.FC = () => {
  const f = useCurrentFrame();
  const burst = CUES.team["13f"];
  const logo = wordAt("team", "13g", 7);
  const mixFrom = logo - 46;
  const mix = eInOut(prog(f, mixFrom, logo));

  return (
    <AbsoluteFill>
      <Stage cam={[0, 3.6, 13.6]} target={[0, 2.6, 0]}>
        <Cloud position={[-12, 11, -18]} scale={1.8} />
        <Cloud position={[12, 12, -20]} scale={2} />
        <Tree position={[-9.6, 0, -6]} scale={1.5} />
        <Tree position={[9.8, 0, -6]} scale={1.4} color="#6dbb86" />
        {TEAM.map((member, i) => {
          const enter = 12 + i * 10;
          return (
            <group key={member.id} position={[SPOTS[i].x, 0, 0]}>
              <Box size={[2.9, 0.36, 1.9]} position={[0, 0.18, 0]} color={member.color} />
              <Box size={[3.1, 0.12, 2.1]} position={[0, 0.06, 0]} color={C.ink} />
              <Avatar who={member.id} position={[0, 0.36, 0]} scale={Math.max(0.001, pop(f, enter, 12))} yaw={(1 - i) * 0.2} look={[0, f > burst && f < logo ? 1 : 0]} eyes={f > logo ? "happy" : "open"} armR={(f > enter + 6 && f < enter + 50) || f > logo ? 1 : 0} armL={f > logo ? 1 : 0} hop={arc(f, enter, 16, 1) + arc(f, burst + i * 6, 14, 0.5) + arc(f, logo + i * 4, 16, 0.9)} />
            </group>
          );
        })}
      </Stage>

      <Pop at={wordAt("team", "13a", 4)} out={burst - 12} rotate={-2} style={{ left: 0, right: 0, top: 80, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 92, letterSpacing: -4, lineHeight: 1.05, color: C.ink, background: C.lime, border: `6px solid ${C.ink}`, boxShadow: hard(12), padding: "4px 34px 12px" }}>🎓 Computer Science · PUCRS 🇧🇷</div>
      </Pop>
      {TEAM.map((member, i) => (
        <Pop key={member.id} at={24 + i * 10} style={{ left: SPOTS[i].px - 200, width: 400, top: 800, display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 50, letterSpacing: -2, color: C.ink, background: member.color, border: `5px solid ${C.ink}`, boxShadow: hard(8), padding: "0 22px 5px" }}>{member.name}</div>
        </Pop>
      ))}

      {/* the skills: out of each of them, up into the air, then all into one point */}
      {TAGS.map((tag) => {
        const at = burst + tag.k * 5 + tag.m * 2;
        if (f < at || f > logo + 2) return null;
        const out = eOut(prog(f, at, at + 16));
        const restX = SPOTS[tag.m].px + (rnd(tag.i, 1) - 0.5) * 380;
        const restY = 90 + tag.k * 66 + (rnd(tag.i, 2) - 0.5) * 30;
        const x0 = SPOTS[tag.m].px + (restX - SPOTS[tag.m].px) * out;
        const y0 = HEAD_Y + (restY - HEAD_Y) * out + Math.sin(f * 0.09 + tag.i) * 7;
        // the mix: every tag spirals in toward the centre and shrinks away
        const turn = mix * (2.4 + rnd(tag.i, 3));
        const dx = x0 - CENTRE.x;
        const dy = y0 - CENTRE.y;
        const x = CENTRE.x + (dx * Math.cos(turn) - dy * Math.sin(turn)) * (1 - mix);
        const y = CENTRE.y + (dx * Math.sin(turn) + dy * Math.cos(turn)) * (1 - mix);
        return (
          <div key={tag.i} style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", rotate: `${(rnd(tag.i, 4) - 0.5) * 10 + mix * 200}deg`, scale: out * (1 - mix * 0.8), opacity: 1 - prog(f, logo - 6, logo + 2), fontFamily: mono, fontWeight: 800, fontSize: 30, color: C.ink, background: tag.color, border: `4px solid ${C.ink}`, boxShadow: hard(6), padding: "6px 16px", whiteSpace: "nowrap" }}>
            {tag.text}
          </div>
        );
      })}

      {/* what comes out */}
      {f >= logo
        ? Array.from({ length: 22 }).map((_, i) => {
            const k = eOut(prog(f, logo, logo + 26));
            const a = (i / 22) * Math.PI * 2 + rnd(i, 5);
            const r = (260 + rnd(i, 6) * 420) * k;
            return <div key={i} style={{ position: "absolute", left: CENTRE.x + Math.cos(a) * r * 1.5, top: CENTRE.y + Math.sin(a) * r * 0.7, width: 26, height: 26, background: SPARKS[i % SPARKS.length], border: `4px solid ${C.ink}`, rotate: `${f * 6 + i * 40}deg`, opacity: 1 - prog(f, logo + 16, logo + 34) }} />;
          })
        : null}
      {f >= logo ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", justifyContent: "center" }}>
          <Logo height={250} t={f - logo} />
        </div>
      ) : null}
      <Pop at={logo + 30} rotate={-2} style={{ left: 0, right: 0, top: 372, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 64, letterSpacing: -2, color: C.paper, background: C.ink, padding: "4px 30px 10px" }}>Agents that hire.</div>
      </Pop>
      {TEAM.map((member, i) => (
        <Sfx key={member.id} at={burst + i * 2} name="switch" volume={0.3} />
      ))}
      <Sfx at={mixFrom} name="whoosh" volume={0.25} />
      <Sfx at={logo} name="ding" volume={0.35} />
      <Narration scene="team" mark={["three", "pucrs,", "different", "skills.", "rialto."]} />
    </AbsoluteFill>
  );
};
