import { REPO_URL, STATIC_PREVIEW } from "@/lib/site";

/** Only on the GitHub Pages build: says what this is and where the full platform lives. */
export function StaticBanner() {
  if (!STATIC_PREVIEW) return null;
  return (
    <a
      href={REPO_URL}
      className="fixed bottom-3 right-3 z-40 max-w-[70vw] border-2 border-ink bg-paper px-3 py-2 font-mono text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-ink shadow-[4px_4px_0_var(--color-signal)] hover:bg-signal md:text-xs"
    >
      Static preview · the full platform runs locally → GitHub ↗
    </a>
  );
}
