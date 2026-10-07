import { Footer, Header, Hero, Pitch, Solana, Start, Story, Wins } from "@/components/home/Home";
import { Preloader } from "@/components/landing/Preloader";
import { StaticBanner } from "@/components/landing/StaticBanner";

/** Five things, in the video's order: the promise, the story, the video, the rail, the way in. */
export default function LandingPage() {
  return (
    <div className="home min-h-screen bg-cream text-coal">
      <Preloader />
      <StaticBanner />
      {/* the top of the page is one stage: title card, then the story plays on it */}
      <div className="bg-sand/50">
        <Header />
      </div>
      <main>
        <div className="bg-sand/50">
          <Hero />
          <Story />
        </div>
        <Wins />
        <Pitch />
        <Solana />
        <Start />
      </main>
      <Footer />
    </div>
  );
}
