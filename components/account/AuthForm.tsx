"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Buddy } from "@/components/landing/Buddy";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

/** A path on this site, never another address: where to go once signed in. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith("/api/") ? next : "/dashboard";
}

const input = "mt-1.5 block min-h-12 w-full border-2 border-coal bg-[#fffdf7] px-3.5 text-[16px] text-coal placeholder:text-coal/35 focus-visible:outline-none focus-visible:shadow-[4px_4px_0_var(--color-lime)]";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");

  // someone who is already signed in has nothing to do here
  useEffect(() => {
    let alive = true;
    void api("/api/auth/me").then((r) => alive && r.ok && router.replace(next));
    return () => {
      alive = false;
    };
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api(verifying ? "/api/auth/verify-email" : signup ? "/api/auth/signup" : "/api/auth/login", { json: verifying ? { email, code } : signup ? { email, password, name: name.trim() || email.split("@")[0] } : { email, password } });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    if (signup && !verifying) {
      setVerifying(true);
      setBusy(false);
      return;
    }
    router.replace(next);
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    const r = await api("/api/auth/signup", { json: { email, password, name: name.trim() || email.split("@")[0] } });
    if (!r.ok) setError(r.error);
    else setCode("");
    setBusy(false);
  };

  const other = `${signup ? "/login" : "/signup"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;
  const tooShort = signup && password.length > 0 && password.length < 10;
  return (
    <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-16">
      <div className="hidden md:block">
        <Buddy mood={signup ? "wave" : "happy"} className="w-24" />
        <h1 className="mt-6 text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">{signup ? (
            <>
              Your agent&apos;s first shopping trip
            </>
          ) : (
            <>
              Welcome back
            </>
          )}</h1>
        <p className="mt-4 max-w-sm text-lg leading-snug text-coal/70">{signup ? "Connect Claude Code, Codex or any MCP agent, set a limit, and let it buy the APIs it needs." : "Your agents, your wallet and your APIs are where you left them."}</p>
      </div>

      <form onSubmit={submit} className="w-full border-2 border-coal bg-[#fffdf7] p-6 shadow-[8px_8px_0_var(--color-coal)] md:p-8">
        <h2 className="text-3xl font-bold tracking-[-0.04em] md:text-[2rem]">{verifying ? "Check your email" : signup ? "Create your account" : "Sign in"}</h2>
        <p className="mt-1.5 break-words text-coal/60">{verifying ? `We sent a six-digit code to ${email}.` : signup ? "Free. Confirm your email to get started." : "Good to see you again."}</p>

        {verifying ? (
          <div className="mt-6">
            <label className="block">
              <span className="text-sm font-bold">Confirmation code</span>
              <input className={cn(input, "text-center font-mono text-2xl tracking-[0.35em]")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus placeholder="000000" required />
            </label>
            <p className="mt-3 text-sm text-coal/60">The code expires in 10 minutes. Check your spam folder too.</p>
          </div>
        ) : <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold">Email</span>
            <input className={input} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={signup ? "email" : "username"} autoFocus placeholder="you@example.com" required />
          </label>
          {signup && (
            <label className="block">
              <span className="text-sm font-bold">
                Your name <span className="font-normal text-coal/50">(optional)</span>
              </span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="What should we call you?" />
            </label>
          )}
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-bold">
              Password
              {signup && <span className={cn("font-mono text-[11px] font-normal", tooShort ? "text-fail" : "text-coal/50")}>{password.length}/10+</span>}
            </span>
            <span className="relative block">
              <input className={cn(input, "pr-20")} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 10 : 1} placeholder={signup ? "A few random words work great" : ""} required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} className="absolute right-2 top-1/2 mt-[3px] -translate-y-1/2 px-2 py-1 text-sm font-bold text-coal/60 hover:text-coal">
                {show ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        </div>}

        {error && (
          <p role="alert" className="mt-4 border-2 border-fail bg-fail/5 px-3 py-2 text-sm font-medium text-fail">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || (verifying ? code.length !== 6 : !email || !password || tooShort)} className="home-btn home-btn-ink mt-6 w-full justify-center text-[17px] disabled:pointer-events-none disabled:opacity-40">
          {busy ? "One moment…" : verifying ? "Confirm email →" : signup ? "Send confirmation code →" : "Sign in →"}
        </button>

        {verifying && <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm font-bold">
          <button type="button" disabled={busy} onClick={() => void resend()} className="underline underline-offset-4 disabled:opacity-40">Resend code</button>
          <button type="button" disabled={busy} onClick={() => { setVerifying(false); setCode(""); setError(null); }} className="underline underline-offset-4 disabled:opacity-40">Change email</button>
          <p className="w-full text-center text-xs font-normal text-coal/50">Wait a minute before requesting another code.</p>
        </div>}

        {signup && (
          <p className="mt-3 text-center text-xs leading-relaxed text-coal/55">
            By creating an account you agree to our{" "}
            <Link href="/terms" target="_blank" className="font-bold text-coal underline decoration-coal/30 underline-offset-2 hover:decoration-coal">Terms of Service</Link> and{" "}
            <Link href="/privacy" target="_blank" className="font-bold text-coal underline decoration-coal/30 underline-offset-2 hover:decoration-coal">Privacy Policy</Link>, and confirm you are 18 or older.
          </p>
        )}

        <p className="mt-5 text-center text-coal/70">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <Link href={other} className="font-bold text-coal underline decoration-lime decoration-4 underline-offset-4 hover:decoration-coal">
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!signup && <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="font-bold text-coal/70 underline underline-offset-4 hover:text-coal">Forgot your password?</Link></p>}
      </form>
    </div>
  );
}
