import { PublishFlow } from "@/components/publish/PublishFlow";
import { PageShell } from "@/components/site/PageShell";

export const metadata = { title: "Publish an API — RIALTO" };

export default function PublishPage() {
  return (
    <PageShell>
      <PublishFlow />
    </PageShell>
  );
}
