import type { RunEvent } from "@/lib/agent/events";

export function isRunEvent(v: unknown): v is RunEvent {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    typeof v.type === "string" &&
    "seq" in v &&
    typeof v.seq === "number"
  );
}

/** Incremental `data: {json}\n\n` frame parser. Feed chunks; returns complete events. */
export class SseParser {
  private buffer = "";
  push(chunk: string): RunEvent[] {
    this.buffer += chunk;
    const out: RunEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n\n")) !== -1) {
      const frame = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const parsed: unknown = JSON.parse(line.slice(5).trim());
          if (isRunEvent(parsed)) out.push(parsed);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
    return out;
  }
}
