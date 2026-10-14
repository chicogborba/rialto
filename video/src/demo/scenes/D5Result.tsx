import { Video } from "@remotion/media";
import type React from "react";
import { useContext } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import game from "../../../public/demo/takes/game-rialto.json";
import { DEMO_FOOTAGE, PURCHASES } from "../../demo";
import { prog, spring } from "../../lib/anim";
import { C, display, mono } from "../../theme";
import { FPS } from "../../timeline";
import { AudioFlags, Narration, Sfx, hard } from "../../ui/Ui";
import { VO } from "../../vo";
import { Host } from "../Host";
import { DEMO_CUES, DEMO_DURATIONS, SHOW } from "../timeline";

/** the film of the game is upright, 600 × 780 */
const H = 800;
const W = Math.round((H * 600) / 780);
const LEFT = 150;

const sounds = (game as { sounds?: { t: number; src: string }[] }).sounds ?? [];
/** The frame of this scene at which the game first plays the sound whose file starts with `name`. */
const heard = (name: string, nth = 0): number => {
  const hit = sounds.filter((s) => s.src.startsWith(name))[nth];
  return hit ? Math.round(hit.t * FPS) - SHOW.trim : 1e9;
};

/** What the announcer says, by file: the words Claude asked the voice provider for. */
const SAID: [string, string][] = [
  ["voice_go", "Go go go!"],
  ["voice_closecall", "Close call!"],
  ["voice_faster", "Faster! Traffic is picking up."],
  ["voice_gameover", "Wrecked! Game over."],
];

/** One thing in the game that was bought, named at the moment it is seen or heard. */
const CALLOUTS: { at: number; emoji: string; title: string; from: string; usd: number }[] = [
  { at: 14, emoji: "🖼️", title: "Title screen art", from: "FLUX.2 Pro", usd: 0.0525 },
  { at: heard("music") + 6, emoji: "🎵", title: "Soundtrack", from: "Stable Audio 2.5", usd: 0.2625 },
  { at: heard("voice_go") + 4, emoji: "🎙️", title: "Announcer, 4 lines", from: "ElevenLabs v4 Turbo", usd: 0.052 },
  { at: heard("voice_go") + 50, emoji: "🚓", title: "11 sprites", from: "Ideogram Transparent", usd: 0.51975 },
  { at: heard("voice_go") + 84, emoji: "🛣️", title: "Road and roadside", from: "Seamless Tiles", usd: 0.063 },
  { at: heard("voice_go") + 118, emoji: "💥", title: "4 sound effects", from: "ElevenLabs Sound Effects", usd: 0.126 },
];

const Bars: React.FC<{ f: number; on: boolean }> = ({ f, on }) => (
  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3, height: 24 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <span key={i} style={{ width: 5, height: on ? 6 + Math.abs(Math.sin(f * (0.31 + i * 0.07) + i * 1.7)) * 18 : 4, background: C.ink }} />
    ))}
  </span>
);

/**
 * Scene 5b — the game Claude built with Rialto, shown properly: its title screen, the start with the
 * announcer, a run, a crash. The sound is the game's own, recorded as it was played, and each thing
 * that was bought is named when it shows up, with who sold it and for how much.
 */
