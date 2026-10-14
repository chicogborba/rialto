import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { arc, prog } from "../lib/anim";
import { C, mono } from "../theme";
import { Critter } from "../three/Critter";
import { Stage } from "../three/Stage";
import { Narration, Sfx } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PROMPT = "make a pitch for our project. use Rialto.";
const STEPS = ["Reading the codebase", "Writing the script", "Building 3D scenes", "Recording the narrator"];

/** The laptop lid is shut; Claude takes the prompt and gets to work. Then the critter pops up. */
export const S0Boot: React.FC = () => {
  const f = useCurrentFrame();
  const typed = Math.floor(interpolate(f, [2, 16], [0, PROMPT.length], clamp));
  const up = interpolate(f, [20, 34], [0, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: "absolute", left: 150, top: 110, right: 150, fontFamily: mono, fontWeight: 800, fontSize: 52, lineHeight: 1.5, color: C.paper }}>
        <div>
          <span style={{ color: C.orange }}>✻ claude </span>
          <span style={{ color: C.lime }}>&gt; </span>
          {PROMPT.slice(0, typed)}
          {f < 18 ? <span style={{ display: "inline-block", width: 24, height: 50, background: C.lime, verticalAlign: "text-bottom" }} /> : null}
        </div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 500 }}>
          {STEPS.map((step, i) => {
            const start = 18 + i * 6;
            if (f < start) return null;
            const done = f >= start + 6;
            return (
              <div key={step} style={{ opacity: prog(f, start, start + 3), color: done ? C.paper : C.grey }}>
                <span style={{ color: done ? C.lime : C.gold }}>{done ? "✓" : "●"}</span> {step}
                {done ? null : "…"}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, translate: `0 ${(1 - up) * 620}px` }}>
        <Stage bare cam={[0, 2.0, 9.4]} target={[0, 2.5, 0]}>
          <Critter position={[3.3, 0, 0]} scale={1.15} yaw={-0.3} eyes={f > 30 ? "happy" : "open"} armR={f > 28 ? 1 : 0} hop={arc(f, 34, 16, 0.6)} />
        </Stage>
      </div>
      {STEPS.map((_, i) => (
        <Sfx key={i} at={24 + i * 6} name="mouse-click" volume={0.3} />
      ))}
      <Narration scene="boot" captions={false} />
    </AbsoluteFill>
  );
};
