/** Small in-memory token bucket. Per-process only: swap for Redis/Upstash when running more than one instance. */
interface Bucket {
  tokens: number;
  at: number;
}
const buckets = new Map<string, Bucket>();

export function allow(key: string, capacity: number, refillPerSec: number, now: number = Date.now()): boolean {
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) for (const k of buckets.keys()) { buckets.delete(k); break; }
  return ok;
}

/** Signup throttle per address: strict in production, loose while developing. */
export function signupAllowed(ip: string): boolean {
  return process.env.NODE_ENV === "production" ? allow(`signup:${ip}`, 5, 1 / 60) : allow(`signup:${ip}`, 200, 5);
}

/**
 * Runs without a key use the shared demo agent (the public console). Throttled per address in
 * production so one visitor cannot burn through it: a burst of 12, then one run every 10 seconds.
 */
export function anonymousRunAllowed(ip: string): boolean {
  return process.env.NODE_ENV === "production" ? allow(`anon-run:${ip}`, 12, 1 / 10) : true;
}
