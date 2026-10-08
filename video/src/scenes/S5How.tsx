import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { arc, eInOut, keys3, lerp, pop, prog } from "../lib/anim";
import { C, display, mono } from "../theme";
import { Critter, FACE_Z } from "../three/Critter";
import { Clipboard, Cloud, Coin, Confetti, Magnifier, Parcel, Stall } from "../three/Props";
import { Stage } from "../three/Stage";
import { Chip, Narration, Pop, Sfx, hard } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Seven stalls with room to breathe; every other one sells what the agent is after.
const STALLS = ["🌦 WEATHER", "🎨 PIXELFORGE", "📈 STOCKS", "🖼 SPRITELAB", "🗺 MAPS", "🎮 SPRITEFORGE", "🎙 VOICE"];
const COLORS = [C.cyan, C.purple, C.gold, C.orange, C.mint, C.lime, C.gold];
const CANDIDATES = [1, 3, 5];
const WINNER = 5;
const place = (k: number) => {
  const a = ((-69 + k * 23) * Math.PI) / 180;
  return { a, x: Math.sin(a) * 8.4, z: -Math.cos(a) * 8.4 + 1.2 };
};
/** the agent stands a little back from the camera so the caption never covers it */
const HOME_Z = -1.4;
/** each card hangs over its own stall */
const CARDS = [
  { name: "PixelForge", price: "$0.012", speed: "4.1s", trust: "92", left: 190 },
  { name: "SpriteLab", price: "$0.004", speed: "9.8s", trust: "71", left: 770 },
  { name: "SpriteForge", price: "$0.003", speed: "2.4s", trust: "97", left: 1350 },
];
const STEPS = ["01 FIND 🔎", "02 COMPARE ⚖️", "03 PAY 💸", "04 DONE ✅"];
const WIRE = [
  { at: 238, text: "→ POST /generate", color: C.paper },
  { at: 252, text: "← 402 Payment Required", color: C.gold },
  { at: 268, text: "→ pay $0.003 USDC 💸", color: C.paper },
  { at: 286, text: "← 200 OK ✅", color: C.lime },
];

