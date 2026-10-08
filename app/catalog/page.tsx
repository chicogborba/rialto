import type { Metadata } from "next";
import Link from "next/link";
import { Catalog, type CatalogItem } from "@/components/catalog/Catalog";
import { Footer, Header } from "@/components/home/Home";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { flowHref } from "@/lib/site";
import type { CapabilityId } from "@/lib/types";
import { SEED_PROVIDERS, SEED_SERVICES } from "@/prisma/seed-data";

export const metadata: Metadata = {
  title: "Catalog · Rialto",
  description: "The APIs an agent can hire through Rialto: what each one does, what it costs per call and how it scores.",
};

const LOOK: Record<CapabilityId, { emoji: string; color: string }> = {
  "data.lookup": { emoji: "🗂️", color: "#c6ff3d" },
  "image.sprites": { emoji: "🎮", color: "#c6ff3d" },
  "vision.damage_detection": { emoji: "👁️", color: "#5ce1e6" },
  "market.quotes": { emoji: "📈", color: "#ffd23f" },
  "news.search": { emoji: "📰", color: "#ff8fb3" },
  "filings.sec": { emoji: "📑", color: "#b98cff" },
  "web.search": { emoji: "🔎", color: "#14f195" },
  "llm.analysis": { emoji: "🧠", color: "#ee7a35" },
  "text.translate": { emoji: "🌍", color: "#5ce1e6" },
  "text.summarize": { emoji: "✂️", color: "#ffd23f" },
};

/** The demo registry, straight from the seed data the app itself uses. All providers are fictional. */
const ITEMS: CatalogItem[] = SEED_PROVIDERS.flatMap((provider) => {
  const service = SEED_SERVICES.find((s) => s.providerId === provider.id);
  if (!service) return [];
  return [
    {
      name: provider.name,
      description: provider.description,
      category: CAPABILITY_LABELS[service.capability],
      ...LOOK[service.capability],
      priceUsd: service.priceMicro / 1_000_000,
      latencyMs: provider.latencyMs,
      quality: provider.qualityScore,
      trust: provider.reputationScore,
      calls: provider.requestCount,
      offline: provider.status !== "online",
    },
  ];
});

export default function CatalogPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6 md:px-8 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.05em]">
              The <span className="home-mark">catalog.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-snug text-coal/75 md:text-xl">Every API your agent can hire, with the price per call. Demo data: these providers are fictional.</p>
          </div>
          <Link href={flowHref("/signup?next=/dashboard/apis")} className="home-btn home-btn-ink">Publish yours →</Link>
        </div>
        <div className="mt-10">
          <Catalog items={ITEMS} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
