import type React from "react";
import { AbsoluteFill } from "remotion";
import { GAME_PAINT, RobotHero } from "./three/Sculpt";
import { Stage } from "./three/Stage";

/**
 * The asset the agent ends up buying: the robot hero, in colour, on a transparency checker.
 * Rendered once into public/hero.png (see README) and shown in scene 5.
 */
export const HeroCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#fffdf7", backgroundImage: "repeating-conic-gradient(#efe6d3 0% 25%, transparent 0% 50%)", backgroundSize: "100px 100px" }}>
    <Stage bare cam={[1.9, 2.3, 5.5]} target={[0, 1.42, 0]} fov={30}>
      <RobotHero paint={GAME_PAINT} plinth={false} rotation={[0, 0.16, 0]} />
    </Stage>
  </AbsoluteFill>
);
