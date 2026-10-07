import { Closing, Faq, Features, Header, Hero, HowItWorks, Pitch, Problem, Proof, Sides, Solana } from "@/components/home/Home";
import { Preloader } from "@/components/landing/Preloader";
import { StaticBanner } from "@/components/landing/StaticBanner";

/** The page reads as one argument: what it is, why it exists, how it works, what you get, how to start. */
export default function LandingPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Preloader />
      <StaticBanner />
      <Header />
      <main>
        <Hero />
        <Pitch />
        <Problem />
        <HowItWorks />
        <Features />
        <Proof />
        <Solana />
        <Sides />
        <Faq />
      </main>
      <Closing />
    </div>
  );
}
