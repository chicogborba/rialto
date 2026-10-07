import { Footer, Header, Hero, Pitch, Solana, Start, Story } from "@/components/home/Home";
import { Preloader } from "@/components/landing/Preloader";
import { StaticBanner } from "@/components/landing/StaticBanner";

/** Five things, in the video's order: the promise, the story, the video, the rail, the way in. */
export default function LandingPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Preloader />
      <StaticBanner />
      <Header />
      <main>
        <Hero />
        <Story />
        <Pitch />
        <Solana />
        <Start />
      </main>
      <Footer />
    </div>
  );
}
