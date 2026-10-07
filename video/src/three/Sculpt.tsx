import type React from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { c01, eOut, lerp, prog, rnd } from "../lib/anim";
import type { V3 } from "../lib/anim";
import { C } from "../theme";
import { Box } from "./Props";

/**
 * The sculptor's workshop: the stone, the tools and what comes out of it. Used for the opening
 * metaphor: carving it yourself goes wrong, the specialist gets it right in three taps.
 */

type G = { position?: V3; rotation?: V3; scale?: number | V3 };

export const STONE = "#bcc0c8";
export const STONE_DARK = "#7b808c";
const MARBLE = "#fbf7ee";
const STEEL = "#cfd6dc";
const WOOD_DARK = "#8d6540";

const Flat: React.FC<{ color: string }> = ({ color }) => <meshStandardMaterial color={color} flatShading />;
const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), c01(t)).getHexString()}`;

/** Wooden mallet. Origin at the grip, the handle runs along +x, the head strikes along -y. */
export const Mallet: React.FC<G> = (g) => (
  <group {...g}>
    <Box size={[0.62, 0.09, 0.09]} position={[0.25, 0, 0]} color={WOOD_DARK} />
    <group position={[0.56, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.44, 8]} />
        <Flat color="#e0b070" />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, k * 0.15, 0]}>
          <cylinderGeometry args={[0.195, 0.195, 0.07, 8]} />
          <Flat color={C.wood} />
        </mesh>
      ))}
    </group>
  </group>
);

/**
 * How the two tools meet. The critter swings the mallet with its right arm (Critter's `armR`, in
 * radians above level); at `HIT` the mallet's face lands on the butt of a chisel that points down
 * into the stone. All positions are in the critter's body space, for a critter of scale 1.
 */
export const HIT = 0.78;
const REST = 0.95;
const SHOULDER = [0.95, 0.02];
const AIM = [Math.sin(HIT), -Math.cos(HIT)];
const butt = [SHOULDER[0] + 0.86 * Math.cos(HIT) + 0.22 * AIM[0], SHOULDER[1] + 0.86 * Math.sin(HIT) + 0.22 * AIM[1]];
export const CHISEL = {
  butt: [butt[0], butt[1], 0.04] as V3,
  angle: HIT - Math.PI / 2,
  /** where the edge bites the stone */
  tip: [butt[0] + 0.68 * AIM[0], butt[1] + 0.68 * AIM[1], 0.04] as V3,
  /** unit vector along the blade */
  aim: AIM,
};
/** height of a scale-1 critter's body centre above the ground */
export const BODY_Y = 1.065;

/** `armR` for a mallet that lands on every frame in `strikes`; `wind` is how many frames it takes to wind up. */
export const swing = (f: number, strikes: number[], wind = 7): number => {
  for (const s of strikes) {
    if (f < s - wind - 2 || f >= s + wind - 1) continue;
    if (f < s - 2) return lerp(REST, 1.32, eOut(prog(f, s - wind - 2, s - 2)));
    if (f < s) return lerp(1.32, HIT, prog(f, s - 2, s) ** 2);
    return lerp(HIT, REST, eOut(prog(f, s, s + wind - 1)));
  }
  return REST;
};
/** how far the chisel is driven in on a strike (0..1, decays in a few frames) */
export const jolt = (f: number, strikes: number[]): number => strikes.reduce((m, s) => Math.max(m, f >= s ? 1 - prog(f, s, s + 4) : 0), 0);

/** Chisel. Origin at the butt of the handle, the blade points along +x. */
export const Chisel: React.FC<G & { color?: string }> = ({ color = "#e2553f", ...g }) => (
  <group {...g}>
    <mesh position={[0.025, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.05, 8]} />
      <Flat color={WOOD_DARK} />
    </mesh>
    <mesh position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.07, 0.075, 0.26, 8]} />
      <Flat color={color} />
    </mesh>
    <mesh position={[0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.075, 0.075, 0.06, 8]} />
      <Flat color={C.gold} />
    </mesh>
    <Box size={[0.3, 0.04, 0.13]} position={[0.5, 0, 0]} color={STEEL} />
    <Box size={[0.04, 0.04, 0.13]} position={[0.66, 0, 0]} color="#9aa5ae" shadow={false} />
  </group>
);

/** An open tool tote with a few more tools standing in it. */
export const ToolBox: React.FC<G> = (g) => (
  <group {...g}>
    <Box size={[1.1, 0.1, 0.56]} position={[0, 0.05, 0]} color={C.wood} />
    {[-1, 1].map((k) => (
      <Box key={k} size={[1.1, 0.3, 0.06]} position={[0, 0.2, k * 0.25]} color={C.wood} />
    ))}
    {[-1, 1].map((k) => (
      <Box key={k} size={[0.07, 0.62, 0.56]} position={[k * 0.52, 0.31, 0]} color={WOOD_DARK} />
    ))}
    <Box size={[1.04, 0.08, 0.08]} position={[0, 0.58, 0]} color={WOOD_DARK} />
    {/* a second chisel, a rasp and a brush */}
    <Chisel position={[-0.3, 0.86, 0.08]} rotation={[0, 0, -Math.PI / 2 + 0.16]} color={C.cyan} />
    <group position={[0.02, 0.1, -0.08]} rotation={[0, 0, -0.12]}>
      <Box size={[0.1, 0.5, 0.04]} position={[0, 0.5, 0]} color="#9aa5ae" />
      <Box size={[0.09, 0.26, 0.09]} position={[0, 0.88, 0]} color={C.gold} />
    </group>
    <group position={[0.3, 0.1, 0.06]} rotation={[0, 0, -0.22]}>
      <Box size={[0.07, 0.5, 0.07]} position={[0, 0.35, 0]} color={C.lime} />
      <Box size={[0.2, 0.05, 0.1]} position={[0, 0.62, 0]} color={STEEL} />
      <Box size={[0.2, 0.2, 0.1]} position={[0, 0.74, 0]} color="#3a332c" />
    </group>
  </group>
);

/** Low wooden stand the stone sits on. */
export const Stand: React.FC<G & { w?: number; h?: number; d?: number }> = ({ w = 1.9, h = 0.2, d = 1.5, ...g }) => (
  <group {...g}>
    <Box size={[w, h * 0.6, d]} position={[0, h * 0.3, 0]} color={WOOD_DARK} />
    <Box size={[w - 0.24, h * 0.4, d - 0.24]} position={[0, h * 0.8, 0]} color={C.wood} />
  </group>
);

/**
 * Stone chips knocked loose at frame `at`: they fly off from `origin`, land and (unless `tidy`)
 * stay where they fell. `dir` is -1 to throw them left, 1 right, 0 both ways.
 */
export const Chips: React.FC<{ at: number; origin: V3; seed: number; count?: number; color?: string; dir?: number; tidy?: boolean; size?: number }> = ({
  at,
  origin,
  seed,
  count = 6,
  color = STONE,
  dir = -1,
  tidy = false,
  size = 1,
}) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const t = (f - at) / 30;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const r = (n: number) => rnd(seed * 31 + i, n);
        const s = (0.07 + r(1) * 0.11) * size;
        const vx = (dir === 0 ? (r(2) - 0.5) * 2 : dir * (0.25 + r(2) * 0.75)) * 2.6;
        const vy = 1.6 + r(3) * 2.8;
        const vz = (r(4) - 0.35) * 2.6;
        const floor = s / 2;
        const land = (vy + Math.sqrt(vy * vy + 19.6 * Math.max(0, origin[1] - floor))) / 9.8;
        const tt = Math.min(t, land);
        const gone = tidy ? c01((t - land) * 4) : 0;
        if (gone >= 1) return null;
        return (
          <Box
            key={i}
            size={[s, s * 0.8, s]}
            color={color}
            position={[origin[0] + vx * tt, Math.max(floor, origin[1] + vy * tt - 4.9 * tt * tt), origin[2] + vz * tt]}
            rotation={[tt * (4 + r(5) * 8), r(6) * 3, tt * (r(7) - 0.5) * 12]}
            scale={1 - gone}
          />
        );
      })}
    </>
  );
};

/**
 * Where a loose piece is `since` frames after it broke off: it is thrown sideways, tumbles and
 * comes to rest on the ground. `rest` is where it sat, `half` roughly half its height.
 */
export const tumble = (since: number, rest: V3, half: number, seed: number, push: V3 = [1, 0, 1]): { position: V3; rotation: V3 } => {
  const t = Math.max(0, since / 30);
  const tt = Math.min(t, Math.sqrt((2 * Math.max(0, rest[1] - half)) / 9.8) + 0.12);
  const spin = Math.min(t, tt + 0.1);
  return {
    position: [rest[0] + push[0] * 2.4 * tt, Math.max(half, rest[1] - 4.9 * tt * tt), rest[2] + push[2] * 2.2 * tt],
    rotation: [spin * (1.5 + rnd(seed, 5) * 3), rnd(seed, 3) * 0.6 * c01(t * 4) + spin * 1.6, spin * (rnd(seed, 6) - 0.5) * 5],
  };
};

/** The head the agent manages to carve: lopsided, cross-eyed, with an antenna that will not last. */
export const WonkyHead: React.FC<G & { antenna?: boolean }> = ({ antenna = true, ...g }) => (
  <group {...g}>
    <Box size={[0.8, 0.6, 0.62]} color={STONE} />
    <Box size={[0.13, 0.25, 0.04]} position={[-0.2, 0.05, 0.31]} color={STONE_DARK} shadow={false} />
    <Box size={[0.13, 0.15, 0.04]} position={[0.16, -0.02, 0.31]} rotation={[0, 0, 0.3]} color={STONE_DARK} shadow={false} />
    <Box size={[0.3, 0.05, 0.04]} position={[0.02, -0.19, 0.31]} rotation={[0, 0, -0.16]} color={STONE_DARK} shadow={false} />
    {antenna ? <Antenna position={[0.08, 0.3, 0]} rotation={[0, 0, -0.18]} /> : null}
  </group>
);
export const Antenna: React.FC<G & { color?: string; tip?: string }> = ({ color = STONE, tip = STONE, ...g }) => (
  <group {...g}>
    <Box size={[0.07, 0.3, 0.07]} position={[0, 0.15, 0]} color={color} />
    <mesh position={[0, 0.36, 0]} castShadow>
      <icosahedronGeometry args={[0.1, 0]} />
      <Flat color={tip} />
    </mesh>
  </group>
);

/**
 * What the specialist delivers: a little robot hero, fists on hips, cape flying. Rough stone at
 * `polish` 0; white marble with gold details at 1. Stands on y = 0, faces +z, about 2.5 tall.
 */
export const HeroStatue: React.FC<G & { polish?: number }> = ({ polish = 1, ...g }) => {
  const body = mix(STONE, MARBLE, polish);
  const trim = mix(STONE, C.gold, polish);
  const dark = mix(STONE_DARK, "#2b2a35", polish);
  return (
    <group {...g}>
      <Box size={[1.2, 0.14, 0.84]} position={[0, 0.07, 0]} color={body} />
      {/* cape */}
      <Box size={[0.98, 1.2, 0.07]} position={[0, 1.1, -0.3]} rotation={[0.2, 0, 0]} color={mix(STONE, "#ff6b5e", polish)} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[0.27, 0.66, 0.32]} position={[side * 0.2, 0.47, 0]} color={body} />
          <Box size={[0.32, 0.14, 0.4]} position={[side * 0.2, 0.21, 0.03]} color={trim} />
          <Box size={[0.32, 0.24, 0.36]} position={[side * 0.55, 1.52, 0]} color={trim} />
          {/* upper arm out to the elbow, forearm back in to the hip */}
          <Box size={[0.19, 0.5, 0.22]} position={[side * 0.7, 1.24, 0]} rotation={[0, 0, side * 0.5]} color={body} />
          <Box size={[0.19, 0.46, 0.22]} position={[side * 0.66, 0.94, 0.02]} rotation={[0, 0, -side * 0.72]} color={body} />
        </group>
      ))}
      <Box size={[0.7, 0.18, 0.38]} position={[0, 0.86, 0]} color={dark} />
      <mesh position={[0, 1.3, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.62]} castShadow>
        <cylinderGeometry args={[0.6, 0.42, 0.72, 4]} />
        <Flat color={body} />
      </mesh>
      <Box size={[0.2, 0.2, 0.05]} position={[0, 1.38, 0.25]} rotation={[0, 0, Math.PI / 4]} color={trim} shadow={false} />
      <Box size={[0.22, 0.1, 0.22]} position={[0, 1.7, 0]} color={dark} />
      <Box size={[0.6, 0.48, 0.48]} position={[0, 1.98, 0]} color={body} />
      <Box size={[0.44, 0.15, 0.04]} position={[0, 2.01, 0.24]} color={dark} shadow={false} />
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.08, 0.2, 0.2]} position={[side * 0.34, 1.98, 0]} color={trim} />
      ))}
      <Antenna position={[0, 2.22, 0]} color={body} tip={trim} />
    </group>
  );
};

/** A four-point twinkle. `t` is seconds; each seed blinks on its own beat. */
export const Sparkle: React.FC<G & { t: number; seed: number; color?: string }> = ({ t, seed, color = "#ffc400", ...g }) => {
  const blink = Math.max(0, Math.sin(t * 5 + seed * 2.1));
  if (blink < 0.05) return null;
  return (
    <group {...g}>
      <group scale={blink} rotation={[0, 0, Math.sin(t * 2 + seed) * 0.3]}>
        {[
          [2.6, 0.34],
          [0.34, 2.6],
        ].map(([x, y]) => (
          <mesh key={x} scale={[x, y, 0.2]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
