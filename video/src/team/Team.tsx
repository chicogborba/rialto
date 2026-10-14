import type React from "react";
import { C } from "../theme";
import { Critter, type CritterProps } from "../three/Critter";

/**
 * The three people behind Rialto, as critters. Each is one colour, one haircut and, for two of
 * them, a pair of glasses: nothing more. `skills` are the tags that fly out of each in the team scene.
 */
export const TEAM = [
  { id: "francisco", name: "Francisco", color: C.orange, skills: ["X-ray image analysis", "computer vision", "risk operations", "VC-backed startup", "full-stack", "3D & motion"] },
  { id: "rodrigo", name: "Rodrigo", color: C.cyan, skills: ["spokesman", "backend developer", "web3", "Apple Developer Academy", "pitching", "APIs"] },
  { id: "isadora", name: "Isadora", color: "#ff8fb3", skills: ["iOS developer", "market research", "marketing", "Apple Developer Academy", "HP · LIS project", "product"] },
] as const;
export type Member = (typeof TEAM)[number]["id"];

export const Avatar: React.FC<{ who: Member } & CritterProps> = ({ who, ...pose }) => {
  if (who === "francisco") return <Critter color={C.orange} hair="tied" hairColor="#8a5a3a" glasses="round" seed={1} {...pose} />;
  if (who === "rodrigo") return <Critter color={C.cyan} hair="quiff" hairColor="#2a211d" glasses="square" seed={2} {...pose} />;
  return <Critter color="#ff8fb3" hair="long" hairColor="#3b2a22" seed={3} {...pose} />;
};
