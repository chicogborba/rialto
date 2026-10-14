import { Audio, Video } from "@remotion/media";
import type React from "react";
import { useContext } from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { prog, rnd } from "../lib/anim";
import { C, mono } from "../theme";
import { DURATIONS, FPS } from "../timeline";
import { AudioFlags } from "../ui/Ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const DULL = 'Arial, "Helvetica Neue", sans-serif';
/** the recording is cut down to four beats; these times are seconds into that cut */
const at = (seconds: number) => Math.round(seconds * FPS);

/** What is said: [from, to, who, line]. */
const SAID: [number, number, string, string][] = [
  [0.1, 3.3, "Isadora", "Hi, I'm Isadora Guerra, software engineer at Apple Developer Academy."],
  [3.4, 4.2, "???", "What you guys doing?"],
  [4.28, 5.2, "Rodrigo", "You're doing a pitch?"],
  [5.28, 5.7, "Both", "Yeah."],
  [5.72, 7.05, "Rodrigo", "Nah, man. F*** that."],
  [10.84, 11.7, "Francisco", "No, no, no, no…"],
];
/** who the lower third names, and until when */
const THIRDS: [number, number, string, string][] = [
  [0.3, 3.3, "Isadora Guerra", "Software Engineer"],
  [3.5, 6.9, "Unidentified Person", "Not on the agenda"],
];
const PROMPT = "Hey Claude, just make a pitch for our project, and make sure you use Rialto for it.".split(" ");
const HEY = at(7.14);
const HEY_END = at(10.76);
const NAH = at(5.72);
/** the first cut in the recording: the slide changes and the camera tile grows with it */
const CUT = 3.3;
const OFFICE = 'Calibri, Carlito, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const OFFICE_LIGHT = '"Calibri Light", Calibri, "Helvetica Neue", "Segoe UI Light", Arial, sans-serif';
/** PowerPoint's own red */
const PPT = "#b7472a";
/** the webcam tile: small in the corner like any recorded call, until someone walks in */
const CAM = { w: 1000, h: 667 };

/**
 * The cold open: a real webcam recording over a screen-shared PowerPoint in its default theme,
 * placeholder text and all, with elevator music. It lasts until a team-mate walks in and hands the job to Claude.
 */
