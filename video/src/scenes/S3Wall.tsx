import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { arc, bounce, prog } from "../lib/anim";
import { C, display, mono } from "../theme";
import { CUES, wordAt } from "../timeline";
import { Critter } from "../three/Critter";
import { Box, Cloud, Label, Stall, Tree } from "../three/Props";
import { Stage } from "../three/Stage";
import { Narration, Pop, Sfx, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** each gate slams down on the word that names it: "sign-up", "credit card", "key" */
const STALLS = [
  { x: -4.4, label: "🎨 IMAGE API", gate: "SIGN UP", color: C.cyan, word: 4 },
  { x: 0, label: "🎙 VOICE API", gate: "CREDIT CARD", color: C.gold, word: 6 },
  { x: 4.4, label: "🧊 3D API", gate: "API KEY", color: C.purple, word: 9 },
];
const NOTES = ["Verify your email", "Add a payment method", "API key leaked"];

/** Scene 3 — every service wants a signup, a card and a key. The agent has none, so it bugs you. */
export const S3Wall: React.FC = () => {
  const f = useCurrentFrame();
  const lands = STALLS.map((s) => wordAt("wall", "3b", s.word));
  const turn = lands[2] + 18;
  const ask = CUES.wall["3c"];
  const x = interpolate(f, [0, 48, turn, turn + 34], [-8.5, 0, 0, -1.3], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const z = 1.3 + prog(f, lands[1], lands[1] + 8) * 0.7 + interpolate(f, [turn, turn + 34], [0, 1.2], clamp);
  // walks in sideways, turns to the stalls, glances at each gate as it lands, then turns to you
  const yaw = interpolate(f, [0, 46, 56, lands[0] - 10, lands[0] - 2, lands[1] - 10, lands[1] - 2, lands[2] - 10, lands[2] - 2, turn, turn + 14], [1.57, 1.57, 3.14, 3.14, 3.7, 3.7, 3.14, 3.14, 2.6, 2.6, 0], clamp);
  const flinch = lands.reduce((m, at) => m + arc(f, at, 12, 1), 0);
  const eager = f > 54 && f < lands[0] - 6;
  const late = f > turn;
  const moving = f < 48 || (f > turn + 4 && f < turn + 34) ? 1 : 0;
  const shake = lands.reduce((m, at) => m + (f >= at ? Math.sin(f * 2.6) * 0.1 * (1 - prog(f, at, at + 10)) : 0), 0);
  const zoom = prog(f, turn, turn + 40);

  return (
    <AbsoluteFill>
      <Stage cam={[x * 0.5 + shake, 4.6 - zoom * 0.5 + shake * 0.5, 13 - zoom * 1.8]} target={[x * 0.7 + zoom * 1.4, 1.5 - zoom * 0.9, -0.8 + zoom]}>
        <Cloud position={[-10, 9, -18]} scale={1.8} />
        <Cloud position={[9, 10, -20]} scale={2} />
        <Tree position={[-8.2, 0, -4.5]} scale={1.3} />
        <Tree position={[8.2, 0, -4.8]} scale={1.3} color="#6dbb86" />
        {STALLS.map((s, i) => (
          <group key={s.x}>
            <Stall position={[s.x, 0, -2.8]} color={s.color} label={s.label} />
            {f >= lands[i] - 4 ? (
              <group position={[s.x, 1.0 + (1 - bounce(prog(f, lands[i] - 4, lands[i] + 8))) * 9, -0.75]}>
                <Box size={[2.9, 2.0, 0.26]} color={C.red} />
                <Label text={s.gate} w={2.5} h={0.72} position={[0, 0.32, 0.14]} font={0.44} />
                <Label text="🔒" w={0.56} h={0.56} position={[0, -0.52, 0.14]} bg={C.red} border={false} font={0.8} />
              </group>
            ) : null}
          </group>
        ))}
        <Critter
          position={[x, 0, z]}
          yaw={yaw}
          walk={moving}
          hop={eager ? Math.abs(Math.sin((f - 54) * 0.35)) * 0.4 : arc(f, lands[1], 10, 0.45)}
          squash={Math.min(1, flinch) * 0.5}
          tilt={flinch * Math.sin(f * 1.6) * 0.08}
          eyes={flinch > 0.25 ? "shut" : eager ? "happy" : f > lands[1] ? "sad" : "open"}
          look={late ? [0, 0.3] : [0, 0]}
          armL={eager ? 1 : late && f > ask + 8 ? 0.5 : 0}
          armR={eager ? 1 : late && f > ask + 8 ? 0.5 : 0}
        />
      </Stage>

      <Pop at={ask + 6} style={{ left: 150, top: 300, transformOrigin: "bottom right" }} rotate={-3}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 48, color: C.ink, background: "#fffdf7", border: `4px solid ${C.ink}`, borderRadius: 30, boxShadow: hard(8), padding: "16px 30px" }}>uh… can I borrow your card?</div>
      </Pop>
      {NOTES.map((note, i) => {
        const at = ask + 16 + i * 10;
        const alert = i === NOTES.length - 1;
        return (
          <div
            key={note}
            style={{
              position: "absolute",
              right: 96,
              top: 104 + i * 92,
              fontFamily: mono,
              fontWeight: 800,
              fontSize: 30,
              color: alert ? "#fff" : C.ink,
              background: alert ? C.red : "#fffdf7",
              border: `4px solid ${C.ink}`,
              boxShadow: hard(6),
              padding: "16px 22px",
              width: 460,
              opacity: interpolate(f, [at, at + 5], [0, 1], clamp),
              translate: interpolate(f, [at, at + 12], ["600px 0px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.34, 1.4, 0.64, 1) }),
            }}
          >
            {note}
          </div>
        );
      })}
      {lands.map((at) => (
        <Sfx key={at} at={at} name="switch" volume={0.55} />
      ))}
      {NOTES.map((note, i) => (
        <Sfx key={note} at={ask + 16 + i * 10} name="mouse-click" volume={0.3} />
      ))}
      <Narration scene="wall" accent={C.red} mark={["cant", "hire", "sign-up", "credit", "card", "key", "bug", "you"]} />
    </AbsoluteFill>
  );
};
