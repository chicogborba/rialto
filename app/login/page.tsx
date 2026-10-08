import { Suspense } from "react";
import { AuthForm } from "@/components/account/AuthForm";
import { PageShell } from "@/components/site/PageShell";

export const metadata = { title: "Sign in — RIALTO" };

export default function LoginPage() {
  return (
    <PageShell>
      <div className="flex justify-center">
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </PageShell>
  );
}
