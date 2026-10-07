import { PageHeader } from "@/components/primitives";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";

export const metadata = { title: "Transactions — RIALTO" };

export default function TransactionsPage() {
  return (
    <>
      <PageHeader index="04 / LEDGER" title="Transactions">
        Every purchase the agent attempted. Failed calls are never settled — the agent is not charged.
      </PageHeader>
      <TransactionsTable />
    </>
  );
}
