import { notFound } from "next/navigation";
import { OpenScene } from "@/components/render/OpenScene";

export const metadata = { robots: { index: false } };

/**
 * One still for announcing the launch: run `npm run dev` and screenshot /render-open at 1600×900
 * (the output is docs/images/rialto-open-now.png). Development only; production answers 404.
 */
export default function RenderOpen() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="home relative h-[900px] w-[1600px] overflow-hidden bg-cream text-coal">
      <style>{"nextjs-portal{display:none!important}"}</style>
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 40%, #fbf5e8 0%, #f6efe0 55%, #efe3cc 100%)" }} />
      <OpenScene width={1600} height={900} />
      <div className="absolute left-[88px] top-[72px] flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/rialto-logo.svg" alt="Rialto" className="h-[58px] w-auto" />
      </div>
      <div className="absolute right-[72px] top-[78px] flex items-center gap-2.5 border-[3px] border-coal bg-lime px-4 py-2 font-mono text-[18px] font-bold tracking-[0.08em] shadow-[5px_5px_0_var(--color-coal)]">
        <span className="size-2.5 rounded-full bg-coal" /> LIVE ON SOLANA MAINNET
      </div>
      <div className="absolute left-[88px] top-[205px] w-[820px]">
        <p className="text-[64px] font-bold leading-none tracking-[-0.045em]">The market is open</p>
        <div className="mt-6 inline-block -rotate-3 border-[6px] border-coal bg-lime px-8 pb-2 pt-1 shadow-[14px_14px_0_var(--color-coal)]">
          <span className="block text-[250px] font-bold leading-[0.9] tracking-[-0.07em]">NOW</span>
        </div>
        <p className="mt-12 max-w-[560px] text-[30px] font-medium leading-[1.22] tracking-[-0.02em] text-coal/80">Your agent finds, compares and pays for APIs. Per call, in USDC.</p>
        <div className="mt-9 inline-flex items-center gap-4 border-[3px] border-coal bg-[#fffdf7] px-7 py-4 text-[30px] font-bold tracking-[-0.02em] shadow-[7px_7px_0_var(--color-coal)]">
          galleriarialto.com <span aria-hidden>→</span>
        </div>
      </div>
      <div className="absolute bottom-[54px] left-[88px] font-mono text-[17px] font-bold uppercase tracking-[0.14em] text-coal/55">Claude Code · Codex · any MCP agent</div>
    </div>
  );
}
