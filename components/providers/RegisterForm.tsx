"use client";

import { useState } from "react";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { emitDataChanged } from "@/lib/client/data-events";
import { RegisterProviderSchema } from "@/lib/provider-schema";
import type { CapabilityId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HardButton, Label, Panel } from "@/components/primitives";

interface FormValues {
  name: string; description: string; capabilities: CapabilityId[]; endpoint: string;
  priceUsd: string; latencyMs: string; quality: string; x402Enabled: boolean;
}
const EMPTY: FormValues = {
  name: "", description: "", capabilities: [], endpoint: "https://", priceUsd: "0.003", latencyMs: "120", quality: "90", x402Enabled: true,
};

const inputCls = "mt-2 min-h-11 w-full border border-line-hi bg-ink px-3 font-mono text-sm text-paper focus-visible:border-signal";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id}><Label>{label}</Label></label>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 font-mono text-[11px] text-fail">{error}</p>}
    </div>
  );
}

export function RegisterForm() {
  const [v, setV] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    const parsed = RegisterProviderSchema.safeParse({
      name: v.name, description: v.description, capabilities: v.capabilities, endpoint: v.endpoint,
      priceUsd: parseFloat(v.priceUsd), latencyMs: parseInt(v.latencyMs, 10), quality: parseFloat(v.quality),
      network: "solana-devnet", x402Enabled: v.x402Enabled,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await fetch("/api/providers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
    setBusy(false);
    if (res.ok) {
      setDone(`${parsed.data.name} is now discoverable by agents (unproven).`);
      setV(EMPTY);
      emitDataChanged();
    } else setErrors({ form: "Server rejected the registration." });
  };

  return (
    <Panel title="Register provider" status={<Label tone="pay">Local demo registry</Label>}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
        <Field id="p-name" label="Name" error={errors.name}>
          <input id="p-name" className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} aria-describedby={errors.name ? "p-name-err" : undefined} />
        </Field>
        <Field id="p-endpoint" label="Endpoint" error={errors.endpoint}>
          <input id="p-endpoint" className={inputCls} value={v.endpoint} onChange={(e) => set("endpoint", e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field id="p-desc" label="Description" error={errors.description}>
            <input id="p-desc" className={inputCls} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
        <fieldset className="md:col-span-2">
          <legend><Label>Capabilities</Label></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_CAPABILITIES.map((c) => {
              const on = v.capabilities.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on}
                  onClick={() => set("capabilities", on ? v.capabilities.filter((x) => x !== c) : [...v.capabilities, c])}
                  className={cn("min-h-9 border px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider", on ? "border-signal bg-signal text-ink" : "border-line-hi text-muted hover:text-paper")}>
                  {CAPABILITY_LABELS[c]}
                </button>
              );
            })}
          </div>
          {errors.capabilities && <p role="alert" className="mt-1 font-mono text-[11px] text-fail">{errors.capabilities}</p>}
        </fieldset>
        <Field id="p-price" label="Price per request (USD)" error={errors.priceUsd}>
          <input id="p-price" inputMode="decimal" className={inputCls} value={v.priceUsd} onChange={(e) => set("priceUsd", e.target.value)} />
        </Field>
        <Field id="p-lat" label="Expected latency (ms)" error={errors.latencyMs}>
          <input id="p-lat" inputMode="numeric" className={inputCls} value={v.latencyMs} onChange={(e) => set("latencyMs", e.target.value)} />
        </Field>
        <Field id="p-q" label="Quality benchmark (0–100)" error={errors.quality}>
          <input id="p-q" inputMode="decimal" className={inputCls} value={v.quality} onChange={(e) => set("quality", e.target.value)} />
        </Field>
        <div>
          <Label>Network</Label>
          <div className="mt-2 flex min-h-11 items-center border border-line px-3 font-mono text-sm text-muted">solana-devnet</div>
          <label className="mt-3 flex min-h-11 items-center gap-3 font-mono text-xs">
            <input type="checkbox" checked={v.x402Enabled} onChange={(e) => set("x402Enabled", e.target.checked)} className="size-5 accent-[var(--color-signal)]" />
            x402 enabled
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <HardButton type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish provider"}</HardButton>
          {done && <p role="status" className="font-mono text-xs text-signal">{done}</p>}
          {errors.form && <p role="alert" className="font-mono text-xs text-fail">{errors.form}</p>}
        </div>
        <p className="font-mono text-[11px] text-muted md:col-span-2">
          Registered endpoints are called with the simulated 402 protocol (see README). An endpoint that doesn&apos;t speak it fails and the agent falls back.
        </p>
      </form>
    </Panel>
  );
}
