import { describe, expect, it } from "vitest";
import { formatUsd, formatUsdc, toMicro } from "@/lib/money";

describe("money", () => {
  it("converts and formats", () => {
    expect(toMicro(0.012)).toBe(12_000);
    expect(toMicro(10)).toBe(10_000_000);
    expect(formatUsd(12_000)).toBe("$0.012");
    expect(formatUsd(9_988_000)).toBe("$9.99");
    expect(formatUsdc(12_000)).toBe("0.012 USDC");
  });
});
