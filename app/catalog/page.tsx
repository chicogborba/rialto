import type { Metadata } from "next";
import Link from "next/link";
import { Catalog } from "@/components/catalog/Catalog";
import { Footer, Header } from "@/components/home/Home";
import type { CatalogEntry } from "@/lib/api-types";
import { flowHref } from "@/lib/site";
import { SEED_PROVIDERS, SEED_SERVICES } from "@/prisma/seed-data";

export const metadata: Metadata = {
  title: "Catalog · Rialto",
  description: "The APIs an agent can hire through Rialto: what each one does, what it costs per call and how it scores.",
};

/** Only used where there is no server (the static preview): the demo registry, straight from the seed. */
const FALLBACK: CatalogEntry[] = SEED_PROVIDERS.flatMap((provider) => {
  const service = SEED_SERVICES.find((s) => s.providerId === provider.id);
  if (!service) return [];
  return [
    {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      capability: service.capability,
      priceMicro: service.priceMicro,
      latencyMs: provider.latencyMs,
      quality: provider.qualityScore,
      reputation: provider.reputationScore,
      successRate: provider.successRate,
      calls: provider.requestCount,
      offline: provider.status !== "online",
      demo: true,
      unproven: false,
      settlement: "simulated" as const,
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
            <p className="mt-4 max-w-xl text-lg leading-snug text-coal/75 md:text-xl">Every API your agent can hire, with what it costs per call. The ones marked Live were published by people and are paid for real; Demo ones are fictional.</p>
          </div>
          <Link href={flowHref("/signup?next=/dashboard/apis")} className="home-btn home-btn-ink">Publish yours →</Link>
        </div>
        <div className="mt-10">
          <Catalog fallback={FALLBACK} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
