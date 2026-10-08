import { AccountShell } from "@/components/account/AccountShell";
import { AccountProvider } from "@/lib/client/account";

export const metadata = { title: "Dashboard — RIALTO" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <AccountShell>{children}</AccountShell>
    </AccountProvider>
  );
}
