"use client";

import { useEffect, useMemo, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import { inputCls } from "@/components/account/ui";
import type { SettingGroup, SettingView } from "@/lib/admin/settings";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const GROUPS: { id: SettingGroup; title: string; note: string }[] = [
  { id: "keys", title: "Upstream API keys", note: "Stored encrypted. Rialto pays these providers per call; buyers pay Rialto cost + margin + commission." },
  { id: "wallets", title: "Where the money goes", note: "Addresses only: Rialto never holds a key or a balance. Buyers' wallets pay these directly over x402." },
  { id: "pricing", title: "Prices and limits", note: "Saving re-prices every API at once. Sellers always receive the price they set." },
  { id: "network", title: "Solana", note: "The network itself (devnet or mainnet) is set on the server; see Overview → Ready for Solana mainnet." },
];

/** Keys, payout wallets, margin and commission: saved in the database, applied without a restart. */
export function AdminSettings() {
  const [settings, setSettings] = useState<SettingView[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void api<{ settings: SettingView[] }>("/api/admin/settings").then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setSettings(r.data.settings);
      else setMessage({ tone: "error", text: r.error ?? "Could not load settings." });
    });
    return () => {
      alive = false;
    };
  }, []);

  const changed = useMemo(() => Object.keys(draft).filter((k) => draft[k] !== undefined), [draft]);

  const save = async (changes: Record<string, string>, generate?: string) => {
    setBusy(true);
    setMessage(null);
    const r = await api<{ saved: string[]; integrations: string[]; repriced: number; settings: SettingView[] }>("/api/admin/settings", { method: "PUT", json: { changes, ...(generate ? { generate } : {}) } });
    setBusy(false);
    if (!r.ok || !r.data) {
      setMessage({ tone: "error", text: r.error ?? "Could not save." });
      return;
    }
    setSettings(r.data.settings);
    setDraft({});
    setMessage({ tone: "ok", text: `Saved ${r.data.saved.length} setting${r.data.saved.length > 1 ? "s" : ""}. ${r.data.integrations.length} integrations on sale, ${r.data.repriced} APIs re-priced.` });
  };

  if (!settings) return <p className="font-mono text-xs text-muted">{message?.text ?? "Loading…"}</p>;

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed.length) void save(Object.fromEntries(changed.map((k) => [k, draft[k]])));
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Keys & wallets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">A value saved here wins over the server&apos;s environment. Clear it to go back to the environment&apos;s value.</p>
        </div>
        <button type="submit" disabled={busy || changed.length === 0} className="border border-signal bg-signal px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink disabled:border-line disabled:bg-transparent disabled:text-muted">
          {busy ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "Nothing to save"}
        </button>
      </div>
      {message && <p role={message.tone === "error" ? "alert" : "status"} className={cn("font-mono text-xs", message.tone === "ok" ? "text-signal" : "text-fail")}>{message.text}</p>}

      {GROUPS.map((g) => (
        <Panel key={g.id} title={g.title} bodyClassName="p-0">
          <p className="border-b border-line px-4 py-3 text-sm text-muted">{g.note}</p>
          <div className="divide-y divide-line">
            {settings
              .filter((s) => s.group === g.id)
              .map((s) => {
                const editing = draft[s.key] !== undefined;
                return (
                  <div key={s.key} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-6">
                    <div>
                      <p className="font-bold">{s.label}</p>
                      <p className="mt-1 text-[13px] leading-snug text-muted">{s.hint}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        {s.key} · {s.source === "admin" ? `set here${s.updatedBy ? ` by ${s.updatedBy}` : ""}` : s.source === "env" ? "from the server environment" : "not set"}
                      </p>
                    </div>
                    <div>
                      {editing ? (
                        <label className="block">
                          <span className="sr-only">{s.label}</span>
                          <input
                            autoFocus
                            type={s.secret ? "password" : "text"}
                            autoComplete="off"
                            spellCheck={false}
                            inputMode={s.kind === "number" ? "decimal" : undefined}
                            value={draft[s.key]}
                            onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                            placeholder={s.secret ? "Paste the new key" : s.kind === "address" ? "Solana address" : s.kind === "url" ? "https://…" : ""}
                            className={cn(inputCls, "mt-0")}
                          />
                        </label>
                      ) : (
                        <p className={cn("min-h-11 break-all border border-line px-3 py-2.5 font-mono text-sm", s.value ? "text-paper" : "text-muted")}>{s.value || "—"}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] font-bold uppercase tracking-wider">
                        {editing ? (
                          <button type="button" onClick={() => setDraft(({ [s.key]: _, ...rest }) => rest)} className="text-muted underline hover:text-paper">Cancel</button>
                        ) : (
                          <button type="button" onClick={() => setDraft((d) => ({ ...d, [s.key]: s.secret ? "" : s.value }))} className="text-signal underline">{s.value ? "Change" : "Set"}</button>
                        )}
                        {s.key === "RIALTO_SPENDER_KEY" && !editing && (
                          <button type="button" disabled={busy} onClick={() => window.confirm(s.value ? "Make a new spender key? Every allowance buyers gave to the current one stops working until they approve again." : "Make a spender key on the server? Then send it a little SOL (0.01) for the approval fees.") && void save({}, "RIALTO_SPENDER_KEY")} className="text-signal underline">
                            {s.value ? "Generate a new one" : "Generate"}
                          </button>
                        )}
                        {s.source === "admin" && !editing && (
                          <button type="button" disabled={busy} onClick={() => window.confirm(`Clear ${s.label}? The server's environment value (if any) applies again.`) && void save({ [s.key]: "" })} className="text-muted underline hover:text-fail">
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      ))}
      <p className="font-mono text-[11px] text-muted">
        <Label>Note</Label> Wallet addresses need a USDC account on the network before they can be paid: send each one any amount of USDC once.
      </p>
    </form>
  );
}
