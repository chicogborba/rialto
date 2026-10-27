"use client";

import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Copy, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { HardButton } from "@/components/primitives";
import { api } from "@/lib/client/api";
import { useAccount } from "@/lib/client/account";
import { connect, openInPhantom, signPrepared, watchWallets, type StdWallet } from "@/lib/client/wallet-standard";
import { formatUsd } from "@/lib/money";
import { asset } from "@/lib/site";
import type { PayWalletView } from "@/lib/wallet/allowance";
import { cn } from "@/lib/utils";
import { inputCls, Notice, PageHead, shortAddress } from "./ui";

type Msg = { tone: "ok" | "error"; text: string } | null;
const PRESETS = [5, 20, 50];
/** The wallets people use on Solana. Installed ones bring their own logo; the rest get a monogram and a link. */
const KNOWN = [
  { name: "Phantom", color: "#ab9ff2", href: "https://phantom.com/download" },
  { name: "Solflare", color: "#fc7227", href: "https://solflare.com/download" },
  { name: "Backpack", color: "#e33e3f", href: "https://backpack.app/download" },
];
const LAST_WALLET = "rialto.payWalletName";
const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

function remembered(): string | null {
  try {
    return localStorage.getItem(LAST_WALLET);
  } catch {
    return null;
  }
}

/** A wallet's logo: its own icon when the extension is installed, a coloured monogram otherwise. */
function WalletLogo({ name, icon, className }: { name: string; icon?: string; className?: string }) {
  const known = KNOWN.find((k) => k.name === name);
  if (icon)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" className={cn("size-10 shrink-0 rounded-[10px]", className)} />;
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-[10px] text-lg font-bold text-white", className)} style={{ background: known?.color ?? "#17120f" }}>
      {name.slice(0, 1)}
    </span>
  );
}

function useWallets() {
  const [wallets, setWallets] = useState<StdWallet[]>([]);
  useEffect(() => watchWallets(setWallets), []);
  return wallets;
}

function CopyAddress({ address, light = false }: { address: string; light?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(address);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn("inline-flex items-center gap-1.5 font-mono text-sm", light ? "text-cream/80 hover:text-cream" : "text-coal/70 hover:text-coal")}
      title={address}
    >
      {shortAddress(address)}
      {done ? <Check className="size-3.5" aria-label="Copied" /> : <Copy className="size-3.5" aria-label="Copy address" />}
    </button>
  );
}

