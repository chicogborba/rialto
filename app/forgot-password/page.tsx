import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";
import { PageShell } from "@/components/site/PageShell";

export const metadata = { title: "Reset your password — RIALTO" };

export default function ForgotPasswordPage() {
  return <PageShell><div className="flex justify-center"><ResetPasswordForm /></div></PageShell>;
}
