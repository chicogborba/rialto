import type { CapabilityId } from "@/lib/types";
import { isCapabilityId } from "./capabilities";

export interface RunResultStep {
  stepId: string;
  capability: CapabilityId;
  provider: string;
  output: unknown;
}
export interface RunResult {
  final: unknown;
  steps: RunResultStep[];
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Narrow the `run.completed.result` payload. */
export function parseResult(result: unknown): RunResult | null {
  if (!isRecord(result) || !Array.isArray(result.steps)) return null;
  const steps: RunResultStep[] = [];
  for (const s of result.steps) {
    if (isRecord(s) && typeof s.stepId === "string" && typeof s.capability === "string" && isCapabilityId(s.capability) && typeof s.provider === "string") {
      steps.push({ stepId: s.stepId, capability: s.capability, provider: s.provider, output: s.output });
    }
  }
  return { final: result.final, steps };
}
