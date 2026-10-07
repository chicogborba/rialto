import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import type { V3 } from "../lib/anim";

/**
 * The agent: a boxy low-poly critter. Stateless — the pose is a pure function of the props and the
 * current frame, so any frame can be rendered in isolation.
 */
export type Eyes = "open" | "happy" | "sad" | "shut" | "wide";
export interface CritterProps {
  position?: V3;
  /** 0 faces the camera (+z), PI/2 faces +x */
  yaw?: number;
  hop?: number;
  /** >0 squashes, <0 stretches */
  squash?: number;
  tilt?: number;
  pitch?: number;
  eyes?: Eyes;
  look?: [number, number];
  /** 0 = down, 1 = raised */
  armL?: number;
  armR?: number;
  /** 0..1 walking intensity */
  walk?: number;
  scale?: number;
  color?: string;
  seed?: number;
  /** props held in front of the body, in body space */
  children?: React.ReactNode;
}

const BODY = { w: 1.9, h: 1.25, d: 0.85 };
const LEG = { w: 0.17, h: 0.46, d: 0.17 };
const LEG_X = [-0.72, -0.44, 0.44, 0.72];
export const FACE_Z = BODY.d / 2 + 0.03;

const Mat: React.FC<{ color: string }> = ({ color }) => <meshStandardMaterial color={color} flatShading />;

export const Critter: React.FC<CritterProps> = ({
  position = [0, 0, 0],
  yaw = 0,
  hop = 0,
  squash = 0,
  tilt = 0,
  pitch = 0,
  eyes = "open",
  look = [0, 0],
  armL = 0,
  armR = 0,
  walk = 0,
  scale = 1,
  color = C.orange,
  seed = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + seed * 1.37;
  const sin = Math.sin;

  const breathe = sin(t * 2.1) * 0.018;
  const blink = t % 3.4 < 0.12 || (t + 1.7) % 7.3 < 0.1;
  const bob = walk * Math.abs(sin(t * 10)) * 0.1;
  const sx = 1 - breathe + squash * 0.28;
  const sy = 1 + breathe - squash * 0.36;
  const bodyY = LEG.h + (BODY.h / 2) * sy + hop + bob - 0.02;
  const ex = look[0] * 0.09;
  const ey = 0.13 + look[1] * 0.07;
  const eye = eyes === "open" && blink ? "shut" : eyes;

  return (
    <group position={position} scale={scale}>
      <group position={[0, bodyY, 0]} rotation={[pitch, yaw, tilt + walk * sin(t * 10) * 0.05]} scale={[sx, sy, sx]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
          <Mat color={color} />
        </mesh>
        {[-1, 1].map((side) => {
          const raise = side < 0 ? armL : armR;
          const wiggle = raise > 0.6 ? sin(t * 12 + side) * 0.18 : sin(t * 2.1) * 0.06;
          return (
            <group key={side}>
              <group position={[side * 0.47 + ex, ey, FACE_Z]}>
                {eye === "happy" ? (
                  [-1, 1].map((k) => (
                    <mesh key={k} position={[0, k * 0.085, 0]} rotation={[0, 0, k * side * 0.5]}>
                      <boxGeometry args={[0.34, 0.09, 0.06]} />
                      <meshBasicMaterial color={C.ink} />
                    </mesh>
                  ))
                ) : (
                  <mesh scale={[eye === "wide" ? 1.25 : eye === "shut" ? 1.8 : 1, eye === "wide" ? 1.25 : eye === "shut" ? 0.16 : eye === "sad" ? 0.72 : 1, 1]}>
                    <boxGeometry args={[0.17, 0.4, 0.06]} />
                    <meshBasicMaterial color={C.ink} />
                  </mesh>
                )}
                {eye === "sad" ? (
                  <mesh position={[0, 0.3, 0]} rotation={[0, 0, -side * 0.42]}>
                    <boxGeometry args={[0.36, 0.07, 0.06]} />
                    <meshBasicMaterial color={C.ink} />
                  </mesh>
                ) : null}
              </group>
              <group position={[side * (BODY.w / 2), 0.02, -0.08]} rotation={[0, 0, side * (raise * 1.0 + wiggle * (raise > 0.6 ? 1 : side))]}>
                <mesh position={[side * 0.15, 0, 0]} castShadow>
                  <boxGeometry args={[0.3, 0.4, 0.5]} />
                  <Mat color={color} />
                </mesh>
              </group>
            </group>
          );
        })}
        {children}
      </group>
      <group rotation={[0, yaw, 0]}>
        {[0.3, -0.3].map((z, row) =>
          LEG_X.map((x, i) => {
            const step = walk * Math.max(0, sin(t * 20 + ((i + row) % 2) * Math.PI)) * 0.16;
            const tuck = Math.min(0.35, hop * 0.4);
            return (
              <mesh key={`${row}-${i}`} position={[x, LEG.h / 2 + step + hop * 0.94 + bob * 0.5, z]} scale={[1, 1 - tuck, 1]} castShadow>
                <boxGeometry args={[LEG.w, LEG.h, LEG.d]} />
                <Mat color={color} />
              </mesh>
            );
          }),
        )}
      </group>
    </group>
  );
};