export const S0Cold: React.FC = () => {
  const f = useCurrentFrame();
  const { music } = useContext(AudioFlags);
  const line = SAID.find(([a, b]) => f >= at(a) && f < at(b));
  const third = THIRDS.find(([a, b]) => f >= at(a) && f < at(b));
  // once he says "Hey Claude", the deck starts to come apart
  const breaking = prog(f, HEY, HEY_END);
  const shake = breaking * 5;
  const typed = Math.floor(interpolate(f, [HEY, HEY_END], [0, PROMPT.length], clamp) + 0.999);
  const second = f >= at(CUT);
  const cam = interpolate(f, [at(CUT), at(CUT) + 12], [0.56, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  const black = prog(f, DURATIONS.cold - 5, DURATIONS.cold - 1);

  return (
    <AbsoluteFill style={{ background: "#3b3b3b" }}>
      <AbsoluteFill style={{ translate: `${(rnd(f, 1) - 0.5) * shake}px ${(rnd(f, 2) - 0.5) * shake}px`, rotate: `${breaking * -0.6}deg`, filter: `saturate(${1 - breaking * 0.5})` }}>
        {/* PowerPoint itself, screen-shared: nobody even pressed "present" */}
        <AbsoluteFill style={{ background: "#e6e6e6", fontFamily: OFFICE }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 54, background: PPT, color: "#fff", display: "flex", alignItems: "center", fontSize: 22 }}>
            <span style={{ marginLeft: 22, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 30, height: 30, background: "#fff", color: PPT, fontWeight: 700, fontSize: 22, display: "grid", placeItems: "center", borderRadius: 4 }}>P</span>
              AutoSave <span style={{ border: "1.5px solid #fff", borderRadius: 12, padding: "0 10px", fontSize: 16 }}>● Off</span>
            </span>
            <span style={{ position: "absolute", left: 0, right: 0, textAlign: "center" }}>pitch_v7_final_FINAL (2).pptx — PowerPoint</span>
            <span style={{ marginLeft: "auto", marginRight: 26, letterSpacing: 26, fontSize: 20 }}>─ ☐ ✕</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 54, height: 44, background: PPT, color: "#fff", display: "flex", alignItems: "flex-end", gap: 34, paddingLeft: 26, fontSize: 21 }}>
            {["File", "Home", "Insert", "Draw", "Design", "Transitions", "Animations", "Slide Show", "Record", "Review", "View", "Help"].map((tab) => (
              <span key={tab} style={tab === "Home" ? { background: "#f3f2f1", color: PPT, padding: "7px 16px 9px", borderRadius: "5px 5px 0 0", fontWeight: 700 } : { paddingBottom: 9 }}>{tab}</span>
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 98, height: 124, background: "#f3f2f1", borderBottom: "1px solid #c8c6c4", display: "flex", gap: 0, padding: "10px 16px", color: "#605e5c", fontSize: 16 }}>
            {[["Clipboard", 3], ["Slides", 3], ["Font", 9], ["Paragraph", 8], ["Drawing", 7], ["Editing", 3], ["Designer", 2]].map(([name, n]) => (
              <div key={name} style={{ borderRight: "1px solid #d2d0ce", padding: "0 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.ceil((n as number) / 2)}, 34px)`, gap: 8 }}>
                  {Array.from({ length: n as number }).map((_, i) => (
                    <span key={i} style={{ width: 34, height: 34, borderRadius: 4, background: i % 3 === 0 ? "#d2d0ce" : "#e1dfdd", border: "1px solid #c8c6c4" }} />
                  ))}
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
          {/* thumbnails */}
          <div style={{ position: "absolute", left: 0, top: 223, bottom: 36, width: 250, background: "#f3f2f1", borderRight: "1px solid #c8c6c4", padding: "18px 0", fontSize: 18, color: "#605e5c" }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ display: "flex", gap: 10, padding: "0 16px 18px 12px" }}>
                <span style={{ width: 16 }}>{n}</span>
                <span style={{ width: 190, height: 107, background: "#fff", border: n === (second ? 2 : 1) ? `3px solid ${PPT}` : "1px solid #c8c6c4", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: n === 1 ? "center" : "flex-start", padding: 12, gap: 6 }}>
                  <span style={{ width: n === 1 ? 70 : 60, height: 8, background: "#404040" }} />
                  {n === 1 ? <span style={{ width: 50, height: 4, background: "#a6a6a6" }} /> : [0, 1, 2].map((k) => <span key={k} style={{ width: 110 - k * 20, height: 4, background: "#a6a6a6" }} />)}
                </span>
              </div>
            ))}
          </div>
          {/* the slide: Office Theme, untouched */}
          <div style={{ position: "absolute", left: 300, top: 262, width: 1180, height: 664, background: "#fff", boxShadow: "0 0 0 1px #c8c6c4, 0 3px 10px rgba(0,0,0,.18)", color: "#000" }}>
            {second ? (
              <>
                <div style={{ position: "absolute", left: 82, top: 44, fontFamily: OFFICE_LIGHT, fontWeight: 300, fontSize: 70 }}>Agenda</div>
                <div style={{ position: "absolute", left: 82, top: 172, fontSize: 40, lineHeight: 1.5 }}>
                  {["Who we are", "Problem", "Solution", "Team", "Questions?"].map((item, i) => (
                    <div key={item} style={{ opacity: f >= at(CUT) + 4 + i * 8 ? 1 : 0 }}>• {item}</div>
                  ))}
                  <div style={{ color: "#a6a6a6" }}>• Click to add text</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: "absolute", left: 0, right: 0, top: 170, textAlign: "center", fontFamily: OFFICE_LIGHT, fontWeight: 300, fontSize: 104 }}>Rialto</div>
                <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontSize: 40, color: "#595959" }}>Hackathon pitch</div>
                <div style={{ position: "absolute", left: 150, right: 150, top: 410, height: 110, border: "2px dashed #a6a6a6", display: "grid", placeItems: "center", fontSize: 34, color: "#a6a6a6" }}>Click to add subtitle</div>
              </>
            )}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, background: "#f3f2f1", borderTop: "1px solid #c8c6c4", display: "flex", alignItems: "center", gap: 40, padding: "0 20px", fontSize: 18, color: "#605e5c" }}>
            <span>Slide {second ? 2 : 1} of 47</span>
            <span>English (United States)</span>
            <span>Accessibility: Investigate</span>
            <span style={{ marginLeft: "auto" }}>Notes&nbsp;&nbsp;&nbsp;Comments&nbsp;&nbsp;&nbsp;▭&nbsp;&nbsp;▦&nbsp;&nbsp;▷&nbsp;&nbsp;&nbsp;─────●──── 64%</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 232, display: "flex", justifyContent: "center" }}>
            <span style={{ background: "#1aa260", color: "#fff", fontFamily: DULL, fontSize: 20, padding: "5px 18px", borderRadius: 6, display: "flex", gap: 16 }}>
              You are screen sharing <span style={{ background: "#d93025", padding: "0 10px", borderRadius: 4 }}>■ Stop share</span>
            </span>
          </div>
        </AbsoluteFill>
        {/* the webcam, picture-in-picture */}
        <div style={{ position: "absolute", right: 34, bottom: 56, width: CAM.w, height: CAM.h, scale: cam, transformOrigin: "right bottom", background: "#000", border: "4px solid #262626", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,.45)", overflow: "hidden" }}>
          <Video src={staticFile("clips/before.mp4")} objectFit="cover" style={{ width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", left: 16, top: 12, fontFamily: DULL, fontSize: 26, color: "#fff", display: "flex", alignItems: "center", gap: 10, textShadow: "0 0 4px #000" }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#e02020", opacity: Math.floor(f / 15) % 2 ? 1 : 0.25 }} /> REC 00:{String(Math.floor(f / FPS)).padStart(2, "0")}
          </div>
          {third ? (
            <div style={{ position: "absolute", left: 0, bottom: 30, translate: `${interpolate(f, [at(third[0]), at(third[0]) + 12], [-700, 0], clamp)}px 0` }}>
              <div style={{ background: "linear-gradient(90deg,#1f3864,#2f5597)", color: "#fff", fontFamily: DULL, fontWeight: 700, fontSize: 44, padding: "8px 34px 6px 24px" }}>{third[2]}</div>
              <div style={{ background: "#f2c200", color: "#1f1f1f", fontFamily: DULL, fontSize: 30, padding: "4px 24px", width: "fit-content" }}>{third[3]}</div>
            </div>
          ) : null}
        </div>
        {line ? (
          <div style={{ position: "absolute", left: 60, width: 1920 - 60 - 44 - CAM.w * cam - 40, bottom: 70, display: "flex", justifyContent: "center" }}>
            <div style={{ background: "rgba(0,0,0,.82)", color: "#fff", fontFamily: DULL, fontSize: 40, lineHeight: 1.25, padding: "10px 22px", textAlign: "center" }}>{line[3]}</div>
          </div>
        ) : null}
      </AbsoluteFill>

      {/* his words, taken as the prompt they are */}
      {f >= HEY - 6 ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, translate: `0 ${interpolate(f, [HEY - 6, HEY + 6], [260, 0], clamp)}px`, background: C.ink, borderTop: `8px solid ${C.lime}`, padding: "30px 80px 40px", fontFamily: mono, fontWeight: 800, fontSize: 50, lineHeight: 1.3, color: C.paper }}>
          <span style={{ color: C.lime }}>&gt; </span>
          {PROMPT.slice(0, typed).map((word, i) => (
            <span key={i} style={{ color: /Claude|Rialto/.test(word) ? C.lime : C.paper }}>
              {word}{" "}
            </span>
          ))}
          <span style={{ display: "inline-block", width: 24, height: 50, background: C.lime, verticalAlign: "text-bottom", opacity: Math.floor(f / 8) % 2 ? 1 : 0.2 }} />
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#000", opacity: black }} />

      {/* elevator music, cut off mid-bar the moment he has had enough */}
      {music ? (
        <Sequence name="elevator music" durationInFrames={NAH} layout="none">
          <Audio src={staticFile("music/elevator.mp3")} volume={(frame) => 0.16 * prog(frame, 0, 20)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
