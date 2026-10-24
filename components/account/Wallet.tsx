"use client";

import { useState } from "react";
import { HardButton, Label, Panel } from "@/components/primitives";
import { CopyBlock } from "@/components/site/CopyBlock";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import { Field, inputCls, Notice, Stat } from "./ui";
import { PayWallet } from "./PayWallet";

type Msg = { tone: "ok" | "error"; text: string } | null;

export function Wallet() {
  const { account, refresh } = useAccount();
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<"save" | "credit" | null>(null);
  if (!account) return null;
  const { user, mode, network, testMoney } = account;
  const live = mode === "live";
  const netName = network === "solana-mainnet" ? "Mainnet" : "Devnet";

  const save = async () => {
    setBusy("save");
    setMsg(null);
    const r = await api("/api/account/wallet", { method: "PUT", json: { address } });
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "error", text: r.error ?? "Could not save." });
    setAddress("");
    setMsg({ tone: "ok", text: "Saved. You will be paid at this address." });
    await refresh();
  };

  const testCredit = async () => {
    setBusy("credit");
    await api("/api/account/test-credit", { json: { amountUsd: 1 } });
    setBusy(null);
    await refresh();
  };

  return (
    <div className="space-y-8">
      <header>
        <Label tone="signal">Wallet</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">Your money stays yours.</h1>
        <p className="mt-4 max-w-2xl text-lg font-medium">Rialto never holds your money. Agents pay from their own wallet, straight to the seller; sellers are paid straight into theirs.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Payments" value={live ? netName : "Simulated"} hint={live ? (testMoney ? "Real transactions, test USDC" : "Real USDC, settled on-chain") : "Play money, no blockchain"} />
        <Stat label="Held by Rialto" value="$0.000" hint={live ? "Nothing: payments go wallet to wallet" : "Only play money on this server"} />
        <Stat label="Test credit" value={formatUsd(user.balanceMicro)} hint="Play money for the simulated providers" />
      </div>

      <PayWallet />

      <Panel title="Where you get paid" bodyClassName="space-y-4">
        {user.wallet ? (
          <div className="space-y-3">
            <CopyBlock value={user.wallet.address} />
            <p className="font-mono text-[11px] text-muted">
              Every time an agent uses one of your APIs, its price arrives here in USDC, in the same call. There is nothing to withdraw.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">No wallet yet. Paste the Solana address you want to be paid at to publish an API.</p>
        )}
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <Field label={user.wallet ? "Change the address you are paid at" : "Solana address"} hint="A public address only. We never ask for a private key." className="min-w-72 flex-1">
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" spellCheck={false} />
          </Field>
          <HardButton variant="ghost" onClick={save} disabled={busy !== null || address.trim().length < 32}>
            Save address
          </HardButton>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Panel>

      <Panel title="Where your agent pays from" bodyClassName="space-y-4">
        {live ? (
          <>
            <p className="text-sm">
              The easy way is <b>Pay from your wallet</b> above: your agents pay from the wallet you already use, within the limit you approved. Developers can instead keep a wallet key on their own machine with the local signer (the command is in <b>Agents</b>).
            </p>
            <p className="font-mono text-[11px] text-muted">
              Either way, each call is two transfers from that wallet: the seller&apos;s price to the seller, and Rialto&apos;s small fee to Rialto. The facilitator pays the network fees, so the wallet needs USDC and no SOL.
              {testMoney ? " Free test USDC: faucet.circle.com (choose Solana Devnet)." : ""}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="max-w-xl text-sm text-muted">This server runs on simulated money, so nothing moves on-chain. Take some play money to try things out.</p>
            <HardButton onClick={testCredit} disabled={busy !== null}>
              + $1 test credit
            </HardButton>
          </div>
        )}
      </Panel>

      <Panel title="Money movements" bodyClassName="p-0">
        {account.ledger.length === 0 ? (
          <p className="p-4 font-mono text-xs text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line font-mono text-xs">
            {account.ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-muted">
                  {new Date(l.at).toLocaleString("en-GB", { hour12: false })} · {l.kind.replace("_", " ")}
                  {l.note ? ` · ${l.note}` : ""}
                </span>
                <span className={`tnum shrink-0 ${l.amountMicro < 0 ? "text-pay" : "text-signal"}`}>
                  {l.amountMicro < 0 ? "−" : "+"}
                  {formatUsd(Math.abs(l.amountMicro))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
