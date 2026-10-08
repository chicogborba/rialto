import { Footer, Header, Hero, Pitch, Sides, Solana, Start, Story } from "@/components/home/Home";
import { Preloader } from "@/components/landing/Preloader";
import { StaticBanner } from "@/components/landing/StaticBanner";

/** The promise, the video, who it is for, how it works, the rail it pays on, the way in. */
export default function LandingPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Preloader />
      <StaticBanner />
      <Header />
      <main>
        <Hero />
        <Pitch />
        <Sides />
        <Story />
        <Solana />
        <Start />
      </main>
      <Footer />
    </div>
  );
}
