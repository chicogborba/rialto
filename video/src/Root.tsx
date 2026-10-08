import type React from "react";
import { Composition, Folder } from "remotion";
import { S1Hook } from "./scenes/S1Hook";
import { S2BuildOrHire } from "./scenes/S2BuildOrHire";
import { S3Wall } from "./scenes/S3Wall";
import { S4Reveal } from "./scenes/S4Reveal";
import { S5How } from "./scenes/S5How";
import { S6Result } from "./scenes/S6Result";
import { S7Sellers } from "./scenes/S7Sellers";
import { S8Cta } from "./scenes/S8Cta";
import { DURATIONS, FPS, TOTAL } from "./timeline";
import { HeroCard } from "./HeroCard";
import { RialtoPitch } from "./Video";

const size = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RialtoPitch" component={RialtoPitch} durationInFrames={TOTAL} defaultProps={{ narration: true, music: true, sfx: true }} {...size} />
    <Composition id="HeroCard" component={HeroCard} durationInFrames={1} width={800} height={800} fps={FPS} />
    <Folder name="Scenes">
      <Composition id="S1-Hook" component={S1Hook} durationInFrames={DURATIONS.hook} {...size} />
      <Composition id="S2-BuildOrHire" component={S2BuildOrHire} durationInFrames={DURATIONS.buildOrHire} {...size} />
      <Composition id="S3-Wall" component={S3Wall} durationInFrames={DURATIONS.wall} {...size} />
      <Composition id="S4-Reveal" component={S4Reveal} durationInFrames={DURATIONS.reveal} {...size} />
      <Composition id="S5-How" component={S5How} durationInFrames={DURATIONS.how} {...size} />
      <Composition id="S6-Result" component={S6Result} durationInFrames={DURATIONS.result} {...size} />
      <Composition id="S7-Sellers" component={S7Sellers} durationInFrames={DURATIONS.sellers} {...size} />
      <Composition id="S8-Cta" component={S8Cta} durationInFrames={DURATIONS.cta} {...size} />
    </Folder>
  </>
);
