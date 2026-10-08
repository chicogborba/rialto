"use client";

import { useState } from "react";
import { HardButton, Label, Panel } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { Field, inputCls, Notice } from "./ui";

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
      <header>
        <Label tone="signal">Settings</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">Your account.</h1>
      </header>

      <Panel title="Profile" bodyClassName="space-y-4">
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
      </Panel>

      <Panel title="Password" bodyClassName="space-y-4">
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
        <p className="font-mono text-[11px] text-muted">There is no email recovery yet: if you forget your password, the operator of this server has to reset it.</p>
      </Panel>

      <Panel title={`Signed-in devices (${account.sessions.length})`} bodyClassName="p-0">
        <ul className="divide-y divide-line font-mono text-xs">
          {account.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate">
                {s.userAgent?.slice(0, 70) ?? "Unknown device"} {s.current && <span className="text-signal">· this device</span>}
              </span>
              <span className="text-muted">last used {new Date(s.lastUsedAt).toLocaleString("en-GB", { hour12: false })}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
          <HardButton variant="ghost" onClick={others} disabled={account.sessions.length < 2}>
            Sign out other devices
          </HardButton>
          <HardButton variant="ghost" onClick={() => signOut(true)}>
            Sign out everywhere
          </HardButton>
          {sessMsg && <Notice tone={sessMsg.tone}>{sessMsg.text}</Notice>}
        </div>
      </Panel>
    </div>
  );
}
