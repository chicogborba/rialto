"use client";

import { formatUsd } from "@/lib/money";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import type { RunState } from "@/lib/agent/reducer";
import { isRecord, parseResult, type RunResultStep } from "@/lib/agent/result";
import { REJECTION_HINTS } from "@/lib/routing/qualify";
import { Label, Panel } from "@/components/primitives";

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function StepOutput({ step }: { step: RunResultStep }) {
  const o = isRecord(step.output) ? step.output : null;
  if (!o) return <p className="font-mono text-xs text-muted">No output.</p>;
  switch (step.capability) {
    case "vision.damage_detection":
      return (
        <div className="space-y-2">
          <div className={`inline-block px-2 py-1 font-mono text-sm font-bold uppercase ${o.damageDetected ? "bg-fail text-ink" : "bg-signal text-ink"}`}>
            {o.damageDetected ? "Structural damage detected" : "No structural damage"}
          </div>
          <ul className="space-y-1 text-sm">
            {arr(o.findings).filter(isRecord).map((f, i) => (
              <li key={i} className="border-l-2 border-line-hi pl-3">
                <strong>{str(f.location)}</strong> — {str(f.type)} · <span className="font-mono text-xs">{str(f.severity)} · {Math.round(Number(f.confidence) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{str(o.recommendation)}</p>
        </div>
      );
    case "data.lookup":
      return (
        <div className="flex items-center gap-4">
          {typeof o.sprite === "string" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.sprite} alt={str(o.name)} width={96} height={96} className="size-24 border border-line bg-paper" style={{ imageRendering: "pixelated" }} />
          )}
          <div className="space-y-1 text-sm">
            <p className="text-lg font-bold capitalize">{str(o.name)} <span className="font-mono text-xs text-muted">#{String(o.id)}</span></p>
            <p className="font-mono text-xs">{arr(o.types).map(String).join(" · ")}</p>
            <p className="font-mono text-[11px] text-signal">LIVE DATA from {str(o.source)} · payment simulated</p>
          </div>
        </div>
      );
    case "llm.analysis":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{str(o.analysis)}</p>;
    case "text.translate":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{str(o.translation)}</p>;
    case "text.summarize":
      // a list from the demo providers, one block of text from a live model
      return typeof o.summary === "string" ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{o.summary}</p> : <ul className="list-disc space-y-1 pl-5 text-sm">{arr(o.summary).map((b, i) => <li key={i}>{str(b)}</li>)}</ul>;
    case "vision.describe":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{str(o.description) || str(o.note)}</p>;
    case "audio.transcribe":
      return (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{str(o.text) || str(o.note)}</p>
          {str(o.language) && <p className="font-mono text-[11px] text-muted">Language: {str(o.language)}</p>}
        </div>
      );
    case "image.sprites":
    case "image.generate":
    case "image.vector":
    case "image.edit":
    case "image.background_removal":
    case "image.upscale": {
      const image = str(o.image);
      return image.startsWith("https://") ? (
        <div className="flex flex-wrap items-end gap-4">
          {/* the checkerboard shows through a transparent sprite or cut-out */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Generated image" className="max-h-72 max-w-full border border-line object-contain" style={{ background: "repeating-conic-gradient(#e9e2d3 0% 25%, #f7f2e7 0% 50%) 50% / 20px 20px" }} />
          <div className="space-y-2">
            <a href={image} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center border-2 border-ink bg-signal px-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Open image
            </a>
            <p className="font-mono text-[11px] text-muted">Live image from {str(o.source)}.</p>
          </div>
        </div>
      ) : <pre className="overflow-x-auto font-mono text-[11px] text-muted">{JSON.stringify(o, null, 1).slice(0, 600)}</pre>;
    }
    case "video.generate": {
      const video = str(o.video);
      return video.startsWith("https://") ? (
        <div className="space-y-2">
          <video controls preload="metadata" className="max-h-80 w-full border border-line bg-ink" src={video}>Your browser cannot play this video.</video>
          <p className="font-mono text-[11px] text-muted">Live video from {str(o.source)}.</p>
        </div>
      ) : <p className="text-sm text-muted">{str(o.note) || "No video returned."}</p>;
    }
    case "web.search":
      // a written answer from a live model, a list of hits from the demo providers
      return typeof o.answer === "string" ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{o.answer}</p> : (
        <ul className="space-y-1 text-sm">{arr(o.results).filter(isRecord).map((h, i) => <li key={i}>{str(h.title)} <span className="font-mono text-[11px] text-muted">{str(h.snippet)}</span></li>)}</ul>
      );
    case "audio.speech": {
      const audio = str(o.audio);
      if (audio.startsWith("https://")) {
        return (
          <div className="space-y-2">
            <audio controls preload="metadata" className="w-full" src={audio}>Your browser cannot play this audio.</audio>
            <p className="font-mono text-[11px] text-muted">Live audio from {str(o.source)}.</p>
          </div>
        );
      }
      return audio ? (
        <div className="space-y-2">
          <audio controls preload="metadata" className="w-full" src={`data:audio/mpeg;base64,${audio}`}>Your browser cannot play this audio.</audio>
          <p className="font-mono text-[11px] text-muted">Live audio from {str(o.source)}.</p>
        </div>
      ) : <p className="text-sm text-muted">{str(o.note) || "No audio returned."}</p>;
    }
    case "audio.sfx":
    case "audio.music": {
      const audio = str(o.audio);
      return audio.startsWith("https://") ? (
        <div className="space-y-2">
          <audio controls preload="metadata" className="w-full" src={audio}>Your browser cannot play this audio.</audio>
          <p className="font-mono text-[11px] text-muted">Live audio from {str(o.source)}.</p>
        </div>
      ) : <p className="text-sm text-muted">{str(o.note) || "No audio returned."}</p>;
    }
    case "model.3d":
    case "model.image_to_3d": {
      const model = str(o.model);
      const preview = str(o.preview);
      return model ? (
        <div className="flex flex-wrap items-center gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Generated 3D model preview" className="size-28 border border-line bg-paper object-cover" />
          )}
          <div className="space-y-2">
            <a href={model} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center border-2 border-ink bg-signal px-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Download 3D model
            </a>
            <p className="font-mono text-[11px] text-muted">{str(o.taskId) ? `Tripo task ${str(o.taskId)} · link expires after a few minutes.` : `Live model from ${str(o.source)}.`}</p>
          </div>
        </div>
      ) : <p className="text-sm text-muted">{str(o.note) || "No 3D model returned."}</p>;
    }
    case "news.search":
      return <ul className="space-y-1 text-sm">{arr(o.headlines).filter(isRecord).map((h, i) => <li key={i}>{str(h.title)} <span className="font-mono text-[11px] text-muted">{str(h.source)}</span></li>)}</ul>;
    case "market.quotes":
      return <p className="tnum font-mono text-sm">{str(o.symbol)} {String(o.price)} ({String(o.changePct)}%) vol {String(o.volume)}</p>;
    default:
      return <pre className="overflow-x-auto font-mono text-[11px] text-muted">{JSON.stringify(o, null, 1).slice(0, 600)}</pre>;
  }
}

export function ResultView({ state }: { state: RunState }) {
  if (state.status === "failed") {
    return (
      <Panel title="Run failed" status={<Label tone="fail">No charge for failed calls</Label>}>
        <p className="text-sm">{state.error?.message}</p>
        {state.error?.rejected && state.error.rejected.length > 0 && (
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {state.error.rejected.map((r) => (
              <li key={r.candidate.service.id}>
                <span className="text-fail">✕ {r.candidate.provider.name}</span> — {REJECTION_HINTS[r.reason]}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }
  const result = parseResult(state.result);
  if (state.status !== "completed" || !result) {
    return <p className="font-mono text-xs text-muted">Result appears here when the run completes.</p>;
  }
  const s = state.savings;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 border border-line bg-surface p-4 md:grid-cols-4">
        <div><Label>Total cost</Label><div className="tnum mt-1 font-mono text-xl font-bold text-signal">{formatUsd(state.totalCostMicro)}</div></div>
        <div><Label>Latency (critical path)</Label><div className="tnum mt-1 font-mono text-xl font-bold">{state.totalLatencyMs}ms</div></div>
        <div><Label>Saved vs premium</Label><div className="tnum mt-1 font-mono text-xl font-bold">{s ? formatUsd(s.savedMicro) : "—"}</div></div>
        <div><Label>Cheapest route</Label><div className="tnum mt-1 font-mono text-sm">{s ? `${formatUsd(s.cheapestBaselineMicro)} · ${s.qualityDeltaVsCheapest >= 0 ? "+" : ""}${s.qualityDeltaVsCheapest} pts` : "—"}</div></div>
      </div>
      {result.steps.map((st) => (
        <Panel key={st.stepId} title={`${st.stepId} · ${CAPABILITY_LABELS[st.capability]}`} status={<Label tone="paper">{st.provider}</Label>}>
          <StepOutput step={st} />
        </Panel>
      ))}
    </div>
  );
}
