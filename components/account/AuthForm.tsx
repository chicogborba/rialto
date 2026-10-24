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
    const r = await api(signup ? "/api/auth/signup" : "/api/auth/login", { json: signup ? { email, password, name: name.trim() || email.split("@")[0] } : { email, password } });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.replace(next);
  };

  const other = `${signup ? "/login" : "/signup"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;
  const tooShort = signup && password.length > 0 && password.length < 10;
  return (
    <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-16">
      <div className="hidden md:block">
        <Buddy mood={signup ? "wave" : "happy"} className="w-24" />
        <h1 className="mt-6 text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">{signup ? (
            <>
              Your agent&apos;s first shopping <span className="whitespace-nowrap">trip 🛒</span>
            </>
          ) : (
            <>
              Welcome <span className="whitespace-nowrap">back 👋</span>
            </>
          )}</h1>
        <p className="mt-4 max-w-sm text-lg leading-snug text-coal/70">{signup ? "Connect Claude Code, Codex or any MCP agent, set a limit, and let it buy the APIs it needs." : "Your agents, your wallet and your APIs are where you left them."}</p>
      </div>

      <form onSubmit={submit} className="w-full border-2 border-coal bg-[#fffdf7] p-6 shadow-[8px_8px_0_var(--color-coal)] md:p-8">
        <h2 className="text-3xl font-bold tracking-[-0.04em] md:text-[2rem]">{signup ? "Create your account" : "Sign in"}</h2>
        <p className="mt-1.5 text-coal/60">{signup ? "Free. Takes 20 seconds." : "Good to see you again."}</p>

        <div className="mt-6 space-y-4">
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
        </div>

        {error && (
          <p role="alert" className="mt-4 border-2 border-fail bg-fail/5 px-3 py-2 text-sm font-medium text-fail">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !email || !password || tooShort} className="home-btn home-btn-ink mt-6 w-full justify-center text-[17px] disabled:pointer-events-none disabled:opacity-40">
          {busy ? "One moment…" : signup ? "Create account →" : "Sign in →"}
        </button>

        <p className="mt-5 text-center text-coal/70">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <Link href={other} className="font-bold text-coal underline decoration-lime decoration-4 underline-offset-4 hover:decoration-coal">
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!signup && <p className="mt-3 text-center text-xs text-coal/45">Forgot your password? Write to us on X, @GalleriaRialto, and we will reset it.</p>}
      </form>
    </div>
  );
}
