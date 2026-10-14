import type React from "react";
import { useId } from "react";
import { eOut, prog, spring } from "../lib/anim";
import { C } from "../theme";
import { LOGO } from "./logo-paths";

const ROUTE_POINTS: [number, number][] = [
  [16, 16],
  [40, 16],
  [48, 24],
  [48, 50],
  [84, 86],
];
/** a point `k` (0..1) of the way along the route, by length */
const along = (k: number): [number, number] => {
  const lengths = ROUTE_POINTS.slice(1).map(([x, y], i) => Math.hypot(x - ROUTE_POINTS[i][0], y - ROUTE_POINTS[i][1]));
  let left = k * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const t = left / lengths[i];
      return [ROUTE_POINTS[i][0] + (ROUTE_POINTS[i + 1][0] - ROUTE_POINTS[i][0]) * t, ROUTE_POINTS[i][1] + (ROUTE_POINTS[i + 1][1] - ROUTE_POINTS[i][1]) * t];
    }
    left -= lengths[i];
  }
  return ROUTE_POINTS[ROUTE_POINTS.length - 1];
};

/**
 * Rialto's logo: a heavy R with a route through it (agent, Rialto, the API it hires) and the
 * lettered wordmark. Same shapes as public/brand/rialto-logo.svg (both come from scripts/logo.py).
 *
 * `t` is the frames since the logo started: the R lands, the route draws itself node by node, the
 * letters rise into place, and after that a payment keeps running down the route. Leave `t` out
 * for the finished logo, standing still.
 */
export const Logo: React.FC<{ height: number; t?: number; word?: boolean; tone?: "ink" | "cream"; style?: React.CSSProperties }> = ({ height, t, word = true, tone = "ink", style }) => {
  const id = useId();
  const still = t === undefined;
  const at = t ?? 999;
  const fg = tone === "ink" ? C.ink : C.paper;
  const route = tone === "ink" ? C.paper : C.ink;
  const width = word ? LOGO.lockupWidth : 100;
  const land = still ? 1 : spring(at);
  const legs = [prog(at, 8, 19), prog(at, 21, 32)];
  const nodeAt = [5, 19, 32];
  const pulse = still || at < 44 ? null : along(((at - 44) % 46) / 30);
  return (
    <svg viewBox={`0 0 ${width} 100`} height={height} width={(height * width) / 100} style={{ overflow: "visible", display: "block", ...style }}>
      <g transform={`translate(50 50) scale(${land}) translate(-50 -50)`} opacity={at < 1 ? 0 : 1}>
        <path d={LOGO.outline} fill={fg} stroke={fg} strokeWidth={6} strokeLinejoin="round" />
        {LOGO.route.map((d, i) => (
          <path key={d} d={d} fill="none" stroke={route} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - legs[i]} opacity={legs[i] > 0 ? 1 : 0} />
        ))}
        {LOGO.arrows.map((d, i) => (
          <path key={d} d={d} fill="none" stroke={route} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={legs[i] > (i ? 0.55 : 0.5) ? 1 : 0} />
        ))}
        {LOGO.nodes.map(([x, y, color], i) => {
          const k = still ? 1 : spring(at - nodeAt[i]);
          const size = LOGO.nodeSize * k;
          return <rect key={i} x={x - size / 2} y={y - size / 2} width={size} height={size} rx={2.6 * k} fill={color} />;
        })}
        {pulse && (at - 44) % 46 < 30 ? <circle cx={pulse[0]} cy={pulse[1]} r={3.4} fill={C.lime} stroke={fg} strokeWidth={1.4} /> : null}
      </g>
      {word ? (
        <>
          <defs>
            <clipPath id={id}>
              <rect x={LOGO.wordX - 4} y={LOGO.wordY - 2} width={LOGO.wordWidth * LOGO.wordScale + 8} height={100 * LOGO.wordScale + 4} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id})`}>
            <g transform={`translate(${LOGO.wordX} ${LOGO.wordY}) scale(${LOGO.wordScale})`} fill={fg} fillRule="evenodd">
              {LOGO.glyphs.map(([x, d], i) => (
                <path key={i} transform={`translate(${x} ${still ? 0 : (1 - eOut(prog(at, 12 + i * 3, 26 + i * 3))) * 112})`} d={d} />
              ))}
            </g>
          </g>
        </>
      ) : null}
    </svg>
  );
};

const BARS = [
  "M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z",
  "M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z",
  "M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z",
];

/** Solana's own mark, in its own gradient: the three bars. `height` in px; sits inline with text. */
export const SolanaMark: React.FC<{ height?: number | string; style?: React.CSSProperties }> = ({ height = "0.8em", style }) => (
  <svg viewBox="0 0 397 311" style={{ height, width: "auto", display: "inline-block", verticalAlign: "-0.06em", ...style }}>
    <defs>
      <linearGradient id="sol" x1="0" y1="311" x2="397" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
    </defs>
    {BARS.map((d) => (
      <path key={d} d={d} fill="url(#sol)" />
    ))}
  </svg>
);

/** "Solana" with its mark, on ink: the one place the video uses Solana's colours. */
export const SolanaTag: React.FC<{ children?: React.ReactNode; size: number; style?: React.CSSProperties }> = ({ children = "Solana", size, style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3em", background: C.ink, color: "#fff", fontSize: size, padding: "0.06em 0.36em 0.14em", whiteSpace: "nowrap", ...style }}>
    <SolanaMark height="0.72em" style={{ verticalAlign: 0 }} />
    {children}
  </span>
);
