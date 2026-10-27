"use client";

import { useState } from "react";
import Link from "next/link";
import { LockKeyhole, MonitorSmartphone, UserRound } from "lucide-react";
import { HardButton } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { Field, inputCls, Notice, PageHead, Section } from "./ui";

/** "Chrome on macOS" from a user agent, good enough to recognise your own devices. */
function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

type Msg = { tone: "ok" | "error"; text: string } | null;

export function Settings() {
  const { account, refresh, signOut } = useAccount();
  const [name, setName] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [sessMsg, setSessMsg] = useState<Msg>(null);
  if (!account) return null;

  const saveName = async () => {
    const r = await api("/api/account", { method: "PATCH", json: { name: name ?? account.user.name } });
    setNameMsg(r.ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: r.error ?? "Could not save." });
    if (r.ok) await refresh();
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api("/api/auth/password", { json: { current: pw.current, next: pw.next } });
    setPwMsg(r.ok ? { tone: "ok", text: "Password changed. Your other devices were signed out." } : { tone: "error", text: r.error ?? "Could not change it." });
    if (r.ok) {
      setPw({ current: "", next: "" });
      await refresh();
    }
  };
  const others = async () => {
    const r = await api<{ signedOut: number }>("/api/account/sessions", { method: "DELETE" });
    setSessMsg(r.ok ? { tone: "ok", text: `Signed out ${r.data?.signedOut ?? 0} other device(s).` } : { tone: "error", text: r.error ?? "Failed." });
    await refresh();
  };

  return (
    <div className="space-y-8">
      <PageHead title={<>Your <span className="sy-mark">account.</span></>} />

      <Section title="Profile" icon={UserRound} bodyClassName="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input className={`${inputCls} opacity-60`} value={account.user.email} readOnly />
          </Field>
          <Field label="Name">
            <input className={inputCls} value={name ?? account.user.name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HardButton onClick={saveName} disabled={name === null || !name.trim()}>
            Save
          </HardButton>
          {nameMsg && <Notice tone={nameMsg.tone}>{nameMsg.text}</Notice>}
        </div>
      </Section>

      <Section title="Password" icon={LockKeyhole} bodyClassName="space-y-4">
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <input className={inputCls} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </Field>
          <Field label="New password" hint="At least 10 characters.">
            <input className={inputCls} type="password" autoComplete="new-password" minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <HardButton type="submit" disabled={!pw.current || pw.next.length < 10}>
              Change password
            </HardButton>
            {pwMsg && <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>}
          </div>
        </form>
        <p className="text-sm text-coal/60">
          Forgot it? <Link href="/forgot-password" className="underline hover:text-signal">Get a reset code by email</Link>.
        </p>
      </Section>

      <Section title="Signed-in devices" icon={MonitorSmartphone} aside={`${account.sessions.length}`} bodyClassName="p-0">
        <ul className="divide-y-2 divide-coal/10">
          {account.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  {deviceName(s.userAgent)} {s.current && <span className="ml-1 border-2 border-coal bg-lime px-1.5 text-xs">This device</span>}
                </span>
                <span className="block text-xs text-coal/60">Last used {new Date(s.lastUsedAt).toLocaleString("en-GB", { hour12: false, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-coal/10 p-5">
          <HardButton variant="ghost" onClick={others} disabled={account.sessions.length < 2}>
            Sign out other devices
          </HardButton>
          <HardButton variant="ghost" onClick={() => signOut(true)}>
            Sign out everywhere
          </HardButton>
          {sessMsg && <Notice tone={sessMsg.tone}>{sessMsg.text}</Notice>}
        </div>
      </Section>
    </div>
  );
}
