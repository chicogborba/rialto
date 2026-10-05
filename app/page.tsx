import { BigStatement } from "@/components/landing/BigStatement";
import { Compare } from "@/components/landing/Compare";
import { CursorTrail } from "@/components/landing/CursorTrail";
import { DecisionEngineSection } from "@/components/landing/DecisionEngineSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { ImageCompare } from "@/components/landing/ImageCompare";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Solana } from "@/components/landing/Solana";
import { Story } from "@/components/landing/Story";
import { Why } from "@/components/landing/Why";

export default function LandingPage() {
  return (
    <div className="relative">
      <CursorTrail />
      <LandingHeader />
      <main>
        <Story />
        <Why />
        <Solana />
        <Compare />
        <ImageCompare />
        <BigStatement />
        <LiveDemo />
        <DecisionEngineSection />
      </main>
      <FinalCta />
    </div>
  );
}
