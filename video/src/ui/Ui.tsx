import { Audio } from "@remotion/media";
import type React from "react";
import { createContext, useContext } from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, display, mono } from "../theme";
import { CUES, FPS, type SceneId } from "../timeline";
import { VO } from "../vo";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const hard = (n = 8) => `${n}px ${n}px 0 ${C.ink}`;

/** Which audio layers are on. Lets you render a silent or music-free version from the CLI. */
export const AudioFlags = createContext({ narration: true, music: true, sfx: true });

const plain = (word: string) => word.toLowerCase().replace(/[^a-z0-9-]/g, "");

/**
 * The narration for one scene: plays each line and shows it as a caption whose words light up as
 * they are spoken. `mark` lists the words that get the highlighter.
 */
export const Narration: React.FC<{ scene: SceneId; mark?: string[]; accent?: string; captions?: boolean }> = ({ scene, mark = [], accent = C.lime, captions = true }) => {
  const frame = useCurrentFrame();
  const { narration } = useContext(AudioFlags);
  const cues = Object.entries(CUES[scene]);
  const index = cues.reduce((last, [, at], i) => (frame >= at - 4 ? i : last), -1);
  const [line, start] = index >= 0 ? cues[index] : ["", 0];
  const clip = VO[line];
  const end = clip ? start + clip.seconds * FPS : 0;
  const visible = captions && clip !== undefined && frame <= end + 22;

  return (
    <>
      {narration
        ? cues.map(([id, at]) => (
            <Sequence key={id} name={`voice ${id}`} from={at} layout="none">
              <Audio src={staticFile(`voiceover/${id}.mp3`)} />
            </Sequence>
          ))
        : null}
      {visible ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 72 }}>
          <div
            style={{
              fontFamily: display,
              fontWeight: 700,
              fontSize: 54,
              lineHeight: 1.15,
              letterSpacing: -1.2,
              color: C.ink,
              background: "#fffdf7",
              border: `4px solid ${C.ink}`,
              boxShadow: hard(8),
              padding: "14px 34px 16px",
              maxWidth: 1480,
              textAlign: "center",
              opacity: interpolate(frame, [start - 4, start, end + 14, end + 22], [0, 1, 1, 0], clamp),
              translate: interpolate(frame, [start - 4, start + 5], ["0px 28px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
            }}
          >
            {clip.words.map((w, i) => {
              const at = start + w.start * FPS;
              const said = frame >= at - 1;
              const hot = mark.includes(plain(w.word));
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: i === clip.words.length - 1 ? 0 : "0.26em",
                    padding: hot ? "0 0.14em" : 0,
                    background: hot && said ? accent : "transparent",
                    opacity: said ? 1 : 0.26,
                    translate: interpolate(frame, [at - 1, at + 4], ["0px 5px", "0px 0px"], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}
    </>
  );
};

/** One sound effect at a frame of the current scene. Files come from remotion.media. */
export const Sfx: React.FC<{ at: number; name: string; volume?: number }> = ({ at, name, volume = 0.25 }) => {
  const { sfx } = useContext(AudioFlags);
  if (!sfx) return null;
  return (
    <Sequence name={`sfx ${name}`} from={Math.max(0, Math.round(at))} layout="none">
      <Audio src={`https://remotion.media/${name}.wav`} volume={volume} />
    </Sequence>
  );
};

/** Small mono tag, used for labels and UI chrome. */
export const Chip: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  bg = C.ink,
  fg = C.paper,
  size = 30,
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
      padding: "8px 18px",
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