/** Scene 5 — how it works: find, compare, pay inside the call, get the result. */
export const S5How: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = f < 112 ? 0 : f < 228 ? 1 : f < 338 ? 2 : 3;
  const w = place(WINNER);
  const cam = keys3(f, [
    [100, [0, 6.4, 15]],
    [132, [0, 4.8, 12.6]],
    [222, [0, 4.8, 12.6]],
    [250, [-3.6, 3.9, 10]],
    [334, [-3.6, 3.9, 10]],
    [366, [0, 3, 7.6]],
  ]);
  const target = keys3(f, [
    [100, [0, 1.8, -2.5]],
    [132, [0, 2.6, -3]],
    [222, [0, 2.6, -3]],
    [250, [2.6, 1.7, -2.8]],
    [334, [2.6, 1.7, -2.8]],
    [366, [0.9, 1.7, -1.5]],
  ]);
  const coin = prog(f, 246, 276);
  const parcel = prog(f, 356, 388);
  const party = prog(f, 396, 412);
  const yaw = step === 0 ? Math.sin(f * 0.09) * 0.9 : step === 1 ? -0.3 + arc(f, 150, 20, 0.5) : step === 2 ? lerp(-0.3, 0.75, prog(f, 228, 242)) : lerp(0.75, 0.25, prog(f, 338, 352));

  return (
    <AbsoluteFill>
      <Stage cam={cam} target={target}>
        <Cloud position={[-13, 10, -22]} scale={2} />
        <Cloud position={[12, 11, -24]} scale={2.4} />
        {STALLS.map((label, k) => {
          const p = place(k);
          const candidate = CANDIDATES.includes(k);
          const fade = candidate ? (k !== WINNER ? prog(f, 204, 222) * 0.8 : 0) : prog(f, 72, 92);
          // the stalls that do not sell it go grey, then fold away: only the three finalists stay
          const gone = candidate ? (k !== WINNER ? eInOut(prog(f, 336, 352)) : 0) : eInOut(prog(f, 90, 108));
          if (gone >= 1) return null;
          const hop = arc(f, 18 + k * 6, 10, 0.4) + (candidate ? arc(f, 98, 12, 0.5) : 0) + (k === WINNER ? arc(f, 204, 14, 0.45) + arc(f, 276, 10, 0.45) : 0);
          return <Stall key={k} position={[p.x, hop, p.z]} rotation={[0, -p.a, 0]} scale={(1 - fade * 0.18) * (1 - gone)} color={COLORS[k]} label={label} dim={fade} />;
        })}
        {/* the winner's spot lights up */}
        <mesh position={[w.x, 0.02, w.z]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.001, pop(f, 204, 14))}>
          <circleGeometry args={[2.3, 24]} />
          <meshBasicMaterial color={C.lime} />
        </mesh>

        <Critter
          position={[0, 0, HOME_Z]}
          yaw={yaw}
          eyes={step === 3 && f > 392 ? "happy" : f > 204 && f < 228 ? "happy" : step === 0 && f % 50 < 6 ? "wide" : "open"}
          look={step === 1 ? [-0.4, -0.6] : [0, 0.2]}
          hop={arc(f, 204, 14, 0.9) + (step === 3 && f > 396 ? Math.abs(Math.sin(f * 0.22)) * 0.6 : 0)}
          armL={step === 3 && f > 392 ? 1 : 0}
          armR={step === 0 ? 0.5 : step === 2 ? arc(f, 238, 18, 1) : step === 3 && f > 392 ? 1 : 0}
        >
          {step === 0 ? <Magnifier position={[0.52 + Math.sin(f * 0.09) * 0.05, 0.17, FACE_Z + 0.3]} scale={pop(f, 4, 10)} /> : null}
          {step === 1 ? <Clipboard checked={prog(f, 128, 198) * 5} position={[-0.5, -0.2 - (1 - pop(f, 114, 10)) * 1.2, FACE_Z + 0.4]} rotation={[-0.45, 0.35, 0.08]} scale={0.9} /> : null}
        </Critter>

        {f >= 246 && f < 278 ? <Coin position={[lerp(1.2, w.x, coin), lerp(1.8, 1.5, coin) + Math.sin(coin * Math.PI) * 3.2, lerp(HOME_Z, w.z, coin)]} spin={f * 0.5} scale={1.5} rotation={[0, f * 0.4, 0]} /> : null}
        {f >= 356 && f < 396 ? (
          <Parcel position={[lerp(w.x, 1.9, parcel), lerp(1.5, 0.5, parcel) + Math.sin(parcel * Math.PI) * 3.6, lerp(w.z, HOME_Z + 0.6, parcel)]} rotation={[parcel * 4, parcel * 6, 0]} scale={1.2 * (1 - prog(f, 390, 396))} />
        ) : null}
        <Confetti t={f / fps} amount={party} position={[0, 0, HOME_Z + 0.4]} />
      </Stage>

      <div style={{ position: "absolute", left: 96, top: 90, display: "flex", gap: 14 }}>
        {STEPS.map((label, i) => (
          <Chip key={label} size={30} bg={i === step ? C.lime : i < step ? C.ink : "#fffdf7"} fg={i === step ? C.ink : i < step ? C.paper : C.grey} style={{ scale: i === step ? 1.08 : 1, boxShadow: i === step ? hard(6) : "none" }}>
            {label}
          </Chip>
        ))}
      </div>

      {/* 01 — the search */}
      <Pop at={10} out={100} style={{ right: 96, top: 84, transformOrigin: "right top" }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 38, background: "#fffdf7", border: `4px solid ${C.ink}`, boxShadow: hard(8), padding: "12px 26px", color: C.ink }}>🔎 “game-ready robot hero”</div>
      </Pop>

      {/* 02 — the three finalists */}
      {CARDS.map((card, i) => {
        const at = 112 + i * 6;
        const winner = i === 2;
        const picked = f >= 204;
        if (f < at || f > 236) return null;
        return (
          <div
            key={card.name}
            style={{
              position: "absolute",
              left: card.left,
              top: 178,
              width: 380,
              fontFamily: mono,
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 1.3,
              color: C.ink,
              background: picked && winner ? C.lime : "#fffdf7",
              border: `5px solid ${C.ink}`,
              boxShadow: hard(8),
              padding: "12px 22px 14px",
              opacity: (picked && !winner ? 0.55 : 1) * interpolate(f, [228, 236], [1, 0], clamp),
              scale: interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }) * (picked && winner ? 1.05 : 1),
            }}
          >
            <div style={{ fontFamily: display, fontSize: 40, letterSpacing: -1, marginBottom: 4 }}>
              {card.name} {picked && winner ? "🏆" : ""}
            </div>
            {[
              ["💰 price", card.price],
              ["⚡ speed", card.speed],
              ["⭐ trust", card.trust],
            ].map(([k, v], row) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", opacity: interpolate(f, [132 + row * 20, 138 + row * 20], [0.12, 1], clamp) }}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        );
      })}

      {/* 03 — payment happens inside the request */}
      {f >= 232 && f < 344 ? (
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 200,
            width: 720,
            background: C.ink,
            border: `6px solid ${C.ink}`,
            boxShadow: `12px 12px 0 ${C.lime}`,
            padding: "24px 30px",
            fontFamily: mono,
            fontWeight: 800,
            fontSize: 38,
            lineHeight: 1.5,
            opacity: interpolate(f, [232, 238, 336, 344], [0, 1, 1, 0], clamp),
          }}
        >
          {WIRE.map((line) => (
            <div key={line.text} style={{ color: line.color, opacity: f >= line.at ? 1 : 0.12 }}>
              {line.text}
            </div>
          ))}
        </div>
      ) : null}

      {/* 04 — the result */}
      <Pop at={396} rotate={3} style={{ right: 150, top: 190, transformOrigin: "center" }}>
        <div style={{ background: "#fffdf7", border: `6px solid ${C.ink}`, boxShadow: hard(14), padding: 16 }}>
          <Img src={staticFile("hero.png")} style={{ width: 400, height: 400, objectFit: "cover", display: "block", border: `4px solid ${C.ink}` }} />
          <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 30, color: C.ink, marginTop: 12 }}>hero.png ✅ $0.003 · 2.4s</div>
        </div>
      </Pop>

      <Sfx at={204} name="ding" volume={0.16} />
      <Sfx at={246} name="whip" volume={0.2} />
      <Sfx at={276} name="ding" volume={0.2} />
      <Sfx at={396} name="ding" volume={0.24} />
      <Narration scene="how" mark={["finds", "compares", "pays", "per", "call", "result"]} />
    </AbsoluteFill>
  );
};