/** "Your agents pay from": pick a limit, pick your wallet, approve once. Then a card with what is left. */
function PayFrom() {
  const wallets = useWallets();
  const [view, setView] = useState<PayWalletView | null>(null);
  const [limit, setLimit] = useState("20");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<PayWalletView>("/api/account/pay-wallet");
    if (r.ok && r.data) setView(r.data);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setLastName(remembered());
      void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  if (!view) return <div className="h-64 animate-pulse border-2 border-coal/15 bg-surface" aria-busy="true" />;
  if (!view.available) return null;

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
      setEditing(false);
      try {
        localStorage.setItem(LAST_WALLET, wallet.name);
      } catch {
        // private mode: the card falls back to a monogram
      }
      setLastName(wallet.name);
      setMsg({ tone: "ok", text: kind === "approve" ? `Done. Your agents can spend up to ${formatUsd(Math.round(limitUsd * 1_000_000))}.` : "Revoked. Rialto can no longer spend from that wallet." });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Something went wrong.";
      setMsg({ tone: "error", text: /reject|cancel|denied|declined/i.test(text) ? "Cancelled in the wallet." : text });
    } finally {
      setBusy(null);
    }
  };

  const a = view.allowance;
  const active = Boolean(view.wallet && a?.forRialto);
  const usdc = view.testMoney ? "test USDC" : "USDC";
  const lastWallet = wallets.find((w) => w.name === lastName);

  const chooser = (
    <div className="space-y-5">
      <div>
        <p className="font-bold">How much may your agents spend?</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setLimit(String(p))} className={cn("min-h-11 min-w-16 border-2 px-4 font-mono text-[15px] font-bold", limit === String(p) ? "border-coal bg-lime shadow-[3px_3px_0_var(--color-coal)]" : "border-coal/20 bg-surface hover:border-coal")}>
              ${p}
            </button>
          ))}
          <label className="flex items-center gap-2 border-2 border-coal/20 bg-surface pl-3 focus-within:border-coal">
            <span className="font-mono text-[15px] font-bold text-coal/50">$</span>
            <span className="sr-only">Custom limit in dollars</span>
            <input value={PRESETS.includes(Number(limit)) ? "" : limit} placeholder="Other" onChange={(e) => setLimit(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" className="min-h-10 w-20 border-0! bg-transparent! font-mono text-[15px] font-bold outline-none" />
          </label>
        </div>
      </div>
      <div>
        <p className="font-bold">Approve it in your wallet</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {wallets.map((w) => (
            <button key={w.name} type="button" disabled={busy !== null} onClick={() => void run(w, "approve")} className="sy-card flex items-center gap-3 border-2 border-coal bg-surface p-3 text-left shadow-[3px_3px_0_var(--color-coal)] disabled:opacity-60">
              <WalletLogo name={w.name} icon={w.icon} />
              <span className="min-w-0">
                <span className="block truncate font-bold">{w.name}</span>
                <span className="block text-xs text-coal/60">{busy === w.name ? "Check your wallet…" : busy === "sending" ? "Confirming…" : `Approve $${limit || "0"}`}</span>
              </span>
            </button>
          ))}
          {KNOWN.filter((k) => !wallets.some((w) => w.name === k.name)).map((k) =>
            isPhone() && k.name === "Phantom" ? (
              <a key={k.name} href={openInPhantom(window.location.href)} className="flex items-center gap-3 border-2 border-dashed border-coal/30 p-3 hover:border-coal">
                <WalletLogo name={k.name} />
                <span>
                  <span className="block font-bold">{k.name}</span>
                  <span className="block text-xs text-coal/60">Open in the app</span>
                </span>
              </a>
            ) : (
              <a key={k.name} href={k.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 border-2 border-dashed border-coal/30 p-3 opacity-80 hover:border-coal hover:opacity-100">
                <WalletLogo name={k.name} className="opacity-70 grayscale-[0.4]" />
                <span>
                  <span className="block font-bold">{k.name}</span>
                  <span className="block text-xs text-coal/60">Not installed · Get it</span>
                </span>
              </a>
            ),
          )}
        </div>
      </div>
      <p className="flex items-start gap-2 text-sm text-coal/65">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          The money stays in your wallet until an agent buys something, and never more than this limit. Needs {usdc} on Solana; no SOL, Rialto pays the network fee. Revoke any time.
        </span>
      </p>
    </div>
  );

  return (
    <section aria-labelledby="pay-title" className="border-2 border-coal bg-surface shadow-[5px_5px_0_var(--color-coal)]">
      <header className="flex items-center justify-between gap-3 border-b-2 border-coal px-5 py-3.5">
        <h2 id="pay-title" className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em]">
          <ArrowUpRight className="size-5" strokeWidth={2.5} aria-hidden /> Your agents pay from
        </h2>
        <span className={cn("border-2 border-coal px-2 py-0.5 font-mono text-[11px] font-bold", active ? "bg-lime" : "bg-sand")}>{active ? "ON" : "OFF"}</span>
      </header>
      <div className="space-y-5 p-5">
        {view.wallet && a ? (
          <>
            {/* the wallet as a card: which one, what is left to spend, what it holds */}
            <div className="relative overflow-hidden border-2 border-coal bg-coal p-5 text-cream">
              <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-lime/15" />
              <div className="relative flex items-center gap-3">
                <WalletLogo name={lastName ?? "Wallet"} icon={lastWallet?.icon} />
                <div className="min-w-0">
                  <p className="font-bold">{lastName ?? "Your wallet"}</p>
                  <CopyAddress address={view.wallet} light />
                </div>
              </div>
              <div className="relative mt-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-cream/60">Agents can still spend</p>
                  <p className="tnum text-4xl font-bold tracking-[-0.03em]">{formatUsd(active ? a.delegatedMicro : 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cream/60">{usdc} in the wallet</p>
                  <p className="tnum font-mono text-lg font-bold">{a.balanceMicro === null ? "none" : formatUsd(a.balanceMicro)}</p>
                </div>
              </div>
            </div>
            {!active && <Notice tone="error">This wallet no longer lets Rialto spend: it was revoked, used up, or given to another app. Approve a new limit to turn it back on.</Notice>}
            {active && !editing ? (
              <div className="flex flex-wrap gap-3">
                <HardButton onClick={() => setEditing(true)}>Change the limit</HardButton>
                {lastWallet ? (
                  <HardButton variant="ghost" disabled={busy !== null} onClick={() => void run(lastWallet, "revoke")}>
                    {busy ? "Check your wallet…" : "Revoke"}
                  </HardButton>
                ) : (
                  wallets.map((w) => (
                    <HardButton key={w.name} variant="ghost" disabled={busy !== null} onClick={() => void run(w, "revoke")}>
                      Revoke with {w.name}
                    </HardButton>
                  ))
                )}
              </div>
            ) : (
              chooser
            )}
            {!active && (
              <button type="button" onClick={() => void api("/api/account/pay-wallet", { method: "DELETE" }).then(load)} className="text-sm font-bold text-coal/60 underline underline-offset-4 hover:text-coal">
                Forget this wallet
              </button>
            )}
          </>
        ) : (
          chooser
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </section>
  );
}

/** "You get paid at": one address. Offers the wallet you already linked, so it is one click. */
function PaidAt() {
  const { account, refresh } = useAccount();
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  const current = account.user.wallet?.address ?? null;
  const suggestion = account.user.payWallet && account.user.payWallet !== current ? account.user.payWallet : null;

  const save = async (value: string) => {
    setBusy(true);
    setMsg(null);
    const r = await api("/api/account/wallet", { method: "PUT", json: { address: value.trim() } });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.error ?? "Could not save." });
    setAddress("");
    setEditing(false);
    setMsg({ tone: "ok", text: "Saved. Sales of your APIs are paid here." });
    await refresh();
  };

  return (
    <section aria-labelledby="paid-title" className="border-2 border-coal bg-surface shadow-[5px_5px_0_var(--color-coal)]">
      <header className="flex items-center justify-between gap-3 border-b-2 border-coal px-5 py-3.5">
        <h2 id="paid-title" className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em]">
          <ArrowDownLeft className="size-5" strokeWidth={2.5} aria-hidden /> You get paid at
        </h2>
        <span className="text-sm text-coal/60">For your APIs</span>
      </header>
      <div className="space-y-4 p-5">
        {current && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CopyAddress address={current} />
              <p className="mt-1 text-sm text-coal/60">Each sale arrives here in USDC, in the same second. Nothing to withdraw.</p>
            </div>
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-bold underline underline-offset-4">
              Change
            </button>
          </div>
        ) : (
          <>
            {suggestion && (
              <button type="button" disabled={busy} onClick={() => void save(suggestion)} className="sy-card flex w-full items-center justify-between gap-3 border-2 border-coal bg-lime p-3 text-left shadow-[3px_3px_0_var(--color-coal)]">
                <span>
                  <span className="block font-bold">Use the wallet your agents pay from</span>
                  <span className="font-mono text-sm">{shortAddress(suggestion)}</span>
                </span>
                <Check className="size-5" strokeWidth={3} aria-hidden />
              </button>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-64 flex-1">
                <span className="text-sm font-bold">{suggestion ? "Or paste another Solana address" : "Paste a Solana address"}</span>
                <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" spellCheck={false} />
              </label>
              <HardButton onClick={() => void save(address)} disabled={busy || address.trim().length < 32}>
                Save
              </HardButton>
              {editing && (
                <HardButton variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </HardButton>
              )}
            </div>
            <p className="text-sm text-coal/60">A public address only. Rialto never asks for a seed phrase or private key.</p>
          </>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </section>
  );
}

/** The simulated rail: play money to try things with. */
function TestMoney() {
  const { account, refresh } = useAccount();
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-2 border-coal bg-surface p-5 shadow-[5px_5px_0_var(--color-coal)]">
      <div>
        <p className="text-sm text-coal/60">Test money on this server</p>
        <p className="tnum text-4xl font-bold tracking-[-0.03em]">{formatUsd(account.user.balanceMicro)}</p>
        <p className="mt-1 text-sm text-coal/60">Payments here are simulated: nothing moves on-chain.</p>
      </div>
      <HardButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await api("/api/account/test-credit", { json: { amountUsd: 1 } });
          setBusy(false);
          await refresh();
        }}
      >
        Add $1
      </HardButton>
    </section>
  );
}

export function Wallet() {
  const { account } = useAccount();
  const wallets = useWallets();
  if (!account) return null;
  const live = account.mode === "live";
  const shown = [...wallets.map((w) => ({ name: w.name, icon: w.icon as string | undefined })), ...KNOWN.filter((k) => !wallets.some((w) => w.name === k.name)).map((k) => ({ name: k.name, icon: undefined }))].slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHead title={<>Your wallet, <span className="sy-mark">your money.</span></>} lead="Agents pay sellers straight from the wallet you already use. Rialto never holds a cent." />

      {/* Rialto together with the wallets it works with */}
      <div className="flex flex-wrap items-center gap-4 border-2 border-coal/15 bg-surface/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Image src={asset("/brand/rialto-mark.svg")} alt="Rialto" width={40} height={40} unoptimized className="size-10 border-2 border-coal bg-lime p-1" />
          <span aria-hidden className="font-mono text-lg font-bold text-coal/40">+</span>
          <div className="flex -space-x-2">
            {shown.map((w) => (
              <WalletLogo key={w.name} name={w.name} icon={w.icon} className="ring-2 ring-cream" />
            ))}
          </div>
        </div>
        <p className="text-sm font-medium text-coal/70">
          Works with {shown.map((w) => w.name).join(", ")} and any Solana wallet. {live ? (account.testMoney ? "Devnet, test USDC." : "Solana mainnet, real USDC.") : "Simulated payments."}
        </p>
      </div>

      {live ? <PayFrom /> : <TestMoney />}
      <PaidAt />

      {account.ledger.length > 0 && (
        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 text-lg font-bold tracking-[-0.02em]">
            History
          </h2>
          <ul className="divide-y-2 divide-coal/10 border-2 border-coal bg-surface">
            {account.ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-bold capitalize">{l.kind.replace("_", " ")}</span>
                  <span className="block truncate text-xs text-coal/60">
                    {new Date(l.at).toLocaleString("en-GB", { hour12: false, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {l.note ? ` · ${l.note}` : ""}
                  </span>
                </span>
                <span className={cn("tnum shrink-0 font-mono font-bold", l.amountMicro < 0 ? "text-pay" : "")}>
                  {l.amountMicro < 0 ? "−" : "+"}
                  {formatUsd(Math.abs(l.amountMicro))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {live && (
        <details className="group border-2 border-coal/15 bg-surface/60">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold">
            For developers: pay with a key on your machine
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="px-4 pb-4 text-sm text-coal/70">
            Instead of approving a limit here, an agent can sign each payment itself with a wallet key that stays on your computer. The command is in Agents → an agent → Key → Local signer. The wallet needs USDC and no SOL; each call is two transfers, the seller&apos;s price and Rialto&apos;s fee.
          </p>
        </details>
      )}
    </div>
  );
}
