import Link from "next/link";
import { hardButtonClass, PageHeader } from "@/components/primitives";
import { ProviderList } from "@/components/providers/ProviderList";

export const metadata = { title: "Providers — RIALTO" };

export default function ProvidersPage() {
  return (
    <div className="space-y-6">
      <PageHeader index="03 / SUPPLY" title="Providers">
        Everything the agent can hire. Demo providers are fictional; APIs published by sellers are live and earn per call.
      </PageHeader>
      <div className="flex flex-wrap items-center gap-4 border-2 border-ink bg-surface p-4 shadow-[6px_6px_0_var(--color-signal)]">
        <p className="min-w-0 flex-1 text-lg font-bold">Got an API? Publish it, set your price, get paid per call. 💸</p>
        <Link href="/dashboard/apis" className={hardButtonClass("primary")}>Publish an API</Link>
      </div>
      <ProviderList />
    </div>
  );
}
