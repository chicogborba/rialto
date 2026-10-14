"use client";

import { useState } from "react";
import { asset } from "@/lib/site";

/**
 * One build of the game, playable in place. It is loaded only when the visitor asks for it: the
 * Rialto build brings its own art and soundtrack, and nobody should pay for those by scrolling past.
 *
 * The page of the game is fetched and handed to the frame as its document, because the site forbids
 * being framed by address (X-Frame-Options: DENY). The file is used as the agent left it; the only
 * addition is a <base>, so that its "assets/…" links still point at its own folder.
 */
export function GameFrame({ src, width, height, title, tone }: { src: string; width: number; height: number; title: string; tone: "plain" | "rialto" }) {
  const [page, setPage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  const load = async () => {
    setState("loading");
    try {
      const url = asset(src);
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const base = `<base href="${url.slice(0, url.lastIndexOf("/") + 1)}">`;
      const html = await res.text();
      setPage(/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => `${head}${base}`) : `${base}${html}`);
    } catch {
      setState("failed");
    }
  };

  return (
    <div className={`relative mx-auto w-full overflow-hidden border-2 border-coal bg-[#111] ${tone === "rialto" ? "shadow-[8px_8px_0_var(--color-lime)]" : "shadow-[8px_8px_0_var(--color-coal)]"}`} style={{ maxWidth: width + 40, aspectRatio: `${width + 40} / ${height + 40}` }}>
      {page ? (
        <iframe srcDoc={page} title={title} className="absolute inset-0 size-full" allow="autoplay" />
      ) : (
        <button type="button" onClick={load} disabled={state === "loading"} className="group absolute inset-0 flex flex-col items-center justify-center gap-4 text-cream" aria-label={`Play: ${title}`}>
          <span className={`home-btn ${tone === "rialto" ? "home-btn-lime" : "bg-cream text-coal"} text-lg`}>
            <span aria-hidden>▶</span> {state === "loading" ? "Loading…" : state === "failed" ? "Try again" : "Play"}
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-cream/55">← → to steer · space to start</span>
        </button>
      )}
    </div>
  );
}
