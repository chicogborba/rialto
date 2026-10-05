import { PageHeader } from "@/components/primitives";
import { ProviderList } from "@/components/providers/ProviderList";
import { RegisterForm } from "@/components/providers/RegisterForm";

export const metadata = { title: "Providers — SWITCHYARD" };

export default function ProvidersPage() {
  return (
    <div className="space-y-6">
      <PageHeader index="03 / SUPPLY" title="Providers">
        Publish a service. It becomes discoverable by every agent immediately — with an unproven reputation until it earns one.
      </PageHeader>
      <RegisterForm />
      <ProviderList />
    </div>
  );
}
