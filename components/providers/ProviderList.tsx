"use client";

import type { ProviderWithServices } from "@/lib/api-types";
import { emitDataChanged } from "@/lib/client/data-events";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd } from "@/lib/money";
import type { ProviderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Label, Panel, StatusDot, Sticker } from "@/components/primitives";

async function setStatus(id: string, status: ProviderStatus) {
  await fetch(`/api/providers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  emitDataChanged();
}

function Row({ p }: { p: ProviderWithServices }) {
  const online = p.provider.status === "online";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot tone={online ? "ok" : "fail"} />
          <span className="font-bold">{p.provider.name}</span>
          {p.provider.isDemo ? <span className="border border-line-hi px-1 font-mono text-[9px] uppercase tracking-wider text-muted">Demo</span> : p.unproven && <Sticker tone="pay">Unproven</Sticker>}
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted">
          {p.services.map((s) => `${s.capability} ${formatUsd(s.priceMicro)}`).join(" · ")}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={online}
        aria-label={`${p.provider.name} online`}
        onClick={() => setStatus(p.provider.id, online ? "offline" : "online")}
        className={cn("min-h-11 min-w-24 border px-3 font-mono text-[10px] font-bold uppercase tracking-wider", online ? "border-signal text-signal" : "border-fail text-fail")}
      >
        {online ? "Online" : "Offline"}
      </button>
    </li>
  );
}

export function ProviderList() {
  const { data } = useFetch<{ providers: ProviderWithServices[] }>("/api/providers");
  const all = data?.providers ?? [];
  const registered = all.filter((p) => !p.provider.isDemo);
  const demo = all.filter((p) => p.provider.isDemo);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={`Registered by you (${registered.length})`}>
        {registered.length === 0 ? <p className="font-mono text-xs text-muted">None yet. Publish one above.</p> : <ul>{registered.map((p) => <Row key={p.provider.id} p={p} />)}</ul>}
      </Panel>
      <Panel title={`Demo providers (${demo.length})`} status={<Label>Toggle one offline to watch the agent re-route</Label>}>
        <ul className="max-h-[480px] overflow-y-auto">{demo.map((p) => <Row key={p.provider.id} p={p} />)}</ul>
      </Panel>
    </div>
  );
}
