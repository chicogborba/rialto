import type React from "react";
import { useMemo } from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { arc, bounce, eInOut, eOut, lerp, mix3, pop, prog, rnd } from "../lib/anim";
import type { V3 } from "../lib/anim";
import { C, display } from "../theme";
import { Critter } from "../three/Critter";
import { CUES, DURATIONS, wordAt } from "../timeline";
import { Box, Coin, Label } from "../three/Props";
import { Stage } from "../three/Stage";
import { Narration, Pop, Sfx } from "../ui/Ui";

const PALETTE = [C.cyan, C.gold, C.lime, C.purple, C.orange, C.mint, "#ffffff", C.red];
const COUNT = 80;
const PAGE = "#fffaf0";
/** the directory the book opens on: one service per line, with its price per call */
const LISTING: [string, string, string][] = [
  [C.cyan, "Sprites", "$0.003"],
  [C.gold, "Voice", "$0.002"],
  [C.purple, "3D models", "$0.030"],
  [C.mint, "Search", "$0.001"],
  [C.orange, "Weather", "$0.001"],
  [C.red, "Maps", "$0.002"],
  [C.lime, "Stocks", "$0.004"],
];

/** A page of the directory, drawn once into a texture. */
const Listing: React.FC<{ w: number; h: number; position: V3 }> = ({ w, h, position }) => {
  const texture = useMemo(() => {
    const px = 256;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);
    const ctx = canvas.getContext("2d")!;
    const face = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = PAGE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const left = canvas.width * 0.09;
    const right = canvas.width * 0.91;
    ctx.fillStyle = C.ink;
    ctx.textBaseline = "middle";
    ctx.font = `900 ${px * 0.24}px ${face}`;
    ctx.fillText("APIs", left, px * 0.36);
    ctx.fillRect(left, px * 0.56, right - left, px * 0.035);
    LISTING.forEach(([color, name, price], i) => {
      const y = px * (0.98 + i * 0.44);
      ctx.fillStyle = color;
      ctx.fillRect(left, y - px * 0.12, px * 0.24, px * 0.24);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = px * 0.025;
      ctx.strokeRect(left, y - px * 0.12, px * 0.24, px * 0.24);
      ctx.fillStyle = C.ink;
      ctx.textAlign = "left";
      ctx.font = `900 ${px * 0.19}px ${face}`;
      ctx.fillText(name, left + px * 0.36, y + px * 0.01);
      const from = left + px * 0.44 + ctx.measureText(name).width;
      ctx.textAlign = "right";
      ctx.font = `900 ${px * 0.17}px ${face}`;
      ctx.fillText(price, right, y + px * 0.01);
      const to = right - ctx.measureText(price).width - px * 0.08;
      ctx.fillStyle = C.grey;
      for (let x = from; x < to; x += px * 0.09) ctx.fillRect(x, y + px * 0.05, px * 0.03, px * 0.03);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [w, h]);
  return (
    <mesh position={position}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

/**
 * The phone book: hard lime covers, a dark spine, a thick block of pages with index tabs and a
 * ribbon. `open` (0..1) swings the front cover aside. Centred on its page block, faces +z.
 */
const PhoneBook: React.FC<{ open: number }> = ({ open }) => (
  <group>
    {/* spine and back cover */}
    <Box size={[0.2, 4.5, 1.06]} position={[-1.7, 0, 0]} color={C.ink} />
    <Box size={[3.4, 4.5, 0.13]} position={[0.1, 0, -0.465]} color={C.lime} />
    {/* the pages: a little smaller than the covers, with a few sheets showing along the edge */}
    <Box size={[3.16, 4.24, 0.8]} position={[0.02, 0, 0]} color={PAGE} />
    {[-0.24, -0.08, 0.08, 0.24].map((z) => (
      <Box key={z} size={[0.02, 4.2, 0.03]} position={[1.605, 0, z]} color="#d8ccb2" shadow={false} />
    ))}
    {[C.cyan, C.gold, C.purple, C.orange, C.mint].map((color, i) => (
      <Box key={color} size={[0.2, 0.52, 0.1]} position={[1.68, 1.5 - i * 0.74, 0.27 - i * 0.135]} color={color} />
    ))}
    <Box size={[0.24, 1.1, 0.03]} position={[0.75, -2.5, 0.1]} rotation={[0, 0, 0.06]} color={C.red} />
    <Listing w={2.86} h={3.98} position={[0.02, 0, 0.405]} />
    {/* front cover, hinged on the spine */}
    <group position={[-1.6, 0, 0.465]} rotation={[0, -open * 2.2, 0]}>
      <Box size={[3.4, 4.5, 0.13]} position={[1.7, 0, 0]} color={C.lime} />
      <Box size={[0.36, 4.52, 0.15]} position={[0.17, 0, 0]} color={C.ink} />
      <Box size={[2.9, 4.1, 0.02]} position={[1.8, 0, -0.07]} color={PAGE} shadow={false} />
      {/* inside the cover: the wallet that comes with it, a pocket with a few coins in it */}
      <group position={[1.8, -0.75, -0.1]} rotation={[0, Math.PI, 0]}>
        {[-0.55, 0, 0.55].map((x, i) => (
          <mesh key={x} position={[x, 0.62 + (i % 2) * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.06, 14]} />
            <meshStandardMaterial color={C.gold} flatShading />
          </mesh>
        ))}
        <Box size={[2.3, 1.25, 0.08]} position={[0, 0, 0.03]} color="#d9a868" />
        <Label text="WALLET" w={1.5} h={0.46} position={[0, -0.1, 0.075]} bg={PAGE} font={0.5} />
      </group>
      <Label text={"THE API\nPHONE BOOK"} w={2.5} h={1.5} position={[1.86, 0.95, 0.07]} bg={PAGE} font={0.36} />
      {/* the critter's eyes, as the publisher's mark */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[1.86 + side * 0.42, -0.85, 0.07]}>
          <boxGeometry args={[0.22, 0.52, 0.02]} />
          <meshBasicMaterial color={C.ink} />
        </mesh>
      ))}
    </group>
  </group>
);

/** Scene 4 — the reveal: a giant phone book lands and a whole market pours out of it. */
export const S4Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const wallet = wordAt("reveal", "4b", 6); // "Wallet"
  const bg = interpolateColors(f, [14, 26], [C.ink, C.paper]);
  const ground = interpolateColors(f, [14, 26], ["#241c17", C.sand]);
  const drop = bounce(prog(f, 4, 34));
  const shake = Math.sin(f * 2.7) * 0.2 * (f > 14 ? 1 - prog(f, 15, 32) : 0);
  const open = eOut(prog(f, 50, 70));
  const cam = mix3([0, 3.4, 14], [0, 3.8, 12.2], eInOut(prog(f, 0, DURATIONS.reveal)));
  const cx = lerp(11, 4.2, eOut(prog(f, 62, 104)));

  return (
    <AbsoluteFill style={{ background: bg }}>
      <Stage cam={[cam[0] + shake, cam[1] + shake * 0.5, cam[2]]} target={[0, 2.9, 0]} bg={bg} ground={ground}>
        <group position={[0, 2.0 + (1 - drop) * 15, 0]} rotation={[0, -0.34, 0]} scale={0.88}>
          <PhoneBook open={open} />
        </group>
        {Array.from({ length: COUNT }).map((_, i) => {
          const start = 56 + i * 0.6;
          if (f < start) return null;
          const p = eOut(prog(f, start, start + 30));
          const a = (i / COUNT) * Math.PI * 2 + rnd(i, 1);
          const r = 3.6 + rnd(i, 2) * 8;
          const size = 0.34 + rnd(i, 3) * 0.46;
          return (
            <Box
              key={i}
              size={[size, size, size]}
              color={PALETTE[i % PALETTE.length]}
              position={[lerp(0.6, Math.sin(a) * r, p), lerp(2.4, size / 2, p) + Math.sin(p * Math.PI) * (3 + rnd(i, 4) * 3) + arc(f, start + 30, 8, 0.25), lerp(0.6, Math.cos(a) * r * 0.55 - 1, p)]}
              rotation={[(1 - p) * 6 * rnd(i, 5), rnd(i, 6) * 3 + (1 - p) * 4, 0]}
            />
          );
        })}
        {f > 60 ? (
          <Critter position={[cx, 0, 1.4]} yaw={-0.6} hop={f < 104 ? Math.abs(Math.sin(f * 0.32)) * 0.7 : arc(f, wallet - 6, 14, 0.9) + arc(f, wallet + 26, 14, 0.6)} eyes={f < 108 ? "wide" : "happy"} look={[-0.8, 0.5]} armL={f > 108 ? 1 : 0} armR={f > 108 ? 1 : 0} />
        ) : null}
        {/* "wallet included": he flips a coin */}
        {f >= wallet ? <Coin position={[cx + 1.3, 2.3 + Math.abs(Math.sin((f - wallet) * 0.16)) * 1.5, 1.4]} spin={f * 0.5} rotation={[0, f * 0.3, 0]} scale={Math.max(0.001, pop(f, wallet, 8)) * 1.7} /> : null}
      </Stage>

      <Pop at={CUES.reveal["4a"] + 8} style={{ left: 0, right: 0, top: 50, display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 200, letterSpacing: -10, lineHeight: 1, color: C.ink, background: C.lime, border: `8px solid ${C.ink}`, padding: "0 44px 10px", boxShadow: `16px 16px 0 ${C.ink}` }}>RIALTO</div>
      </Pop>
      <Sfx at={50} name="page-turn" volume={0.3} />
      <Sfx at={wallet} name="ding" volume={0.18} />
      <Narration scene="reveal" mark={["rialto", "phone", "book", "wallet", "included"]} />
    </AbsoluteFill>
  );
};
