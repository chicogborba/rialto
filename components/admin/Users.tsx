"use client";

import { BadgeCheck, Copy, Download, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { inputCls, shortAddress } from "@/components/account/ui";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { Modal } from "@/components/shell/Modal";
import { appetite } from "@/lib/agent/appetite";
import type { UserDetail, UserRow } from "@/lib/admin/stats";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Segmented, usd } from "./Overview";

type Filter = "all" | "buyers" | "sellers" | "admins" | "unverified";
type Msg = { tone: "ok" | "error"; text: string } | null;

const ago = (iso: string | null): string => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const WEEK = 7 * 86_400_000;

/** Everyone with an account: who they are, what they did, and who runs this panel. */
export function AdminUsers() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);

  const load = useCallback(async () => {
    const r = await api<{ rows: UserRow[] }>("/api/admin/users");
    if (r.ok && r.data) {
      setRows(r.data.rows);
      setLoadedAt(Date.now());
    } else setMessage({ tone: "error", text: r.error ?? "Could not load users." });
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const counts = useMemo(() => {
    const now = loadedAt;
    const r = rows ?? [];
    return {
      total: r.length,
      verified: r.filter((u) => u.verified).length,
      newWeek: r.filter((u) => now - new Date(u.createdAt).getTime() < WEEK).length,
      activeWeek: r.filter((u) => u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < WEEK).length,
      buyers: r.filter((u) => u.purchases > 0).length,
      sellers: r.filter((u) => u.sellsApis > 0).length,
      wallets: r.filter((u) => u.payWallet).length,
      admins: r.filter((u) => u.admin).length,
    };
  }, [rows, loadedAt]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q)) return false;
      if (filter === "buyers") return u.purchases > 0;
      if (filter === "sellers") return u.sellsApis > 0;
      if (filter === "admins") return u.admin;
      if (filter === "unverified") return !u.verified;
      return true;
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Users</h1>
          <p className="mt-2 text-coal/70">Everyone with an account. Click one to see their agents and purchases, or to make them an admin.</p>
        </div>
        <a href="/api/admin/users?format=csv" download className="flex min-h-10 items-center gap-1.5 border-2 border-coal bg-surface px-3 text-sm font-bold shadow-[3px_3px_0_var(--color-coal)] hover:bg-lime">
          <Download className="size-4" aria-hidden /> Export emails (CSV)
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Accounts" value={counts.total} hint={`${counts.verified} verified email`} />
        <Count label="New this week" value={counts.newWeek} hint={`${counts.activeWeek} active this week`} />
        <Count label="Have bought" value={counts.buyers} hint={`${counts.wallets} pay from a wallet`} />
        <Count label="Sell APIs" value={counts.sellers} hint={`${counts.admins} admin${counts.admins === 1 ? "" : "s"}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Show" value={filter} onChange={setFilter} options={[{ id: "all", label: "All" }, { id: "buyers", label: "Buyers" }, { id: "sellers", label: "Sellers" }, { id: "admins", label: "Admins" }, { id: "unverified", label: "Unverified" }]} />
        <label className="w-full max-w-xs">
          <span className="sr-only">Search by email or name</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email or name" className={cn(inputCls, "mt-0")} />
        </label>
      </div>
      {message && <p role={message.tone === "error" ? "alert" : "status"} className={cn("border-l-4 py-1 pl-3 text-sm font-medium", message.tone === "ok" ? "border-lime" : "border-fail text-fail")}>{message.text}</p>}

      <section className="overflow-x-auto border-2 border-coal bg-surface shadow-[5px_5px_0_var(--color-coal)]">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b-2 border-coal text-left text-xs text-coal/60">
              {["Account", "Joined", "Last seen", "Agents", "Purchases", "Spent", "Wallet", "Role"].map((h, i) => (
                <th key={h} className={cn("px-4 py-2.5 font-medium", i >= 3 && i <= 5 && "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-coal/5">
            {shown.map((u) => (
              <tr key={u.id} onClick={() => setOpenId(u.id)} className="cursor-pointer hover:bg-lime/20">
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => setOpenId(u.id)} className="text-left">
                    <span className="flex items-center gap-1.5 font-bold">
                      {u.email}
                      {u.verified && <BadgeCheck className="size-4 shrink-0 text-[#3c6a00]" aria-label="Email verified" />}
                    </span>
                    <span className="block text-xs text-coal/55">
                      {u.name}
                      {u.sellsApis ? ` · sells ${u.sellsApis} API${u.sellsApis > 1 ? "s" : ""}` : ""}
                    </span>
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-coal/60">{day(u.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{ago(u.lastSeenAt)}</td>
                <td className="tnum px-4 py-2.5 text-right font-mono">{u.agents}</td>
                <td className="tnum px-4 py-2.5 text-right font-mono">{u.purchases}</td>
                <td className="tnum px-4 py-2.5 text-right font-mono font-bold">{usd(u.spentMicro)}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-coal/60">{u.payWallet ? shortAddress(u.payWallet) : "none"}</td>
                <td className="px-4 py-2.5">{u.admin ? <span className="border-2 border-coal bg-lime px-1.5 py-0.5 text-xs font-bold">Admin</span> : <span className="text-xs text-coal/50">User</span>}</td>
              </tr>
            ))}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-coal/60">Nobody matches.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <UserSheet
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={(text) => {
          setMessage({ tone: "ok", text });
          void load();
        }}
      />
    </div>
  );
}

function Count({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="border-2 border-coal bg-surface p-4 shadow-[4px_4px_0_var(--color-coal)]">
      <p className="text-sm font-medium text-coal/60">{label}</p>
      <p className="tnum mt-1 text-3xl font-bold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 truncate text-xs text-coal/55">{hint}</p>
    </div>
  );
}

/** One account, opened. */
function UserSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: (text: string) => void }) {
  const [detail, setDetail] = useState<{ id: string; data: UserDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (userId: string) => {
    const r = await api<UserDetail>(`/api/admin/users/${userId}`);
    if (r.ok && r.data) setDetail({ id: userId, data: r.data });
    else setError(r.error ?? "Could not load this account.");
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setConfirming(false);
      setError(null);
      void load(id);
    });
    return () => {
      alive = false;
    };
  }, [id, load]);

  const d = detail && detail.id === id ? detail.data : null;
  const u = d?.user;

  const setRole = async (role: "user" | "admin") => {
    if (!u) return;
    setBusy(true);
    const r = await api("/api/admin/users", { json: { id: u.id, role } });
    setBusy(false);
    setConfirming(false);
    if (!r.ok) return setError(r.error ?? "Could not change the role.");
    onChanged(role === "admin" ? `${u.email} is now an admin.` : `${u.email} is no longer an admin.`);
    void load(u.id);
  };

  return (
    <Modal open={id !== null} onOpenChange={(o) => !o && onClose()} kicker={u ? (u.admin ? "Admin" : "User") : "Account"} title={u?.email ?? "Loading…"} wide>
      {error && <p role="alert" className="mb-4 border-l-4 border-fail py-1 pl-3 text-sm font-medium text-fail">{error}</p>}
      {!d || !u ? (
        <div className="h-48 animate-pulse bg-sand/50" aria-busy="true" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(u.email);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
              className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-surface px-3 text-sm font-bold hover:bg-lime"
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy email"}
            </button>
            <a href={`mailto:${u.email}`} className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-surface px-3 text-sm font-bold hover:bg-lime">
              <Mail className="size-4" aria-hidden /> Write
            </a>
            {confirming ? (
              <>
                <button type="button" disabled={busy} onClick={() => void setRole(u.admin ? "user" : "admin")} className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-pay px-3 text-sm font-bold text-coal">
                  {u.admin ? `Yes, remove ${u.name.split(" ")[0] || "their"} admin access` : `Yes, give full access to keys, wallets and prices`}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-9 px-2 text-sm font-bold underline">
                  Cancel
                </button>
              </>
            ) : u.admin ? (
              <button type="button" onClick={() => setConfirming(true)} className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-surface px-3 text-sm font-bold hover:bg-[#ffb59a]">
                <ShieldOff className="size-4" aria-hidden /> Remove admin
              </button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="flex min-h-9 items-center gap-1.5 border-2 border-coal bg-lime px-3 text-sm font-bold shadow-[3px_3px_0_var(--color-coal)]">
                <ShieldCheck className="size-4" aria-hidden /> Make admin
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Name" value={u.name} />
            <Fact label="Email" value={u.verified ? "Verified" : "Not verified"} />
            <Fact label="Joined" value={day(u.createdAt)} />
            <Fact label="Last seen" value={ago(u.lastSeenAt)} />
            <Fact label="Purchases" value={String(u.purchases)} />
            <Fact label="Spent" value={usd(u.spentMicro)} />
            <Fact label="Pays from" value={u.payWallet ? shortAddress(u.payWallet) : "no wallet"} mono />
            <Fact label="Paid at" value={u.wallet ? shortAddress(u.wallet) : "no wallet"} mono />
            <Fact label="Signed-in devices" value={String(u.sessions)} />
            <Fact label="Accepted terms" value={u.termsAcceptedAt ? day(u.termsAcceptedAt) : "before terms"} />
            <Fact label="APIs sold" value={String(u.sellsApis)} />
            <Fact label="Test credit" value={usd(u.balanceMicro)} />
          </dl>

          <section>
            <h3 className="text-lg font-bold tracking-[-0.02em]">Agents ({d.agents.length})</h3>
            {d.agents.length === 0 ? (
              <p className="mt-2 text-sm text-coal/60">No agents yet.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d.agents.map((a) => (
                  <li key={a.id} className={cn("border-2 border-coal bg-surface", a.revoked && "opacity-50")}>
                    <AgentAvatar parts={a.look} className="mx-auto w-full max-w-32" />
                    <div className="border-t-2 border-coal p-2.5">
                      <p className="truncate font-bold">{a.name}</p>
                      <p className="text-xs text-coal/60">
                        {a.revoked ? "Removed" : appetite(a.appetite).name} · {a.purchases} buys · {usd(a.spentMicro)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.apis.length > 0 && (
            <section>
              <h3 className="text-lg font-bold tracking-[-0.02em]">APIs they sell</h3>
              <ul className="mt-2 divide-y-2 divide-coal/10 border-2 border-coal bg-surface">
                {d.apis.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-coal/60">
                      {p.status} · {p.calls} calls
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-lg font-bold tracking-[-0.02em]">Latest purchases</h3>
            {d.purchases.length === 0 ? (
              <p className="mt-2 text-sm text-coal/60">Nothing bought yet.</p>
            ) : (
              <ul className="mt-2 divide-y-2 divide-coal/10 border-2 border-coal bg-surface">
                {d.purchases.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{p.api}</span>
                      <span className="block text-xs text-coal/55">
                        {new Date(p.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {p.agent ?? "agent"} · {p.status === "settled" ? (p.mode === "live" ? "on-chain" : "simulated") : p.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block font-mono font-bold">{usd(p.amountMicro)}</span>
                      <span className="tnum block font-mono text-xs text-coal/55">fee {usd(p.feeMicro)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-2 border-coal/15 bg-surface px-3 py-2">
      <dt className="text-xs font-medium text-coal/55">{label}</dt>
      <dd className={cn("mt-0.5 truncate font-bold", mono && "font-mono text-sm")} title={value}>
        {value}
      </dd>
    </div>
  );
}
