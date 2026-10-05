import { BigStatement } from "@/components/landing/BigStatement";
import { Compare } from "@/components/landing/Compare";
import { DecisionEngineSection } from "@/components/landing/DecisionEngineSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Story } from "@/components/landing/Story";

export default function LandingPage() {
  return (
    <div className="relative">
      <LandingHeader />
      <main>
        <Story />
        <Compare />
        <BigStatement />
        <LiveDemo />
        <DecisionEngineSection />
      </main>
      <FinalCta />
    </div>
  );
}
