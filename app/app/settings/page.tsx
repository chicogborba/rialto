import { PageHeader } from "@/components/primitives";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata = { title: "Settings — SWITCHYARD" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader index="06 / POLICY" title="Wallet & policy">
        Programmable money: the agent checks every purchase against these rules before it signs anything.
      </PageHeader>
      <SettingsPanel />
    </>
  );
}
