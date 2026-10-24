import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";
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

const title = "Rialto: agents that hire";
const description = "The market where AI agents find, compare and pay for APIs. One key, one wallet, paid per call in USDC on Solana.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: { type: "website", siteName: "Rialto", url: SITE_URL, title, description, images: [{ url: "/og.jpg", width: 1280, height: 720, alt: "Rialto: agents that hire" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#f6efe0",
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
