import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Shared secret between the agent orchestrator and the gateway routes, so the gateway can't be called
 * directly with a forged simulated payment. Set INTERNAL_TOKEN when running more than one instance.
 * The live x402 path does not need it: there the facilitator verifies a real signed payment.
 */
export const INTERNAL_HEADER = "x-sy-internal";

declare global {
  var __syInternalToken: string | undefined;
}

export function internalToken(): string {
  return process.env.INTERNAL_TOKEN ?? (globalThis.__syInternalToken ??= randomBytes(24).toString("hex"));
}

export function isInternal(req: Request): boolean {
  const got = Buffer.from(req.headers.get(INTERNAL_HEADER) ?? "");
  const want = Buffer.from(internalToken());
  return got.length === want.length && timingSafeEqual(got, want);
}
