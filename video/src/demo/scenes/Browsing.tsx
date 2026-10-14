import type React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import activity from "../../../public/demo/takes/activity.json";
import agent from "../../../public/demo/takes/agent.json";
import catalog from "../../../public/demo/takes/catalog.json";
import explorer from "../../../public/demo/takes/explorer.json";
import landing from "../../../public/demo/takes/landing.json";
import publish from "../../../public/demo/takes/publish.json";
import signup from "../../../public/demo/takes/signup.json";
import { C } from "../../theme";
import { Narration, Sfx } from "../../ui/Ui";
import { BrowserShot, markAt, type Take, type Zoom } from "../Browser";
import { Host } from "../Host";
import { DEMO_CUES, DEMO_DURATIONS, type DemoId } from "../timeline";

/** The address the product lives at; the recordings were made on a local build of the same code. */
const SITE = "galleriarialto.com";

const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <AbsoluteFill style={{ background: C.paper }} />
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.sand} 3px, transparent 3px)`, backgroundSize: "44px 44px", backgroundPosition: `${-f * 0.5}px ${-f * 0.25}px` }} />
    </>
  );
};

/** One stretch of the real site with the host beside it. */
const Shot: React.FC<{ scene: DemoId; name: string; take: Take; trim?: number; url: (f: number) => string; zoom?: Zoom[]; beats?: number[]; clicks?: number[]; mark?: string[] }> = ({ scene, name, take, trim = 0, url, zoom, beats = [], clicks = [], mark }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <BrowserShot name={name} take={take as Take} trim={trim} url={url(f)} zoom={zoom} />
      <Host beats={beats} />
      {clicks.map((at) => (
        <Sfx key={at} at={at} name="mouse-click" volume={0.5} />
      ))}
      <Narration cues={DEMO_CUES[scene]} mark={mark} />
    </AbsoluteFill>
  );
};

/** Scene 2 — the landing page: it loads, a look down it, and into "Connect an agent". */
export const D2Landing: React.FC = () => {
  const trim = 20;
  const t = landing as Take;
  const gone = markAt(t, "signup", trim);
  return <Shot scene="landing" name="landing" take={t} trim={trim} url={(f) => (f < gone - 12 ? SITE : `${SITE}/signup`)} beats={[markAt(t, "hero", trim) + 6, gone - 16]} clicks={[gone - 22]} mark={["rialto", "find,", "compare", "pay", "agent,", "api", "connect"]} />;
};

/** Scene 3 — sign up. */
export const D3Signup: React.FC = () => {
  const t = signup as Take;
  const done = markAt(t, "dashboard");
  return (
    <Shot
      scene="signup"
      name="signup"
      take={t}
      url={(f) => (f < done ? `${SITE}/signup` : `${SITE}/dashboard/agents`)}
      zoom={[
        [0, 1, 0.5, 0.5],
        [markAt(t, "name"), 1.55, 0.5, 0.52],
        [markAt(t, "submit") + 6, 1.55, 0.5, 0.52],
        [done + 22, 1, 0.5, 0.5],
      ]}
      beats={[done + 4]}
      clicks={[markAt(t, "submit")]}
      mark={["account:", "name,", "email", "password."]}
    />
  );
};

/** Scene 4 — an agent: its key, the one command, its budget. */
export const D4Agent: React.FC = () => {
  const t = agent as Take;
  return (
    <Shot
      scene="agent"
      name="agent"
      take={t}
      url={() => `${SITE}/dashboard/agents`}
      zoom={[
        [0, 1, 0.5, 0.5],
        [markAt(t, "name"), 1.32, 0.5, 0.46],
        [markAt(t, "key") + 30, 1.38, 0.5, 0.52],
        [markAt(t, "amount") - 10, 1.38, 0.5, 0.52],
        [markAt(t, "amount") + 20, 1.4, 0.45, 1.3],
        [DEMO_DURATIONS.agent - 30, 1.4, 0.45, 1.3],
        [DEMO_DURATIONS.agent, 1.2, 0.5, 0.5],
      ]}
      beats={[markAt(t, "key") + 8, markAt(t, "funded") + 6]}
      clicks={[markAt(t, "create"), markAt(t, "copy"), markAt(t, "fund")]}
      mark={["agent.", "key,", "command", "budget.", "never"]}
    />
  );
};

/** where the dashboard gives way to Solana's own explorer */
const CUT = 124;
const signature = (explorer as { url?: string }).url?.match(/tx\/([^?]+)/)?.[1] ?? "";

/** Scene 6 — the statement: the call in the dashboard, then the same payment on Solana's explorer. */
export const D6Activity: React.FC = () => {
  const f = useCurrentFrame();
  const t = activity as Take;
  const trim = 28;
  return (
    <AbsoluteFill>
      <Backdrop />
      {f < CUT ? (
        <BrowserShot
          name="activity"
          take={t}
          trim={trim}
          top={12}
          url={`${SITE}/dashboard`}
          zoom={[
            [0, 1, 0.5, 0.5],
            // the list of calls is the last thing on the page: the camera lifts it clear of the caption (y beyond 1)
            [markAt(t, "calls", trim) + 26, 1.42, 0.5, 1.36],
            [CUT, 1.42, 0.5, 1.36],
          ]}
        />
      ) : (
        <Sequence from={CUT} layout="none">
          <BrowserShot
            name="explorer"
            take={explorer as Take}
            top={12}
            url={`explorer.solana.com/tx/${signature.slice(0, 22)}…?cluster=devnet`}
            zoom={[
              [0, 1, 0.5, 0.3],
              [24, 1.3, 0.5, 0.3],
              [400, 1.3, 0.5, 0.3],
            ]}
          />
        </Sequence>
      )}
      <Host beats={[markAt(t, "transaction", trim) + 4, CUT + 16]} />
      <Sfx at={markAt(t, "transaction", trim) + 22} name="mouse-click" volume={0.5} />
      <Narration cues={DEMO_CUES.activity} mark={["dashboard,", "price", "transaction", "solana."]} />
    </AbsoluteFill>
  );
};

/** Scene 7 — the other side: publish an API. */
export const D7Publish: React.FC = () => {
  const trim = 20;
  const t = publish as Take;
  return (
    <Shot
      scene="publish"
      name="publish"
      take={t}
      trim={trim}
      url={() => `${SITE}/dashboard/apis`}
      zoom={[
        [0, 1, 0.5, 0.5],
        [markAt(t, "fill", trim), 1.3, 0.5, 0.55],
        [markAt(t, "price", trim) + 50, 1.3, 0.5, 0.55],
        [markAt(t, "publish", trim) - 20, 1.3, 0.5, 1.28],
        [markAt(t, "published", trim) + 36, 1.3, 0.5, 1.28],
        [markAt(t, "listed", trim), 1.4, 0.5, 0.42],
        [DEMO_DURATIONS.publish, 1.4, 0.5, 0.42],
      ]}
      beats={[markAt(t, "published", trim) + 8, markAt(t, "listed", trim) + 10]}
      clicks={[markAt(t, "fill", trim), markAt(t, "publish", trim)]}
      mark={["selling", "endpoint,", "price,", "publish."]}
    />
  );
};

/** Scene 8 — the catalog, with the new API in it. */
export const D8Catalog: React.FC = () => {
  const t = catalog as Take;
  const trim = 24;
  const found = markAt(t, "found", trim);
  return (
    <Shot
      scene="catalog"
      name="catalog"
      take={t}
      trim={trim}
      url={() => `${SITE}/catalog`}
      zoom={[
        [0, 1, 0.5, 0.5],
        // everything on sale first, then in on the search and the API it finds
        [found - 46, 1, 0.5, 0.5],
        [found - 10, 1.3, 0.2, 1.05],
        [DEMO_DURATIONS.catalog, 1.3, 0.2, 1.05],
      ]}
      beats={[found + 8]}
      mark={["catalog", "earn", "every", "call"]}
    />
  );
};
