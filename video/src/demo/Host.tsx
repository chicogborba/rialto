import type React from "react";
import { useCurrentFrame } from "remotion";
import { arc } from "../lib/anim";
import { Critter, type Eyes } from "../three/Critter";
import { Stage } from "../three/Stage";

/**
 * The critter who presents the demo: he stands at the bottom of the frame, in front of whatever
 * is on screen, and hops at the moments that matter (`beats`, in frames of the scene).
 */
export const Host: React.FC<{ x?: number; beats?: number[]; eyes?: Eyes; look?: [number, number]; scale?: number; wave?: boolean }> = ({ x = 7.9, beats = [], eyes = "open", look = [-0.8, 0.6], scale = 0.85, wave = false }) => {
  const f = useCurrentFrame();
  const hop = beats.reduce((m, at) => m + arc(f, at, 14, 0.55), 0);
  const happy = beats.some((at) => f >= at && f < at + 30);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Stage bare cam={[0, 2.2, 16]} target={[0, 4.9, 0]}>
        <Critter position={[x, 0, 0]} yaw={x > 0 ? -0.45 : 0.45} scale={scale} eyes={happy ? "happy" : eyes} look={look} hop={hop} armR={happy || wave ? 1 : 0} />
      </Stage>
    </div>
  );
};
