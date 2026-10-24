"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Label, Panel } from "@/components/primitives";
import { Stat } from "@/components/account/ui";
import type { Check, OperatorHealth } from "@/lib/admin/health";
import type { ModeFilter, Range, Stats } from "@/lib/admin/stats";
import { api } from "@/lib/client/api";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BarChart } from "./BarChart";

const RANGES: Range[] = ["24h", "7d", "30d", "90d"];
const MODES: { id: ModeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "On-chain" },
  { id: "simulated", label: "Simulated" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const usd = (micro: number): string => (micro < 0 ? `−${formatUsd(-micro)}` : formatUsd(micro));
const pct = (x: number): string => `${Math.round(x * 100)}%`;

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex border border-line">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={cn("min-h-9 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em]", value === o.id ? "bg-signal text-ink" : "text-muted hover:text-paper")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Checks({ title, checks }: { title: string; checks: Check[] }) {
  const ok = checks.filter((c) => c.ok).length;
  return (
    <Panel title={title} status={<span className={cn("font-mono text-[10px]", ok === checks.length ? "text-signal" : "text-muted")}>{ok} / {checks.length}</span>} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 px-4 py-3">
            <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center border font-mono text-[11px] font-bold", c.ok ? "border-signal bg-signal text-ink" : "border-fail text-fail")}>
              {c.ok ? "✓" : "!"}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">
                <span className="sr-only">{c.ok ? "OK: " : "Needs attention: "}</span>
                {c.label}
              </span>
              <span className="block break-words font-mono text-[11px] text-muted">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function tickFor(iso: string, unit: "hour" | "day", i: number, n: number, tz: string): string {
  const every = unit === "hour" ? 4 : n > 31 ? 14 : n > 8 ? 5 : 1;
  if (i % every !== 0) return "";
  const d = new Date(iso);
  // day buckets are UTC days: label them as such, or a day west of Greenwich shows as the one before
  return unit === "hour" ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

const bucketTitle = (iso: string, unit: "hour" | "day", tz: string): string =>
  unit === "hour" ? new Date(iso).toLocaleString("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }) : `${new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "medium" })} (UTC)`;

export function AdminOverview() {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [range, setRange] = useState<Range>("7d");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<OperatorHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<Stats>(`/api/admin/stats?range=${range}&mode=${mode}&tz=${encodeURIComponent(tz)}`);
    if (r.ok && r.data) {
      setStats(r.data);
      setError(null);
    } else setError(r.error);
  }, [range, mode, tz]);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load();
    });
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    let alive = true;
    void api<OperatorHealth>("/api/admin/health").then((r) => alive && r.data && setHealth(r.data));
    return () => {
      alive = false;
    };
  }, []);

  const t = stats?.totals;
  const unit = stats?.series.unit ?? "day";
  const buckets = stats?.series.buckets ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.1rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.05em]">The market</h1>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {health ? `${health.network} · ${health.paymentMode === "live" ? "x402 live" : "simulated"} · ` : ""}times in {tz} · refreshes every minute
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Range" value={range} onChange={setRange} options={RANGES.map((r) => ({ id: r, label: r }))} />
          <Segmented label="Payments" value={mode} onChange={setMode} options={MODES} />
        </div>
      </div>

      {error && <p role="alert" className="font-mono text-xs text-fail">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Profit" value={t ? usd(t.profitMicro) : "…"} hint={t ? `${usd(t.feeMicro)} commission + ${usd(t.operatorSalesMicro - t.upstreamCostMicro)} margin` : undefined} />
        <Stat label="Paid by buyers" value={t ? usd(t.grossMicro) : "…"} hint={t ? `avg ${usd(t.avgTicketMicro)} a call` : undefined} />
        <Stat label="Purchases" value={t ? t.purchases.toLocaleString("en-US") : "…"} hint={t ? `${t.failed} failed · ${pct(t.successRate)} succeed` : undefined} />
        <Stat label="Paid to APIs" value={t ? usd(t.upstreamCostMicro) : "…"} hint={t ? `fal & co. · ${usd(t.sellersMicro)} to other sellers` : undefined} />
        <Stat label="Active users" value={stats ? stats.users.activeInRange : "…"} hint={stats ? `${stats.users.buyingInRange} bought · ${stats.users.walletBuyersInRange} wallets w/o account` : undefined} />
        <Stat label="New sign-ups" value={stats ? stats.users.newInRange : "…"} hint={stats ? `${stats.users.total} accounts in all` : undefined} />
        <Stat label="Busiest hour" value={stats?.peaks.busiestHour != null ? `${String(stats.peaks.busiestHour).padStart(2, "0")}:00` : "—"} hint={stats?.peaks.busiestWeekday != null ? `busiest day: ${WEEKDAYS[stats.peaks.busiestWeekday]}` : "no purchases yet"} />
        <Stat label="Integrations" value={health ? `${health.integrations.online}/${health.integrations.total}` : "…"} hint={health ? `${usd(health.pricing.soldLast24hMicro)} of ${usd(health.pricing.dailyCapMicro)} daily limit` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Purchases per ${unit}`} bodyClassName="p-4 pt-8">
          <BarChart label={`Purchases per ${unit}`} format={(v) => v.toLocaleString("en-US")} bars={buckets.map((b, i) => ({ tick: tickFor(b.at, unit, i, buckets.length, tz), title: bucketTitle(b.at, unit, tz), value: b.purchases }))} />
        </Panel>
        <Panel title={`Profit per ${unit}`} bodyClassName="p-4 pt-8">
          <BarChart label={`Profit per ${unit}`} format={usd} bars={buckets.map((b, i) => ({ tick: tickFor(b.at, unit, i, buckets.length, tz), title: bucketTitle(b.at, unit, tz), value: Math.max(0, b.profitMicro) }))} />
        </Panel>
        <Panel title="Peak hours · purchases by hour of day" bodyClassName="p-4 pt-8">
          <BarChart label="Purchases by hour of day" format={(v) => v.toLocaleString("en-US")} bars={(stats?.peaks.byHour ?? Array<number>(24).fill(0)).map((v, h) => ({ tick: h % 3 === 0 ? String(h).padStart(2, "0") : "", title: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`, value: v }))} />
        </Panel>
        <Panel title="Peak days · purchases by weekday" bodyClassName="p-4 pt-8">
          <BarChart label="Purchases by weekday" format={(v) => v.toLocaleString("en-US")} bars={(stats?.peaks.byWeekday ?? Array<number>(7).fill(0)).map((v, d) => ({ tick: WEEKDAYS[d], title: WEEKDAYS[d], value: v }))} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top APIs" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2"><Label>API</Label></th>
                <th className="px-2 py-2 text-right"><Label>Calls</Label></th>
                <th className="px-2 py-2 text-right"><Label>Paid</Label></th>
                <th className="px-4 py-2 text-right"><Label>Profit</Label></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(stats?.topApis ?? []).map((a) => (
                <tr key={a.providerId}>
                  <td className="px-4 py-2">
                    <span className="font-bold">{a.name}</span> <span className="font-mono text-[10px] text-muted">{a.operator ? "RIALTO" : a.capability}</span>
                  </td>
                  <td className="tnum px-2 py-2 text-right font-mono">{a.purchases}</td>
                  <td className="tnum px-2 py-2 text-right font-mono">{usd(a.grossMicro)}</td>
                  <td className="tnum px-4 py-2 text-right font-mono">{usd(a.profitMicro)}</td>
                </tr>
              ))}
              {stats && stats.topApis.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center font-mono text-xs text-muted">No purchases in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Top buyers" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2"><Label>Who</Label></th>
                <th className="px-2 py-2 text-right"><Label>Calls</Label></th>
                <th className="px-4 py-2 text-right"><Label>Paid</Label></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(stats?.topBuyers ?? []).map((b) => (
                <tr key={`${b.kind}:${b.who}`}>
                  <td className="max-w-[16rem] truncate px-4 py-2">
                    <span className="font-mono text-[10px] text-muted">{b.kind === "user" ? "ACCOUNT" : b.kind === "wallet" ? "WALLET" : "AGENT"}</span> {b.who}
                  </td>
                  <td className="tnum px-2 py-2 text-right font-mono">{b.purchases}</td>
                  <td className="tnum px-4 py-2 text-right font-mono">{usd(b.grossMicro)}</td>
                </tr>
              ))}
              {stats && stats.topBuyers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center font-mono text-xs text-muted">No buyers in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      {health ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Checks title="Is the money path working" checks={health.checks} />
          <Checks title="Ready for Solana mainnet" checks={health.mainnet} />
        </div>
      ) : (
        <p className="font-mono text-xs text-muted">Checking wallets, fal.ai and the facilitator…</p>
      )}
    </div>
  );
}
