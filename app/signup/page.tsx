import { Suspense } from "react";
import { AuthForm } from "@/components/account/AuthForm";
import { PageShell } from "@/components/site/PageShell";

export const metadata = { title: "Create your account — RIALTO" };

export default function SignupPage() {
  return (
    <PageShell>
      <div className="flex justify-center">
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </PageShell>
  );
}
