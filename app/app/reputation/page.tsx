import { PageHeader } from "@/components/primitives";
import { ReputationBoard } from "@/components/reputation/ReputationBoard";

export const metadata = { title: "Reputation — SWITCHYARD" };

export default function ReputationPage() {
  return (
    <>
      <PageHeader index="05 / TRUST" title="Provider reputation">
        The agent doesn&apos;t blindly choose the cheapest API. Reputation, success rate and recent history feed every decision.
      </PageHeader>
      <ReputationBoard />
    </>
  );
}
