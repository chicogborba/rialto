import { ConnectFlow } from "@/components/connect/ConnectFlow";
import { PageShell } from "@/components/site/PageShell";

export const metadata = { title: "Connect — RIALTO" };

export default function ConnectPage() {
  return (
    <PageShell>
      <ConnectFlow />
    </PageShell>
  );
}
