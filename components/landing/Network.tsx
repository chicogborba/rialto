"use client";

import Link from "next/link";
import { useActive } from "@/hooks/useActive";
import { formatUsd, toDollars } from "@/lib/money";
import { CountUp, hardButtonClass, Label, Panel, Sticker } from "@/components/primitives";
import { MARKET_PREVIEW, VISION_QUALIFIED } from "./data";
import { Section } from "./Section";

const vm = VISION_QUALIFIED.find((c) => c.provider.slug === "visionmax") ?? VISION_QUALIFIED[0];

function ReputationCard() {
  const { ref, active } = useActive<HTMLDivElement>();
  const p = vm.provider;
  return (
    <div ref={ref}>
      <Panel title="Reputation" selected status={<Label tone="paper">{p.name}</Label>} bodyClassName="space-y-4">
        <div className="tnum font-mono text-6xl font-bold leading-none text-signal"><CountUp value={active ? p.reputationScore : 0} format={(n) => n.toFixed(1)} duration={1.2} /></div>
        <dl className="tnum grid grid-cols-2 gap-3 font-mono text-sm">
          <div><dt><Label>Requests</Label></dt><dd><CountUp value={active ? p.requestCount : 0} format={(n) => Math.round(n).toLocaleString("en-US")} duration={1.4} /></dd></div>
          <div><dt><Label>Success</Label></dt><dd>{p.successRate}%</dd></div>
          <div><dt><Label>Avg latency</Label></dt><dd>{p.latencyMs}ms</dd></div>
          <div><dt><Label>Quality</Label></dt><dd>{p.qualityScore}%</dd></div>
        </dl>
        <p className="font-mono text-[11px] text-muted">Feeds the agent&apos;s trust score. Updated after every attempt.</p>
      </Panel>
    </div>
  );
}

const mcpCall = `discover_services({
  capability: "vision.damage_detection"
})`;
const mcpResult = JSON.stringify(
  {
    count: VISION_QUALIFIED.length,
    services: VISION_QUALIFIED.slice(0, 2).map((c) => ({
      provider: c.provider.name,
      priceUsd: toDollars(c.service.priceMicro),
      quality: c.provider.qualityScore,
      reputation: c.provider.reputationScore,
      x402Enabled: c.provider.x402Enabled,
    })),
  },
  null,
  2,
);
const mcpConfig = `{ "mcpServers": { "switchyard": {
  "command": "npm",
  "args": ["run", "--silent", "mcp"],
  "cwd": "<path to repo>" } } }`;

export function Network() {
  return (
    <Section id="developers" index="07 / NETWORK" title="Trust. Supply. Tools." intro="Reputation feeds the decision. The exchange feeds the agent. MCP lets any agent plug in without a dashboard.">
      <div className="grid gap-8 lg:grid-cols-3">
        <ReputationCard />
        <Panel title="Exchange preview" status={<Sticker tone="pay">Demo providers</Sticker>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left font-mono text-xs">
              <caption className="sr-only">Marketplace preview</caption>
              <tbody>
                {MARKET_PREVIEW.map((c) => (
                  <tr key={c.service.id} className="border-b border-line">
                    <th scope="row" className="px-3 py-2 font-display text-sm font-bold">{c.provider.name}<div className="font-mono text-[10px] font-normal text-muted">{c.service.capability}</div></th>
                    <td className="tnum px-2 py-2">{formatUsd(c.service.priceMicro)}</td>
                    <td className="tnum px-2 py-2 text-signal">{c.provider.reputationScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3"><Link href="/app/marketplace" className={hardButtonClass("ghost")}>Open the exchange</Link></div>
        </Panel>
        <Panel title="MCP" status={<Label tone="paper">7 tools</Label>} bodyClassName="space-y-3">
          <pre className="overflow-x-auto border border-line bg-ink p-2 font-mono text-[11px] text-signal">{mcpCall}</pre>
          <pre className="max-h-48 overflow-auto border border-line bg-ink p-2 font-mono text-[11px]">{mcpResult}</pre>
          <pre className="overflow-x-auto border border-line bg-ink p-2 font-mono text-[11px] text-muted">{mcpConfig}</pre>
          <p className="font-mono text-[10px] text-muted">discover · compare · reputation · plan · execute · transactions · wallet</p>
        </Panel>
      </div>
    </Section>
  );
}
