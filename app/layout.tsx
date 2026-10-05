import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SWITCHYARD — x402 lets agents pay. We let them decide who.",
  description:
    "An autonomous service procurement and routing layer for AI agents. Discover, evaluate, purchase and compose machine-readable services over x402.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col font-display">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
