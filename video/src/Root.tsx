import type React from "react";
import { Composition, Folder } from "remotion";
import { DURATIONS, FPS, ORDER, TOTAL } from "./timeline";
import { HeroCard } from "./HeroCard";
import { Thumbs } from "./Thumbs";
import { RialtoPitch, SCENES } from "./Video";
import { DEMO_SCENES, RialtoDemo } from "./demo/Demo";
import { DEMO_DURATIONS, DEMO_ORDER, DEMO_TOTAL } from "./demo/timeline";

const size = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RialtoPitch" component={RialtoPitch} durationInFrames={TOTAL} defaultProps={{ narration: true, music: true, sfx: true }} {...size} />
    <Composition id="RialtoDemo" component={RialtoDemo} durationInFrames={DEMO_TOTAL} defaultProps={{ narration: true, music: true, sfx: true }} {...size} />
    <Composition id="Thumbs" component={Thumbs} durationInFrames={2} {...size} />
    <Composition id="HeroCard" component={HeroCard} durationInFrames={1} width={800} height={800} fps={FPS} />
    <Folder name="Scenes">
      {ORDER.map((id) => (
        <Composition key={id} id={`scene-${id}`} component={SCENES[id].component} durationInFrames={DURATIONS[id]} {...size} />
      ))}
    </Folder>
    <Folder name="Demo-scenes">
      {DEMO_ORDER.map((id) => (
        <Composition key={id} id={`demo-${id}`} component={DEMO_SCENES[id].component} durationInFrames={DEMO_DURATIONS[id]} {...size} />
      ))}
    </Folder>
  </>
);
