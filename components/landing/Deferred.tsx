"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useInViewOnce } from "@/hooks/useInViewOnce";

// The two interactive sections pull in the animation library and a recorded run. They sit far below
// the fold, so their code is fetched in idle time and they mount when you get close.
const loadDemo = () => import("./LiveDemo").then((m) => m.LiveDemo);
const loadEngine = () => import("./DecisionEngineSection").then((m) => m.DecisionEngineSection);
const LiveDemo = dynamic(loadDemo, { ssr: false });
const DecisionEngineSection = dynamic(loadEngine, { ssr: false });

function Near({ children, minHeight }: { children: React.ReactNode; minHeight: number }) {
  const { ref, seen } = useInViewOnce<HTMLDivElement>("1400px");
  return (
    <div ref={ref} style={seen ? undefined : { minHeight }} className={seen ? undefined : "border-t border-line"}>
      {seen ? children : null}
    </div>
  );
}

export function DeferredSections() {
  useEffect(() => {
    const warm = () => {
      void loadDemo();
      void loadEngine();
    };
    const timer = window.setTimeout(warm, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Near minHeight={900}>
        <LiveDemo />
      </Near>
      <Near minHeight={800}>
        <DecisionEngineSection />
      </Near>
    </>
  );
}
