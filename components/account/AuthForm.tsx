"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HardButton, Label } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { Field, inputCls, Notice } from "./ui";

/** A path on this site, never another address: where to go once signed in. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith("/api/") ? next : "/dashboard";
}

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
    const r = await api(signup ? "/api/auth/signup" : "/api/auth/login", { json: signup ? { email, password, name } : { email, password } });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.replace(next);
  };

  const other = `${signup ? "/login" : "/signup"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-5 border-2 border-ink bg-surface p-6 shadow-[8px_8px_0_var(--color-signal)]">
      <div>
        <Label tone="signal">{signup ? "New account" : "Welcome back"}</Label>
        <h1 className="mt-3 text-4xl font-bold uppercase leading-[0.9] tracking-[-0.04em]">{signup ? "Create your account" : "Sign in"}</h1>
        {signup && <p className="mt-3 text-sm text-muted">One account to connect your AI agents, publish APIs and manage the money. New accounts start with a test credit.</p>}
      </div>
      {signup && (
        <Field label="Your name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
        </Field>
      )}
      <Field label="Email">
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      <Field label="Password" hint={signup ? "At least 10 characters. A few random words is better than symbols." : undefined}>
        <div className="relative">
          <input className={`${inputCls} pr-20`} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 10 : 1} required />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold uppercase text-muted hover:text-signal" style={{ marginTop: 4 }}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <HardButton type="submit" size="lg" className="w-full" disabled={busy || !email || !password || (signup && !name.trim())}>
        {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
      </HardButton>
      <p className="font-mono text-xs text-muted">
        {signup ? "Already have an account?" : "No account yet?"}{" "}
        <Link href={other} className="underline hover:text-signal">
          {signup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
