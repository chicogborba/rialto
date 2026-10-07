import type React from "react";
import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import type { V3 } from "../lib/anim";

type G = { position?: V3; rotation?: V3; scale?: number | V3 };

export const Box: React.FC<G & { size: V3; color: string; shadow?: boolean; opacity?: number }> = ({ size, color, shadow = true, opacity = 1, ...g }) => (
  <mesh {...g} castShadow={shadow} receiveShadow={shadow}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} flatShading transparent={opacity < 1} opacity={opacity} />
  </mesh>
);

/** A flat sign with text (and emoji) drawn on a canvas texture. */
export const Label: React.FC<G & { text: string; w: number; h: number; bg?: string; fg?: string; font?: number; border?: boolean }> = ({
  text,
  w,
  h,
  bg = C.paper,
  fg = C.ink,
  font = 0.5,
  border = true,
  ...g
}) => {
  const texture = useMemo(() => {
    const px = 256;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (border) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = px * 0.09;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    let size = h * px * font;
    const face = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
    ctx.font = `900 ${size}px ${face}`;
    // shrink until the widest line fits
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (widest > canvas.width * 0.86) size *= (canvas.width * 0.86) / widest;
    ctx.font = `900 ${size}px ${face}`;
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * size * 1.15 + size * 0.04));
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [text, w, h, bg, fg, font, border]);
  return (
    <mesh {...g}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

/** Market stall: counter, posts, striped awning and a sign. */
export const Stall: React.FC<G & { color: string; label?: string; dim?: number }> = ({ color, label, dim = 0, ...g }) => {
  const tint = (hex: string) => `#${new THREE.Color(hex).lerp(new THREE.Color("#b9b2a3"), dim).getHexString()}`;
  return (
    <group {...g}>
      <Box size={[2.2, 0.95, 1.1]} position={[0, 0.475, 0]} color={tint(C.wood)} />
      <Box size={[2.36, 0.12, 1.26]} position={[0, 1.0, 0]} color={tint("#8d6540")} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.12, 1.5, 0.12]} position={[s * 1.02, 1.75, -0.4]} color={tint("#8d6540")} />
      ))}
      <group position={[0, 2.55, 0.05]} rotation={[0.32, 0, 0]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box key={i} size={[0.42, 0.1, 1.5]} position={[-1.05 + i * 0.42, 0, 0]} color={tint(i % 2 ? "#fffaf0" : color)} />
        ))}
      </group>
      {label ? <Label text={label} w={2.1} h={0.62} position={[0, 3.35, 0.2]} bg={tint(C.paper)} font={0.46} /> : null}
    </group>
  );
};

export const Tree: React.FC<G & { color?: string }> = ({ color = "#7fc96b", ...g }) => (
  <group {...g}>
    <Box size={[0.26, 0.8, 0.26]} position={[0, 0.4, 0]} color="#8d6540" />
    <mesh position={[0, 1.45, 0]} castShadow>
      <coneGeometry args={[0.85, 1.5, 6]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
    <mesh position={[0, 2.2, 0]} castShadow>
      <coneGeometry args={[0.6, 1.1, 6]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  </group>
);

export const Cloud: React.FC<G> = (g) => (
  <group {...g}>
    {[
      [0, 0, 0, 1],
      [1.1, -0.15, 0.1, 0.75],
      [-1.0, -0.2, -0.1, 0.65],
    ].map(([x, y, z, s], i) => (
      <mesh key={i} position={[x, y, z]} scale={s}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
    ))}
  </group>
);

export const Coin: React.FC<G & { spin?: number }> = ({ spin = 0, ...g }) => (
  <group {...g}>
    <mesh rotation={[Math.PI / 2, 0, spin]} castShadow>
      <cylinderGeometry args={[0.32, 0.32, 0.09, 10]} />
      <meshStandardMaterial color={C.gold} flatShading />
    </mesh>
  </group>
);

export const Parcel: React.FC<G> = (g) => (
  <group {...g}>
    <Box size={[0.8, 0.6, 0.6]} color="#d9a868" />
    <Box size={[0.16, 0.62, 0.62]} color={C.lime} shadow={false} />
  </group>
);

export const Magnifier: React.FC<G> = (g) => (
  <group {...g}>
    <mesh>
      <torusGeometry args={[0.26, 0.05, 6, 16]} />
      <meshBasicMaterial color={C.ink} />
    </mesh>
    <mesh>
      <circleGeometry args={[0.24, 16]} />
      <meshBasicMaterial color={C.cyan} transparent opacity={0.4} />
    </mesh>
    <mesh position={[0.22, -0.38, 0]} rotation={[0, 0, 0.5]}>
      <boxGeometry args={[0.09, 0.36, 0.09]} />
      <meshBasicMaterial color={C.ink} />
    </mesh>
  </group>
);

/** Clipboard whose checklist fills in with `checked` (0..5). */
export const Clipboard: React.FC<G & { checked: number }> = ({ checked, ...g }) => (
  <group {...g}>
    <Box size={[0.78, 1.0, 0.05]} color="#6b4a2f" shadow={false} />
    <Box size={[0.66, 0.84, 0.02]} position={[0, -0.03, 0.035]} color="#fffaf0" shadow={false} />
    <Box size={[0.3, 0.12, 0.07]} position={[0, 0.47, 0.03]} color={C.grey} shadow={false} />
    {[0, 1, 2, 3, 4].map((i) => {
      const k = Math.min(1, Math.max(0, checked - i));
      return (
        <group key={i} position={[0, 0.26 - i * 0.15, 0.05]}>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.34, 0.035, 0.01]} />
            <meshBasicMaterial color={C.grey} />
          </mesh>
          <mesh position={[-0.22, 0, 0]} scale={Math.max(0.001, k)}>
            <boxGeometry args={[0.1, 0.1, 0.012]} />
            <meshBasicMaterial color={i === 1 || i === 4 ? C.red : "#3fbf3f"} />
          </mesh>
        </group>
      );
    })}
  </group>
);

