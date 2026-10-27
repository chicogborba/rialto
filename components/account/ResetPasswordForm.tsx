"use client";

import Link from "next/link";
import { useState } from "react";
import { Buddy } from "@/components/landing/Buddy";
import { api } from "@/lib/client/api";

const input = "mt-1.5 block min-h-12 w-full border-2 border-coal bg-[#fffdf7] px-3.5 text-[16px] text-coal placeholder:text-coal/35 focus-visible:outline-none focus-visible:shadow-[4px_4px_0_var(--color-lime)]";

export function ResetPasswordForm() {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await api("/api/auth/forgot-password", { json: { email } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStep("code");
    setNotice("If an account exists for that email, we have sent a reset code. Check your spam folder too.");
    setCode("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "email") return sendCode();
    setBusy(true);
    setError(null);
    const r = await api("/api/auth/reset-password", { json: { email, code, password } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPassword("");
    setStep("done");
  };

  return (
    <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-16">
      <div className="hidden md:block">
        <Buddy mood="wave" className="w-24" />
        <h1 className="mt-6 text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Back to your market.</h1>
        <p className="mt-4 max-w-sm text-lg leading-snug text-coal/70">A quick email check, a new password, and you&apos;re back with your agents.</p>
      </div>
      <form onSubmit={submit} className="w-full border-2 border-coal bg-[#fffdf7] p-6 shadow-[8px_8px_0_var(--color-coal)] md:p-8">
        <h2 className="text-3xl font-bold tracking-[-0.04em] md:text-[2rem]">{step === "done" ? "Password updated" : "Reset your password"}</h2>
        <p className="mt-2 break-words text-coal/60">{step === "done" ? "Your other sessions have been signed out. Sign in with your new password." : step === "email" ? "Enter the email you use for Rialto." : `Enter the code for ${email} and choose a new password.`}</p>
        {step !== "done" && <div className="mt-6 space-y-4">
          {step === "email" ? <label className="block">
            <span className="text-sm font-bold">Email</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} autoFocus placeholder="you@example.com" required />
          </label> : <>
            <p role="status" className="text-sm leading-relaxed text-coal/70">{notice}</p>
            <label className="block">
              <span className="text-sm font-bold">Reset code</span>
              <input className={`${input} text-center font-mono text-2xl tracking-[0.35em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus placeholder="000000" required />
            </label>
            <label className="block">
              <span className="text-sm font-bold">New password <span className="font-normal text-coal/50">(at least 10 characters)</span></span>
              <span className="relative block">
                <input className={`${input} pr-20`} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required />
                <button type="button" onClick={() => setShow((value) => !value)} aria-pressed={show} className="absolute right-2 top-1/2 mt-[3px] -translate-y-1/2 px-2 py-1 text-sm font-bold text-coal/60">{show ? "Hide" : "Show"}</button>
              </span>
            </label>
            <p className="text-xs text-coal/55">The code expires in 10 minutes.</p>
          </>}
        </div>}
        {error && <p role="alert" className="mt-4 border-2 border-fail bg-fail/5 px-3 py-2 text-sm font-medium text-fail">{error}</p>}
        {step !== "done" && <button type="submit" disabled={busy || !email || (step === "code" && (code.length !== 6 || password.length < 10))} className="home-btn home-btn-ink mt-6 w-full justify-center text-[17px] disabled:pointer-events-none disabled:opacity-40">{busy ? "One moment…" : step === "email" ? "Send reset code →" : "Save new password →"}</button>}
        {step === "code" && <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm font-bold">
          <button type="button" disabled={busy} onClick={() => void sendCode()} className="underline underline-offset-4 disabled:opacity-40">Resend code</button>
          <button type="button" disabled={busy} onClick={() => { setStep("email"); setError(null); }} className="underline underline-offset-4 disabled:opacity-40">Change email</button>
          <p className="w-full text-center text-xs font-normal text-coal/50">Wait a minute before requesting another code.</p>
        </div>}
        <p className="mt-6 text-center"><Link href="/login" className="font-bold text-coal underline decoration-lime decoration-4 underline-offset-4 hover:decoration-coal">{step === "done" ? "Sign in →" : "Back to sign in"}</Link></p>
      </form>
    </div>
  );
}
