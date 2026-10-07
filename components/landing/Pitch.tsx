"use client";

import { useRef, useState } from "react";
import { asset } from "@/lib/site";
import { Slap } from "./Stickers";

const BEATS = ["🧱 from scratch", "🤝 build or hire", "🔒 agents can't hire", "📖 Rialto", "💸 pay per call"];

/** The 64-second pitch video, framed like a chunky TV. Nothing loads until the visitor presses play. */
export function Pitch() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const play = () => {
    setStarted(true);
    void video.current?.play();
  };

  return (
    <section id="pitch" aria-labelledby="pitch-title" className="scroll-mt-4 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-10 md:py-28">
        <div className="relative">
          <h2 id="pitch-title" className="text-[clamp(3rem,11vw,10rem)] font-bold uppercase leading-[0.82] tracking-[-0.06em]">
            The pitch<span className="text-signal">.</span>
          </h2>
          <Slap tone="signal" rotate={-6} className="absolute right-0 top-1 md:right-[22%] md:top-6 md:text-base">64 seconds ⏱️</Slap>
        </div>

        <div className="relative mx-auto mt-10 max-w-6xl md:mt-14">
          <div className="relative -rotate-1 border-2 border-ink bg-paper p-2 shadow-[10px_10px_0_var(--color-signal)] transition-transform duration-300 hover:rotate-0 md:p-3 md:shadow-[16px_16px_0_var(--color-signal)]">
            <div className="relative aspect-video overflow-hidden border-2 border-ink bg-ink">
              <video
                ref={video}
                className="h-full w-full"
                poster={asset("/video/rialto-pitch-poster.jpg")}
                preload="none"
                controls={started}
                playsInline
                onEnded={() => setStarted(false)}
              >
                <source src={asset("/video/rialto-pitch.mp4")} type="video/mp4" />
              </video>
              {started ? null : (
                <button type="button" onClick={play} aria-label="Play the Rialto pitch video" className="group absolute inset-0 flex items-end justify-center bg-ink/25 pb-[7%] transition-colors hover:bg-ink/10">
                  <span className="flex items-center gap-3 border-2 border-ink bg-signal px-6 py-4 text-xl font-bold uppercase tracking-tight text-ink shadow-[6px_6px_0_var(--color-ink)] transition-transform group-hover:-translate-y-1 group-hover:scale-105 md:px-10 md:py-6 md:text-4xl">
                    <span aria-hidden>▶</span> Play the pitch
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-2 font-mono text-xs font-bold uppercase text-ink md:text-sm">
              <span>rialto-pitch.mp4</span>
              <span>🔊 sound on</span>
            </div>
          </div>
          <Slap tone="pay" rotate={8} className="absolute -bottom-4 -left-2 md:-left-8 md:text-base">no slides 🙅</Slap>
        </div>

        <ul className="mx-auto mt-12 flex max-w-6xl flex-wrap gap-3">
          {BEATS.map((beat, i) => (
            <li key={beat} className="border-2 border-line-hi px-3 py-2 font-mono text-sm font-bold uppercase text-muted">
              <span className="text-signal">{String(i + 1).padStart(2, "0")}</span> {beat}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
