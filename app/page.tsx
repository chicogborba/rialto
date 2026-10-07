import { Closing, Header, Hero, HowItWorks, Pitch, Proof, Sides, Solana } from "@/components/home/Home";
import { Preloader } from "@/components/landing/Preloader";
import { StaticBanner } from "@/components/landing/StaticBanner";

export default function LandingPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Preloader />
      <StaticBanner />
      <Header />
      <main>
        <Hero />
        <Pitch />
        <HowItWorks />
        <Proof />
        <Solana />
        <Sides />
      </main>
      <Closing />
    </div>
  );
}
