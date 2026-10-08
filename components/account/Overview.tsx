"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import type { TransactionRow } from "@/lib/api-types";
import { Stat } from "./ui";

/** What to do next, derived from the account itself: it ticks off as you go. */
function Checklist() {
  const { account } = useAccount();
  if (!account) return null;
  const funded = account.agents.some((a) => a.balanceMicro > 0);
  const used = account.ledger.some((l) => l.kind === "purchase");
  const steps = [
    { done: account.agents.length > 0, title: "Create an agent", text: "A key for Claude Code, Codex or any MCP client.", href: "/dashboard/agents" },
    { done: funded, title: "Give it some money", text: "Move part of your balance to the agent. It cannot spend more than that.", href: "/dashboard/agents" },
    { done: used, title: "Ask for something", text: "Paste the connect command in your terminal, then ask: “Use rialto to look up the Pokémon pikachu.”", href: "/dashboard/agents" },
    { done: account.user.wallet !== null, title: "Add your wallet", text: "Where you get paid, and where deposits come from.", href: "/dashboard/wallet" },
    { done: (account.seller?.apis ?? 0) > 0, title: "Publish an API (optional)", text: "Let other agents hire yours and pay per call.", href: "/dashboard/apis" },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <Panel title="Getting started" status={<span className="font-mono text-[10px] text-muted">{steps.filter((s) => s.done).length} / {steps.length}</span>} bodyClassName="p-0">
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className={`flex items-start gap-4 p-4 hover:bg-raised ${i === next ? "bg-raised" : ""}`}>
              <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center border font-mono text-xs font-bold ${s.done ? "border-signal bg-signal text-ink" : i === next ? "border-signal text-signal" : "border-line-hi text-muted"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-bold ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                <span className="block text-sm text-muted">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function Overview() {
  const { account } = useAccount();
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    void api<{ rows: TransactionRow[] }>("/api/account/activity").then((r) => alive && setRows(r.data?.rows ?? []));
    return () => {
      alive = false;
    };
  }, []);
  if (!account) return null;
  const inAgents = account.agents.reduce((s, a) => s + a.balanceMicro, 0);
  return (
    <div className="space-y-8">
      <header>
        <Label tone="signal">Dashboard</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">Hi, {account.user.name.split(" ")[0]}.</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On your account" value={formatUsd(account.user.balanceMicro)} hint="Not given to an agent yet" />
        <Stat label="In your agents" value={formatUsd(inAgents)} hint={`${account.agents.length} agent${account.agents.length === 1 ? "" : "s"}`} />
        <Stat label="Your APIs" value={account.seller ? `${account.seller.online}/${account.seller.apis}` : "0"} hint="Online / published" />
        <Stat label="Earned & paid out" value={formatUsd(account.seller ? account.seller.paidOutMicro + account.seller.balanceMicro : 0)} hint={account.mode === "live" ? "Paid to your wallet on each call" : "Simulated"} />
      </div>

      <Checklist />

      <Panel title="Recent calls by your agents" bodyClassName="p-0">
        {rows === null ? (
          <p className="p-4 font-mono text-xs text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 font-mono text-xs text-muted">Nothing yet. When your agent hires an API, it shows up here.</p>
        ) : (
          <ul className="divide-y divide-line font-mono text-xs">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">
                  <span className="text-muted">{new Date(t.createdAt).toLocaleString("en-GB", { hour12: false })}</span> · {t.providerName} · {t.capability}
                </span>
                <span className="flex items-center gap-3">
                  <span className={t.mode === "live" ? "text-signal" : "text-pay"}>{t.mode.toUpperCase()}</span>
                  <span className="tnum">{t.status === "settled" ? formatUsd(t.amountMicro) : "not charged"}</span>
                  {t.explorerUrl && (
                    <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="underline hover:text-signal">
                      explorer ↗
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