export const D5Result: React.FC = () => {
  const f = useCurrentFrame();
  const { music } = useContext(AudioFlags);
  const end = DEMO_DURATIONS.result;
  const total = PURCHASES.reduce((sum, p) => sum + p.usd, 0);
  // the narrator at the start and at the end: the game is quieter under him, and up in between
  const spoken = Object.entries(DEMO_CUES.result).map(([line, at]) => [at, at + Math.ceil((VO[line]?.seconds ?? 0) * FPS)]);
  const ducked = (t: number) => spoken.reduce((m, [from, to]) => Math.max(m, Math.min(prog(t, from - 8, from), 1 - prog(t, to, to + 12))), 0);
  const playing = f >= heard("music");
  const line = SAID.flatMap(([file, words]) => sounds.filter((s) => s.src.startsWith(file)).map((s) => ({ at: Math.round(s.t * FPS) - SHOW.trim, words }))).filter((s) => f >= s.at && f < s.at + 48).pop();
  const sum = CALLOUTS.filter((c) => f >= c.at).reduce((a, c) => a + c.usd, 0);
  const totalAt = SHOW.total;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.5}px ${f * 0.2}px` }} />
      <div style={{ position: "absolute", left: LEFT, top: 44, width: W, height: H, scale: 0.92 + spring(f - 2) * 0.08, transformOrigin: "left top", rotate: "-1deg", border: `6px solid ${C.ink}`, boxShadow: `16px 16px 0 ${C.lime}, 16px 16px 0 6px ${C.ink}`, background: C.ink, overflow: "hidden" }}>
        {DEMO_FOOTAGE.rialto ? <Video src={staticFile(DEMO_FOOTAGE.rialto)} trimBefore={SHOW.trim} muted={!music} volume={(t) => (0.95 - 0.62 * ducked(t)) * prog(t, 0, 8) * (1 - prog(t, end - 20, end - 2))} objectFit="cover" style={{ width: "100%", height: "100%" }} /> : null}
      </div>
      {/* the sound is on, and it is the game's */}
      <div style={{ position: "absolute", left: LEFT + 18, top: 62, display: "flex", alignItems: "center", gap: 10, fontFamily: mono, fontWeight: 800, fontSize: 24, color: C.ink, background: C.lime, border: `4px solid ${C.ink}`, boxShadow: hard(5), padding: "4px 12px", rotate: "-1deg" }}>
        <Bars f={f} on={playing} /> {playing ? "the game's own sound" : "title screen"}
      </div>
      {/* what the announcer is saying right now */}
      {line ? (
        <div style={{ position: "absolute", left: LEFT + W - 60, top: 300, scale: spring(f - line.at), transformOrigin: "left center", fontFamily: display, fontWeight: 700, fontSize: 50, letterSpacing: -2, color: C.ink, background: "#fffdf7", border: `5px solid ${C.ink}`, boxShadow: hard(9), padding: "6px 22px 10px", rotate: "-3deg", whiteSpace: "nowrap", zIndex: 2 }}>
          🎙️ “{line.words}”
        </div>
      ) : null}
      {/* bought on Rialto: named as each one is seen or heard */}
      <div style={{ position: "absolute", left: 900, top: 50, width: 800 }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 47, letterSpacing: -2.2, whiteSpace: "nowrap", color: C.ink, scale: spring(f - 6), transformOrigin: "left center" }}>
          Everything in it was <span style={{ background: C.lime, padding: "0 10px" }}>bought on Rialto</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
          {CALLOUTS.map((c, i) =>
            f < c.at ? null : (
              <div key={c.title} style={{ scale: spring(f - c.at), transformOrigin: "left center", rotate: `${i % 2 ? 0.5 : -0.5}deg`, display: "flex", alignItems: "center", gap: 16, background: "#fffdf7", border: `5px solid ${C.ink}`, boxShadow: hard(6), padding: "3px 16px 5px" }}>
                <span style={{ fontSize: 34 }}>{c.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: display, fontWeight: 700, fontSize: 33, letterSpacing: -1.3, lineHeight: 1.05, color: C.ink }}>{c.title}</span>
                  <span style={{ display: "block", fontFamily: mono, fontWeight: 800, fontSize: 18, color: "#6b6558" }}>from {c.from}</span>
                </span>
                <span style={{ fontFamily: mono, fontWeight: 800, fontSize: 30, color: C.ink, background: C.lime, border: `3px solid ${C.ink}`, padding: "1px 10px" }}>${c.usd.toFixed(c.usd < 0.1 ? 3 : 2)}</span>
              </div>
            ),
          )}
        </div>
        {/* the running bill, and the total once the run is over */}
        {f >= CALLOUTS[0].at ? (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `5px dashed ${C.ink}`, paddingTop: 10, fontFamily: display, fontWeight: 700, fontSize: f >= totalAt ? 60 : 44, letterSpacing: -2, color: C.ink }}>
            <span>
              {f >= totalAt ? "Total" : "So far"}
              {f >= totalAt ? <span style={{ marginLeft: 16, fontFamily: mono, fontWeight: 800, fontSize: 22, letterSpacing: 0, color: "#6b6558" }}>{PURCHASES.length} calls · each paid in USDC on Solana</span> : null}
            </span>
            <span style={{ scale: f >= totalAt ? 0.8 + spring(f - totalAt) * 0.2 : 1, background: f >= totalAt ? C.lime : "transparent", border: f >= totalAt ? `5px solid ${C.ink}` : "none", padding: "0 16px 4px" }}>${(f >= totalAt ? total : sum).toFixed(2)}</span>
          </div>
        ) : null}
      </div>
      <Host beats={[10, heard("voice_go"), heard("sfx_crash"), totalAt]} look={[-1, 0.6]} />
      {CALLOUTS.map((c) => (
        <Sfx key={c.title} at={c.at} name="ding" volume={0.12} />
      ))}
      <Narration cues={DEMO_CUES.result} mark={["built.", "listen.", "twenty-four", "dollar", "eight", "cents."]} />
    </AbsoluteFill>
  );
};