/** Confetti rain, a pure function of time `t` (seconds) and `amount` (0..1). */
export const Confetti: React.FC<G & { t: number; amount: number; count?: number }> = ({ t, amount, count = 60, ...g }) => {
  const palette = [C.lime, C.orange, C.cyan, C.gold, C.purple, "#ffffff"];
  const r = (i: number, n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  if (amount <= 0.01) return null;
  return (
    <group {...g}>
      {Array.from({ length: count }).map((_, i) => {
        const fall = (t * (0.3 + r(i, 1) * 0.35) + r(i, 2)) % 1;
        return (
          <mesh
            key={i}
            position={[(r(i, 3) - 0.5) * 9 + Math.sin(t * 2 + i) * 0.2, 6.5 - fall * 7, (r(i, 4) - 0.5) * 5]}
            rotation={[t * (2 + r(i, 5) * 4), t * (1 + r(i, 6) * 3), i]}
            scale={amount * (0.7 + r(i, 7) * 0.8)}
          >
            <boxGeometry args={[0.2, 0.2, 0.03]} />
            <meshBasicMaterial color={palette[i % palette.length]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Street clock on a pole. `minutes` drives both hands, so time can visibly fly. */
export const StreetClock: React.FC<G & { minutes: number }> = ({ minutes, ...g }) => {
  const minute = -(minutes / 60) * Math.PI * 2;
  const dark = "#3a332c";
  return (
    <group {...g}>
      <Box size={[0.62, 0.18, 0.62]} position={[0, 0.09, 0]} color={dark} />
      <Box size={[0.18, 3.3, 0.18]} position={[0, 1.8, 0]} color={dark} />
      <group position={[0, 4.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1, 1, 0.36, 28]} />
          <meshStandardMaterial color={dark} flatShading />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
          <cylinderGeometry args={[0.84, 0.84, 0.36, 28]} />
          <meshBasicMaterial color="#fffdf7" />
        </mesh>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const major = i % 3 === 0;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0.205]} rotation={[0, 0, -a]}>
              <boxGeometry args={[major ? 0.07 : 0.04, major ? 0.18 : 0.1, 0.01]} />
              <meshBasicMaterial color={C.ink} />
            </mesh>
          );
        })}
        <group rotation={[0, 0, minute / 12]} position={[0, 0, 0.215]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.1, 0.44, 0.01]} />
            <meshBasicMaterial color={C.ink} />
          </mesh>
        </group>
        <group rotation={[0, 0, minute]} position={[0, 0, 0.225]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.06, 0.64, 0.01]} />
            <meshBasicMaterial color={C.red} />
          </mesh>
        </group>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.23]}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 12]} />
          <meshBasicMaterial color={C.ink} />
        </mesh>
      </group>
    </group>
  );
};
