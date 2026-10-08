"use client";

import { useState } from "react";
import { HardButton, Label, Panel } from "@/components/primitives";
import { CopyBlock } from "@/components/site/CopyBlock";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { formatUsd } from "@/lib/money";
import { Field, inputCls, Notice, shortAddress, Stat } from "./ui";

/** The bit of Phantom's injected provider we use: connect, and sign a message. */
interface PhantomProvider {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
}
function phantom(): PhantomProvider | null {
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider & { isPhantom?: boolean } };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
}
const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

type Msg = { tone: "ok" | "error"; text: string } | null;

export function Wallet() {
  const { account, refresh } = useAccount();
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [depositMsg, setDepositMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<"save" | "verify" | "deposit" | "credit" | null>(null);
  if (!account) return null;
  const { user, mode, treasury } = account;

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

  /** Connect Phantom, have it sign the challenge, and let the server check the signature. */
  const verify = async () => {
    setMsg(null);
    const provider = phantom();
    if (!provider) return setMsg({ tone: "error", text: "No Phantom wallet found in this browser. Install Phantom (phantom.app) and reload." });
    setBusy("verify");
    try {
      const { publicKey } = await provider.connect();
      const addr = publicKey.toString();
      const challenge = await api<{ issuedAt: string; message: string }>("/api/account/wallet/challenge", { json: { address: addr } });
      if (!challenge.ok || !challenge.data) throw new Error(challenge.error ?? "Could not start.");
      const { signature } = await provider.signMessage(new TextEncoder().encode(challenge.data.message), "utf8");
      const done = await api("/api/account/wallet/verify", { json: { address: addr, issuedAt: challenge.data.issuedAt, signature: toBase64(signature) } });
      if (!done.ok) throw new Error(done.error ?? "Could not verify.");
      setMsg({ tone: "ok", text: `Verified ${shortAddress(addr)}. Deposits from it are credited to this account.` });
      await refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Cancelled." });
    }
    setBusy(null);
  };

  const checkDeposit = async () => {
    setBusy("deposit");
    setDepositMsg(null);
    const r = await api<{ credited: { amountMicro: number }[] }>("/api/account/deposits", { json: {} });
    setBusy(null);
    if (!r.ok || !r.data) return setDepositMsg({ tone: "error", text: r.error ?? "Could not check." });
    const total = r.data.credited.reduce((s, c) => s + c.amountMicro, 0);
    setDepositMsg(total > 0 ? { tone: "ok", text: `Credited ${formatUsd(total)}.` } : { tone: "ok", text: "Nothing new yet. A transfer can take a few seconds to confirm; try again." });
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
        <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">Your money, your wallet.</h1>
        <p className="mt-4 max-w-2xl text-lg font-medium">Deposit USDC from your Solana wallet to fund your agents, and get paid at it when your APIs are used.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="On your account" value={formatUsd(user.balanceMicro)} hint="Move it to an agent in Agents" />
        <Stat label="Rail" value={mode === "live" ? "Devnet" : "Simulated"} hint={mode === "live" ? "Real transactions, test USDC" : "Play money, no blockchain"} />
        <Stat label="Deposited so far" value={formatUsd(account.deposits.reduce((s, d) => s + d.amountMicro, 0))} />
      </div>

      <Panel title="Your Solana wallet" status={user.wallet && <span className={`font-mono text-[10px] font-bold ${user.wallet.verified ? "text-signal" : "text-pay"}`}>{user.wallet.verified ? "VERIFIED" : "NOT VERIFIED"}</span>} bodyClassName="space-y-4">
        {user.wallet ? (
          <div className="space-y-3">
            <CopyBlock value={user.wallet.address} />
            <p className="font-mono text-[11px] text-muted">
              {user.wallet.verified ? "You proved you hold this wallet. Payouts go here, and deposits from it are credited to you." : "Payouts go here. To deposit from it, prove it is yours: Phantom signs a message that costs nothing and moves nothing."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">No wallet yet. Connect Phantom (recommended: it also lets you deposit), or paste an address to be paid at.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <HardButton onClick={verify} disabled={busy !== null}>
            {busy === "verify" ? "Waiting for Phantom…" : user.wallet?.verified ? "Use another wallet (Phantom)" : "Connect Phantom & verify"}
          </HardButton>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <Field label={user.wallet ? "Or change the address you are paid at" : "Or just paste an address to be paid at"} hint="Devnet is fine. We never ask for a private key." className="min-w-72 flex-1">
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" spellCheck={false} />
          </Field>
          <HardButton variant="ghost" onClick={save} disabled={busy !== null || address.trim().length < 32}>
            Save address
          </HardButton>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Panel>

      <Panel title="Add money" bodyClassName="space-y-4">
        {mode === "live" && treasury ? (
          <>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Verify your wallet above (once).</li>
              <li>
                From that wallet, send <b>USDC on Solana devnet</b> to Rialto&apos;s address:
                <CopyBlock className="mt-2" value={treasury.address} />
                <a href={treasury.explorer} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] underline hover:text-signal">
                  see it on the explorer ↗
                </a>
              </li>
              <li>Press the button. We find the transfer on-chain and credit your account.</li>
            </ol>
            <p className="font-mono text-[11px] text-muted">
              No devnet USDC? Get some free at{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="underline hover:text-signal">
                faucet.circle.com
              </a>{" "}
              (choose Solana Devnet and paste your wallet address).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <HardButton onClick={checkDeposit} disabled={busy !== null || !user.wallet?.verified}>
                {busy === "deposit" ? "Looking on-chain…" : "I sent it, check now"}
              </HardButton>
              {!user.wallet?.verified && <span className="font-mono text-[11px] text-pay">Verify your wallet first.</span>}
              {depositMsg && <Notice tone={depositMsg.tone}>{depositMsg.text}</Notice>}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="max-w-xl text-sm text-muted">This server runs on simulated money, so there is nothing to deposit on-chain. Take some play money to try things out.</p>
            <HardButton onClick={testCredit} disabled={busy !== null}>
              + $1 test credit
            </HardButton>
          </div>
        )}
      </Panel>

      {account.deposits.length > 0 && (
        <Panel title="Deposits" bodyClassName="p-0">
          <ul className="divide-y divide-line font-mono text-xs">
            {account.deposits.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="text-muted">{new Date(d.at).toLocaleString("en-GB", { hour12: false })} · from {shortAddress(d.from)}</span>
                <span className="flex items-center gap-3">
                  <span className="tnum text-signal">+{formatUsd(d.amountMicro)}</span>
                  <a href={`https://explorer.solana.com/tx/${d.signature}?cluster=devnet`} target="_blank" rel="noreferrer" className="underline hover:text-signal">
                    explorer ↗
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Money movements" bodyClassName="p-0">
        {account.ledger.length === 0 ? (
          <p className="p-4 font-mono text-xs text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line font-mono text-xs">
            {account.ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-muted">
                  {new Date(l.at).toLocaleString("en-GB", { hour12: false })} · {l.kind.replace("_", " ")}
                  {l.note && l.kind !== "deposit" ? ` · ${l.note}` : ""}
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
