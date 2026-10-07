import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, display, mono } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const hard = (n = 10) => `${n}px ${n}px 0 ${C.ink}`;

/** Bottom caption: the one line the viewer should read. Words pop in one after another. */
export const Caption: React.FC<{ from: number; to: number; children: string; accent?: string }> = ({ from, to, children, accent = C.lime }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const words = children.split(" ");
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 96 }}>
      <div
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 68,
          lineHeight: 1.1,
          letterSpacing: -1.5,
          color: C.ink,
          background: "#fffdf7",
          border: `6px solid ${C.ink}`,
          boxShadow: hard(12),
          padding: "22px 44px",
          maxWidth: 1560,
          textAlign: "center",
          opacity: interpolate(frame, [to - 8, to], [1, 0], clamp),
          scale: interpolate(frame, [from, from + 10], [0.86, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
          translate: interpolate(frame, [from, from + 10], ["0px 60px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        {words.map((word, i) => {
          const at = from + 3 + i * 2.2;
          const marked = word.startsWith("*");
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "0.26em",
                padding: marked ? "0 0.14em" : 0,
                background: marked ? accent : "transparent",
                opacity: interpolate(frame, [at, at + 4], [0, 1], clamp),
                translate: interpolate(frame, [at, at + 6], ["0px 22px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
              }}
            >
              {word.replace(/\*/g, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Small mono tag, used for scene kickers and UI chrome. */
export const Chip: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  bg = C.ink,
  fg = C.paper,
  size = 34,
  style,
}) => (
  <div
    style={{
      fontFamily: mono,
      fontWeight: 800,
      fontSize: size,
      color: fg,
      background: bg,
      border: `4px solid ${C.ink}`,
      padding: "10px 20px",
      display: "inline-block",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Pops its children in at `at` (scale + fade), and optionally out at `out`. */
export const Pop: React.FC<{ at: number; out?: number; style?: React.CSSProperties; children: React.ReactNode; rotate?: number }> = ({ at, out, style, children, rotate = 0 }) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 8)) return null;
  return (
    <div
      style={{
        position: "absolute",
        rotate: `${rotate}deg`,
        opacity: out === undefined ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp),
        scale: interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};
