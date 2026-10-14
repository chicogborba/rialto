import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useCurrentFrame } from "remotion";
import { eInOut, prog, spring } from "../lib/anim";
import { C, mono } from "../theme";
import { FPS } from "../timeline";

/** One recording made by scripts/record-demo.mjs: the film, its moments and where the pointer was. */
export interface Take {
  seconds: number;
  view: { width: number; height: number; scale: number };
  marks: Record<string, number>;
  cursor: { t: number; x: number; y: number; down?: boolean }[];
}
/** The frame (of the scene) at which a moment of the take happens, when the take starts `trim` frames in. */
export const markAt = (take: Take, mark: string, trim = 0): number => Math.round((take.marks[mark] ?? 0) * FPS) - trim;

/** [frame, zoom, x, y]: how close the camera is and what it centres on (x, y from 0 to 1 of the page). */
export type Zoom = [number, number, number, number];
/** A stretch of the recording, frames `from` to `to` of it, shown over `frames` frames of the video (fewer = fast-forward). */
export interface Segment {
  from: number;
  to: number;
  frames: number;
}
const WIDTH = 1500;
const BAR = 58;

function camera(frame: number, zoom: Zoom[]): [number, number, number] {
  if (zoom.length === 0) return [1, 0.5, 0.5];
  if (frame <= zoom[0][0]) return [zoom[0][1], zoom[0][2], zoom[0][3]];
  for (let i = 1; i < zoom.length; i++) {
    if (frame <= zoom[i][0]) {
      // each move takes at most a second, then holds until the next one
      const k = eInOut(prog(frame, Math.max(zoom[i - 1][0], zoom[i][0] - 30), zoom[i][0]));
      return [1, 2, 3].map((n) => zoom[i - 1][n] + (zoom[i][n] - zoom[i - 1][n]) * k) as [number, number, number];
    }
  }
  const last = zoom[zoom.length - 1];
  return [last[1], last[2], last[3]];
}

/**
 * A recording in a window: the real site in a browser, or the real terminal session. The film plays
 * inside, the pointer is drawn from the recorded track (a headless browser has none of its own)
 * and the camera pushes in on what matters. `title` instead of `url` makes it a terminal window.
 */
export const BrowserShot: React.FC<{ name: string; take: Take; trim?: number; segments?: Segment[]; url?: string; title?: string; zoom?: Zoom[]; top?: number }> = ({ name, take, trim = 0, segments, url, title, zoom = [], top = 26 }) => {
  const frame = useCurrentFrame();
  const fit = WIDTH / take.view.width;
  const height = take.view.height * fit;
  const [z, cx, cy] = camera(frame, zoom);
  const parts = segments ?? [{ from: trim, to: trim + 100_000, frames: 100_000 }];
  // which frame of the recording is on screen now
  let source = parts[parts.length - 1].to;
  for (let i = 0, start = 0; i < parts.length; start += parts[i].frames, i++) {
    if (frame < start + parts[i].frames) {
      source = parts[i].from + ((frame - start) * (parts[i].to - parts[i].from)) / parts[i].frames;
      break;
    }
  }
  // the pointer, between the two samples either side of now
  const t = source / FPS;
  const track = take.cursor;
  let i = track.findIndex((c) => c.t > t);
  if (i === -1) i = track.length;
  const a = track[Math.max(0, i - 1)];
  const b = track[Math.min(track.length - 1, i)] ?? a;
  const k = a && b && b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const pointer = a && b ? { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } : null;
  const clicks = track.filter((c) => c.down && c.t <= t);
  const click = clicks[clicks.length - 1];
  const since = click ? (t - click.t) * FPS : 99;
  const enter = spring(frame - 2);
  let offset = 0;

  return (
    <div style={{ position: "absolute", left: (1920 - WIDTH) / 2, top, width: WIDTH, scale: 0.9 + enter * 0.1, opacity: frame < 2 ? 0 : 1, transformOrigin: "center 60%", border: `6px solid ${C.ink}`, boxShadow: `16px 16px 0 ${C.lime}, 16px 16px 0 6px ${C.ink}`, background: C.ink }}>
      {/* window chrome */}
      <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: title ? "#2a2622" : C.sand, borderBottom: `5px solid ${C.ink}` }}>
        {[C.red, C.gold, C.lime].map((c) => (
          <span key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c, border: `3px solid ${C.ink}` }} />
        ))}
        {title ? (
          <span style={{ marginLeft: 14, fontFamily: mono, fontWeight: 800, fontSize: 24, color: "#a9a394" }}>{title}</span>
        ) : (
          <span style={{ marginLeft: 14, flex: 1, fontFamily: mono, fontWeight: 800, fontSize: 25, color: C.ink, background: "#fffdf7", border: `3px solid ${C.ink}`, padding: "3px 16px", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ opacity: 0.55 }}>🔒 </span>
            {url}
          </span>
        )}
      </div>
      <div style={{ width: WIDTH, height, overflow: "hidden", position: "relative", background: "#0b0c0a" }}>
        <div style={{ width: take.view.width, height: take.view.height, transformOrigin: "0 0", transform: `scale(${fit})` }}>
          <div style={{ width: "100%", height: "100%", position: "relative", transformOrigin: `${cx * 100}% ${cy * 100}%`, transform: `scale(${z})` }}>
            {parts.map((part, n) => {
              const from = offset;
              offset += part.frames;
              return (
                <Sequence key={n} from={from} durationInFrames={part.frames} layout="none">
                  <Video src={staticFile(`demo/takes/${name}.mp4`)} trimBefore={part.from} playbackRate={(part.to - part.from) / part.frames} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                </Sequence>
              );
            })}
            {click && since < 16 ? <div style={{ position: "absolute", left: click.x - 30, top: click.y - 30, width: 60, height: 60, borderRadius: 30, border: `5px solid ${C.lime}`, scale: 0.3 + since / 14, opacity: 1 - since / 16 }} /> : null}
            {pointer && track.length > 2 ? (
              <svg viewBox="0 0 24 24" width={44 / Math.sqrt(z)} height={44 / Math.sqrt(z)} style={{ position: "absolute", left: pointer.x - 5, top: pointer.y - 3, scale: since < 5 ? 0.82 : 1, transformOrigin: "20% 12%" }}>
                <path d="M4 2l14 9-6 1.5L9 19z" fill="#fff" stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
