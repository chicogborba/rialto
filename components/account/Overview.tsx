"use client";

import { ArrowRight, Check, ListChecks, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hardButtonClass } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import type { TransactionRow } from "@/lib/api-types";
import { lookOf } from "@/components/catalog/look";
import { AgentCard } from "./Agents";
import { PageHead, Section, Stat } from "./ui";

/** What to do next, derived from the account itself: it ticks off as you go. */
function Checklist() {
  const { account } = useAccount();
  if (!account) return null;
  const live = !account.simulationEnabled;
  // on the live rail agents pay from the owner's wallet; on the simulation, from play money moved to them
  const funded = live ? Boolean(account.user.payWallet) : account.agents.some((a) => a.balanceMicro > 0);
  const used = account.ledger.some((l) => l.kind === "purchase") || account.agents.some((a) => a.sessionSpendMicro > 0);
  const steps = [
    { done: account.agents.length > 0, title: "Create an agent", text: "A key for Claude Code, Codex or any MCP client.", href: "/dashboard/agents" },
    live
      ? { done: funded, title: "Let it pay from your wallet", text: "Approve a spending limit once, in Phantom or any Solana wallet. Your money stays in your wallet.", href: "/dashboard/wallet" }
      : { done: funded, title: "Give it some money", text: "Move part of your balance to the agent. It cannot spend more than that.", href: "/dashboard/agents" },
    { done: used, title: "Ask for something", text: "Paste the connect command in your terminal, then ask: “Use rialto to look up the Pokémon pikachu.”", href: "/dashboard/agents" },
    { done: account.user.wallet !== null, title: "Add your wallet", text: "Where you get paid when other agents use your APIs.", href: "/dashboard/wallet" },
    { done: (account.seller?.apis ?? 0) > 0, title: "Publish an API (optional)", text: "Let other agents hire yours and pay per call.", href: "/dashboard/apis" },
  ];
  const next = steps.findIndex((s) => !s.done);
  if (next === -1) return null;
  return (
    <Section title="Getting started" icon={ListChecks} aside={`${steps.filter((s) => s.done).length} of ${steps.length} done`} bodyClassName="p-0">
      <ol className="divide-y-2 divide-coal/10">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className={`flex items-start gap-4 p-4 hover:bg-sand/40 ${i === next ? "bg-lime/25" : ""}`}>
              <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center border font-mono text-xs font-bold ${s.done ? "border-coal bg-lime" : i === next ? "border-coal bg-surface" : "border-coal/25 text-coal/50"}`}>
                {s.done ? <Check className="size-3.5" strokeWidth={3.5} aria-label="done" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-bold ${s.done ? "text-coal/50 line-through" : ""}`}>{s.title}</span>
                <span className="block text-sm text-coal/60">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Overview() {
  const { account } = useAccount();
  const router = useRouter();
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
  const live = !account.simulationEnabled;
  const spent = account.agents.reduce((s, a) => s + a.sessionSpendMicro, 0);
  const first = account.user.name.split(" ")[0];
  const crew = account.agents.slice(0, 3);
  return (
    <div className="space-y-9">
      <PageHead
        title={<>Hi, <span className="sy-mark">{first}.</span></>}
        lead={account.agents.length === 0 ? "Hatch an agent and let it shop for APIs." : live ? (account.user.payWallet ? `${account.agents.length} agent${account.agents.length === 1 ? "" : "s"}, paying from your wallet.` : "Link a wallet so your agents can pay.") : `${account.agents.length} agent${account.agents.length === 1 ? "" : "s"} on simulated money.`}
        action={
          <Link href="/dashboard/agents?new=1" className={hardButtonClass("primary")}>
            <Plus className="size-4" strokeWidth={3} aria-hidden /> New agent
          </Link>
        }
      />

      {crew.length > 0 && (
        <section aria-labelledby="crew-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="crew-title" className="text-xl font-bold tracking-[-0.02em]">Your crew</h2>
            <Link href="/dashboard/agents" className="flex items-center gap-1 text-sm font-bold underline decoration-coal/30 underline-offset-4 hover:decoration-coal">
              All agents <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {crew.map((a) => (
              <AgentCard key={a.id} agent={a} compact onOpen={() => router.push(`/dashboard/agents?open=${a.id}`)} />
            ))}
          </div>
        </section>
      )}

      {(account.agents.length > 0 || account.seller) && (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {live ? (
          <>
            <Stat label="Your agents" value={account.agents.length} hint={account.user.payWallet ? "Paying from your wallet" : "No wallet linked yet"} />
            <Stat label="Spent by agents" value={formatUsd(spent)} hint="This session, from your wallet" />
          </>
        ) : (
          <>
            <Stat label="On your account" value={formatUsd(account.user.balanceMicro)} hint="Not given to an agent yet" />
            <Stat label="In your agents" value={formatUsd(inAgents)} hint={`${account.agents.length} agent${account.agents.length === 1 ? "" : "s"}`} />
          </>
        )}
        <Stat label="Your APIs" value={account.seller ? `${account.seller.online}/${account.seller.apis}` : "0"} hint="Online / published" />
        <Stat label="Earned & paid out" value={formatUsd(account.seller ? account.seller.paidOutMicro + account.seller.balanceMicro : 0)} hint={account.mode === "live" ? "Paid to your wallet on each call" : "Simulated"} />
      </div>
      )}

      <Checklist />

      <Section title="Recent purchases" icon={Receipt} bodyClassName="p-0">
        {rows === null ? (
          <p className="p-5 text-sm text-coal/60">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-coal/60">Nothing yet. When one of your agents buys from an API, it shows up here.</p>
        ) : (
          <ul className="divide-y-2 divide-coal/10">
            {rows.map((t) => {
              const look = lookOf(t.capability);
              return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center border-2 border-coal" style={{ background: look.color }}>
                  <look.icon className="size-4" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{t.providerName}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {new Date(t.createdAt).toLocaleString("en-GB", { hour12: false, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t.capability}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3 font-mono text-xs">
                  <span className="tnum font-bold">{t.status === "settled" ? formatUsd(t.amountMicro) : <span className="font-normal text-muted">not charged</span>}</span>
                  {t.explorerUrl && (
                    <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="underline hover:text-signal">
                      explorer
                    </a>
                  )}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
