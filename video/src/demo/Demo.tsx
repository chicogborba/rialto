import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Sequence, Series, staticFile, useVideoConfig } from "remotion";
import { lerp, prog } from "../lib/anim";
import { C } from "../theme";
import { AudioFlags } from "../ui/Ui";
import { Wipe, type PitchProps } from "../Video";
import { D2Landing, D3Signup, D4Agent, D6Activity, D7Publish, D8Catalog } from "./scenes/Browsing";
import { D1Hook } from "./scenes/D1Hook";
import { D5Result } from "./scenes/D5Result";
import { D5Terminal } from "./scenes/D5Terminal";
import { D9Close } from "./scenes/D9Close";
import { DEMO_DURATIONS, DEMO_ORDER, DEMO_SPEECH, DEMO_TOTAL, demoStart, type DemoId } from "./timeline";

export const DEMO_SCENES: Record<DemoId, { name: string; component: React.FC }> = {
  hook: { name: "1 · This into this", component: D1Hook },
  landing: { name: "2 · The site (recorded)", component: D2Landing },
  signup: { name: "3 · Sign up (recorded)", component: D3Signup },
  agent: { name: "4 · An agent and its command (recorded)", component: D4Agent },
  terminal: { name: "5 · Claude Code builds the game with it", component: D5Terminal },
  result: { name: "5b · The game and its bill", component: D5Result },
  activity: { name: "6 · The dashboard (recorded)", component: D6Activity },
  publish: { name: "7 · Publish an API (recorded)", component: D7Publish },
  catalog: { name: "8 · The catalog (recorded)", component: D8Catalog },
  close: { name: "9 · Close", component: D9Close },
};

const TRACK = 72 * 30;
/** Quieter than the pitch: this one is for listening to what is being shown. */
function musicVolume(f: number): number {
  const ducked = DEMO_SPEECH.reduce((m, [start, end]) => Math.max(m, Math.min(prog(f, start - 10, start - 2), 1 - prog(f, end + 4, end + 18))), 0);
  const into = f % TRACK;
  const seam = f > 60 ? Math.min(1, prog(into, 0, 24), 1 - prog(into, TRACK - 24, TRACK)) : 1;
  return lerp(0.1, 0.045, ducked) * seam * prog(f, 0, 10) * (1 - prog(f, DEMO_TOTAL - 36, DEMO_TOTAL - 2));
}

/** The product demo: how the product works, shown on the product. */
export const RialtoDemo: React.FC<PitchProps> = ({ narration, music, sfx }) => {
  const { fps } = useVideoConfig();
  const cuts = DEMO_ORDER.slice(1).map(demoStart);
  return (
    <AudioFlags.Provider value={{ narration, music, sfx }}>
      <AbsoluteFill style={{ background: C.paper }}>
        <Series>
          {DEMO_ORDER.map((id) => {
            const Scene = DEMO_SCENES[id].component;
            return (
              <Series.Sequence key={id} name={DEMO_SCENES[id].name} durationInFrames={DEMO_DURATIONS[id]} premountFor={fps}>
                <Scene />
              </Series.Sequence>
            );
          })}
        </Series>
        {cuts.map((at) => (
          <Wipe key={at} at={at} />
        ))}
        {sfx
          ? cuts.map((at) => (
              <Sequence key={at} name="sfx whoosh" from={at - 7} layout="none">
                <Audio src="https://remotion.media/whoosh.wav" volume={0.14} />
              </Sequence>
            ))
          : null}
        {music ? <Audio name="Music" src={staticFile("music/getting-it-done.mp3")} loop volume={(f) => musicVolume(f)} /> : null}
      </AbsoluteFill>
    </AudioFlags.Provider>
  );
};
