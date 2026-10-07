import Link from "next/link";
import { AppNav } from "@/components/shell/AppNav";
import { ResetButton } from "@/components/shell/ResetButton";
import { WalletChip } from "@/components/shell/WalletChip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur-none">
        <Link href="/" className="text-lg font-bold uppercase tracking-tight">
          Rial<span className="text-signal">to</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <WalletChip />
          <ResetButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <AppNav />
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
