"use client";

import { useRef, useState } from "react";
import { asset } from "@/lib/site";

/** The product demo video. Nothing is downloaded until the visitor presses play. */
export function DemoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden border-2 border-coal bg-sand shadow-[6px_6px_0_var(--color-coal)] md:shadow-[10px_10px_0_var(--color-coal)]">
      <video ref={video} className="size-full" poster={asset("/video/rialto-demo-poster.jpg")} preload="none" controls={started} playsInline onEnded={() => setStarted(false)}>
        <source src={asset("/video/rialto-demo.mp4")} type="video/mp4" />
      </video>
      {started ? null : (
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            void video.current?.play();
          }}
          aria-label="Play the Rialto demo video"
          className="group absolute inset-0 flex items-end justify-center pb-[6%]"
        >
          <span className="home-btn home-btn-lime text-base md:text-xl">
            <span aria-hidden>▶</span> Watch the demo · 2:24
          </span>
        </button>
      )}
    </div>
  );
}
