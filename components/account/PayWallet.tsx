"use client";

import { useCallback, useEffect, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { connect, openInPhantom, signPrepared, watchWallets, type StdWallet } from "@/lib/client/wallet-standard";
import { formatUsd } from "@/lib/money";
import type { PayWalletView } from "@/lib/wallet/allowance";
import { cn } from "@/lib/utils";
import { inputCls, Notice, shortAddress } from "./ui";

const PRESETS = [5, 20, 50];
type Msg = { tone: "ok" | "error"; text: string } | null;

/**
 * "Pay from your wallet": connect Phantom (or any Solana wallet), approve a spending limit once, and
 * every agent on this account pays on-chain sellers from that wallet. The money never leaves it until
 * a purchase is made; revoking takes one more signature.
 */
export function PayWallet() {
  const [view, setView] = useState<PayWalletView | null>(null);
  const [wallets, setWallets] = useState<StdWallet[]>([]);
  const [limit, setLimit] = useState("20");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    const r = await api<PayWalletView>("/api/account/pay-wallet");
    if (r.ok && r.data) setView(r.data);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    const stop = watchWallets((w) => alive && setWallets(w));
    return () => {
      alive = false;
      stop();
    };
  }, [load]);

  if (!view || !view.available) return null;

  /** prepare on the server → sign in the wallet → the server checks and sends it */
  const run = async (wallet: StdWallet, kind: "approve" | "revoke") => {
    setMsg(null);
    setBusy(wallet.name);
    try {
      const account = await connect(wallet);
      if (kind === "revoke" && view.wallet && account.address !== view.wallet) throw new Error(`Switch ${wallet.name} to ${shortAddress(view.wallet)} first: that is the wallet that gave the allowance.`);
      const limitUsd = Number(limit.replace(",", "."));
      if (kind === "approve" && !(limitUsd >= 0.01)) throw new Error("Choose a limit of at least $0.01.");
      const prep = await api<{ transaction: string; chain: string }>("/api/account/pay-wallet", { json: kind === "approve" ? { action: "prepare", wallet: account.address, limitUsd } : { action: "prepare-revoke", wallet: account.address } });
      if (!prep.ok || !prep.data) throw new Error(prep.error ?? "Could not prepare it.");
      const signed = await signPrepared(wallet, account, prep.data.transaction, prep.data.chain);
      setBusy("sending");
      const sent = await api<PayWalletView>("/api/account/pay-wallet", { json: { action: "submit", wallet: account.address, transaction: signed } });
      if (!sent.ok || !sent.data) throw new Error(sent.error ?? "Could not send it.");
      setView(sent.data);
      setChanging(false);
      setMsg({ tone: "ok", text: kind === "approve" ? `Done. Your agents can now spend up to ${formatUsd(Math.round(limitUsd * 1_000_000))} from ${shortAddress(account.address)}.` : "Revoked. Rialto can no longer spend from that wallet." });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Something went wrong.";
      setMsg({ tone: "error", text: /reject|cancel|denied|declined/i.test(text) ? "Cancelled in the wallet." : text });
    } finally {
      setBusy(null);
    }
  };

  const forget = async () => {
    await api("/api/account/pay-wallet", { method: "DELETE" });
    await load();
  };

  const a = view.allowance;
  const linked = Boolean(view.wallet);
  const usdc = view.testMoney ? "test USDC" : "USDC";

  const picker = (kind: "approve" | "revoke") =>
    wallets.length ? (
      <div className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <button key={w.name} type="button" disabled={busy !== null} onClick={() => void run(w, kind)} className={cn("flex min-h-11 items-center gap-2.5 border px-4 font-mono text-[12px] font-bold uppercase tracking-wider disabled:opacity-50", kind === "approve" ? "border-signal bg-signal text-ink hover:bg-paper hover:border-paper" : "border-line-hi text-paper hover:border-fail hover:text-fail")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.icon} alt="" className="size-5" />
            {busy === w.name ? "Waiting for the wallet…" : busy === "sending" ? "Confirming on Solana…" : kind === "approve" ? `Approve with ${w.name}` : `Revoke with ${w.name}`}
          </button>
        ))}
      </div>
    ) : (
      <div className="space-y-2 text-sm">
        <p className="text-muted">No Solana wallet found in this browser.</p>
        <div className="flex flex-wrap gap-3 font-mono text-[11px] font-bold uppercase tracking-wider">
          {/Android|iPhone|iPad/i.test(navigator.userAgent) ? (
            <a href={openInPhantom(window.location.href)} className="border border-signal px-4 py-3 text-signal hover:bg-signal hover:text-ink">Open in Phantom</a>
          ) : (
            <>
              <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="text-signal underline">Get Phantom</a>
              <a href="https://solflare.com/download" target="_blank" rel="noreferrer" className="text-signal underline">Get Solflare</a>
            </>
          )}
        </div>
      </div>
    );

  return (
    <Panel title="Pay from your wallet" status={<span className={cn("font-mono text-[10px]", a?.forRialto ? "text-signal" : "text-muted")}>{a?.forRialto ? "ON" : "OFF"}</span>}>
      <div className="space-y-5 p-1">
        {linked && a ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Wallet</Label>
                <p className="mt-2 font-mono text-lg font-bold">{shortAddress(view.wallet as string)}</p>
              </div>
              <div>
                <Label>Agents may still spend</Label>
                <p className="tnum mt-2 font-mono text-lg font-bold text-signal">{formatUsd(a.forRialto ? a.delegatedMicro : 0)}</p>
              </div>
              <div>
                <Label>{usdc} in the wallet</Label>
                <p className="tnum mt-2 font-mono text-lg font-bold">{a.balanceMicro === null ? "none" : formatUsd(a.balanceMicro)}</p>
              </div>
            </div>
            {!a.forRialto && <Notice tone="error">This wallet no longer lets Rialto spend (it was revoked, used up, or given to another app). Approve again to turn it back on.</Notice>}
            {changing || !a.forRialto ? (
              <LimitPicker limit={limit} setLimit={setLimit}>
                {picker("approve")}
              </LimitPicker>
            ) : (
              <div className="flex flex-wrap gap-4 font-mono text-[11px] font-bold uppercase tracking-wider">
                <button type="button" onClick={() => setChanging(true)} className="text-signal underline">Change the limit</button>
                <span className="text-muted">Revoke:</span>
              </div>
            )}
            {a.forRialto && !changing && picker("revoke")}
            {!a.forRialto && (
              <button type="button" onClick={() => void forget()} className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted underline hover:text-paper">Forget this wallet</button>
            )}
          </>
        ) : (
          <>
            <p className="max-w-2xl text-sm leading-relaxed">
              Let your agents pay from the wallet you already use. Approve a limit once, in your wallet; after that each purchase goes from your wallet straight to the seller, with no pop-up. Rialto never holds the money and can never take more than the limit. You can revoke it any time.
            </p>
            <LimitPicker limit={limit} setLimit={setLimit}>
              {picker("approve")}
            </LimitPicker>
            <p className="font-mono text-[10px] text-muted">
              Needs {usdc} on Solana {view.testMoney ? "devnet" : "mainnet"} in that wallet; no SOL needed, Rialto pays the network fee.{view.spender ? ` Spender: ${shortAddress(view.spender)}.` : ""}
            </p>
          </>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </Panel>
  );
}

function LimitPicker({ limit, setLimit, children }: { limit: string; setLimit: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Spending limit for all your agents</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setLimit(String(p))} className={cn("min-h-10 border px-4 font-mono text-sm font-bold", limit === String(p) ? "border-signal text-signal" : "border-line text-muted hover:text-paper")}>
              ${p}
            </button>
          ))}
          <label className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted">$</span>
            <span className="sr-only">Custom limit in dollars</span>
            <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" className={cn(inputCls, "mt-0 w-28")} />
          </label>
        </div>
      </div>
      {children}
    </div>
  );
}
