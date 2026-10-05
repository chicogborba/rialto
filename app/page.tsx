import { Composition } from "@/components/landing/Composition";
import { DecisionEngineSection } from "@/components/landing/DecisionEngineSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Network } from "@/components/landing/Network";
import { ProgrammableMoney } from "@/components/landing/ProgrammableMoney";
import { Thesis } from "@/components/landing/Thesis";
import { TICKER_ITEMS } from "@/components/landing/data";
import { Ticker } from "@/components/primitives";

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <Ticker items={TICKER_ITEMS} />
        <Thesis />
        <LiveDemo />
        <DecisionEngineSection />
        <Composition />
        <ProgrammableMoney />
        <Network />
      </main>
      <FinalCta />
    </>
  );
}
