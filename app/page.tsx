import { Closing, Header, Hero, HowItWorks, Pitch, Proof, Sides } from "@/components/home/Home";
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
        <Sides />
      </main>
      <Closing />
    </div>
  );
}
