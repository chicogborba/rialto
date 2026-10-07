import { MarketTable } from "@/components/marketplace/MarketTable";
import { PageHeader } from "@/components/primitives";

export const metadata = { title: "Exchange — RIALTO" };

export default function MarketplacePage() {
  return (
    <>
      <PageHeader index="02 / EXCHANGE" title="Service marketplace">
        This is the supply side. Agents read it; they don&apos;t browse it. All seeded providers are fictional demo providers.
      </PageHeader>
      <MarketTable />
    </>
  );
}
