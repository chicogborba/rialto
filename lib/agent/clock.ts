import type { Clock } from "@/lib/types";

const TEST_EPOCH = Date.UTC(2026, 9, 5, 10, 42, 0);

/** Real clock. `speed` scales every sleep (0 = no waiting). */
export function realClock(speed = 1): Clock {
  let counter = 0;
  return {
    now: () => Date.now(),
    sleep: (ms) =>
      speed <= 0 || ms <= 0
        ? Promise.resolve()
        : new Promise((resolve) => setTimeout(resolve, ms * speed)),
    id: (prefix) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`,
  };
}

/** Deterministic clock: sleep is instant, now() advances by slept time, ids are sequential. */
export function testClock(epoch: number = TEST_EPOCH): Clock {
  let t = epoch;
  let counter = 0;
  return {
    now: () => t,
    sleep: (ms) => {
      t += Math.max(0, ms);
      return Promise.resolve();
    },
    id: (prefix) => `${prefix}_${++counter}`,
  };
}
