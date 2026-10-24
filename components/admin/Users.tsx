"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import { inputCls, shortAddress } from "@/components/account/ui";
import type { UserRow } from "@/lib/admin/stats";
import { api } from "@/lib/client/api";
import { usd } from "./Overview";

const ago = (iso: string | null): string => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
};

/** Everyone with an account: when they came, when they were last seen, what they bought. Admins can promote others. */
export function AdminUsers() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [active7, setActive7] = useState(0);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ rows: UserRow[] }>("/api/admin/users");
    if (r.ok && r.data) {
      const now = Date.now();
      setRows(r.data.rows);
      setActive7(r.data.rows.filter((u) => u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < 7 * 86_400_000).length);
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((u) => !q || u.email.includes(q) || u.name.toLowerCase().includes(q));
  }, [rows, query]);

  const setRole = async (u: UserRow, role: "user" | "admin") => {
    if (!window.confirm(role === "admin" ? `Give ${u.email} full access to this panel (keys, wallets, prices)?` : `Remove ${u.email}'s admin access?`)) return;
    const r = await api("/api/admin/users", { json: { id: u.id, role } });
    setMessage(r.ok ? { tone: "ok", text: `${u.email} is now ${role === "admin" ? "an admin" : "a regular user"}.` } : { tone: "error", text: r.error ?? "Failed." });
    if (r.ok) void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">Users</h1>
          <p className="mt-1 font-mono text-[11px] text-muted">{rows ? `${rows.length} accounts · ${active7} seen in the last 7 days · ${rows.filter((u) => u.purchases > 0).length} have bought` : "Loading…"}</p>
        </div>
        <label className="w-full max-w-xs">
          <span className="sr-only">Search by email or name</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email or name" className={inputCls} />
        </label>
      </div>
      {message && <p role={message.tone === "error" ? "alert" : "status"} className={`font-mono text-xs ${message.tone === "ok" ? "text-signal" : "text-fail"}`}>{message.text}</p>}
      <Panel bodyClassName="p-0" className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {["Account", "Joined", "Last seen", "Agents", "Purchases", "Spent", "Wallet", "Role"].map((h) => (
                <th key={h} className="px-3 py-2"><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <span className="block font-bold">{u.email}</span>
                  <span className="block font-mono text-[10px] text-muted">{u.name}{u.sellsApis ? ` · sells ${u.sellsApis} API${u.sellsApis > 1 ? "s" : ""}` : ""}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted">{new Date(u.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{ago(u.lastSeenAt)}</td>
                <td className="tnum px-3 py-2 font-mono">{u.agents}</td>
                <td className="tnum px-3 py-2 font-mono">{u.purchases}<span className="block text-[10px] text-muted">{u.lastPurchaseAt ? ago(u.lastPurchaseAt) : ""}</span></td>
                <td className="tnum px-3 py-2 font-mono">{usd(u.spentMicro)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{u.wallet ? shortAddress(u.wallet) : "—"}</td>
                <td className="px-3 py-2">
                  {u.admin ? (
                    <button type="button" onClick={() => void setRole(u, "user")} className="border border-signal px-2 py-1 font-mono text-[10px] font-bold uppercase text-signal hover:bg-signal hover:text-ink" title="Remove admin access">
                      Admin
                    </button>
                  ) : (
                    <button type="button" onClick={() => void setRole(u, "admin")} className="border border-line px-2 py-1 font-mono text-[10px] font-bold uppercase text-muted hover:border-signal hover:text-signal" title="Make admin">
                      User
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
