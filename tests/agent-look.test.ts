import { describe, expect, it } from "vitest";
import { appetite } from "@/lib/agent/appetite";
import { LookPartsSchema, partsFor, partsOf, rollParts, SLOTS } from "@/lib/agent/look";
import { instructionsFor } from "@/lib/mcp/instructions";

describe("agent looks", () => {
  it("rolls the same look for the same id, and a valid one", () => {
    expect(partsFor("agent_abc")).toEqual(partsFor("agent_abc"));
    for (let i = 0; i < 200; i++) expect(LookPartsSchema.safeParse(rollParts()).success).toBe(true);
  });

  it("uses a saved look, and falls back to the rolled one when it is missing or broken", () => {
    const saved = { color: 2, accent: 1, body: 3, eyes: 4, hat: 2, glasses: 0, extra: 5 };
    expect(partsOf(JSON.stringify(saved), "agent_x")).toEqual(saved);
    expect(partsOf(null, "agent_x")).toEqual(partsFor("agent_x"));
    expect(partsOf("{not json", "agent_x")).toEqual(partsFor("agent_x"));
    expect(partsOf(JSON.stringify({ ...saved, hat: 999 }), "agent_x")).toEqual(partsFor("agent_x"));
  });

  it("rejects an option outside a slot", () => {
    for (const s of SLOTS) expect(LookPartsSchema.safeParse({ ...rollParts(), [s.key]: s.size }).success).toBe(false);
  });
});

describe("appetite", () => {
  it("clamps levels and raises limits with the level", () => {
    expect(appetite(0).level).toBe(1);
    expect(appetite(9).level).toBe(5);
    expect(appetite(null).level).toBe(3);
    expect(appetite(5).sessionMicro).toBeGreaterThan(appetite(1).sessionMicro);
  });

  it("tells a frugal agent to buy little and an all-in agent to buy the best", () => {
    expect(instructionsFor(1)).toMatch(/Frugal/);
    expect(instructionsFor(1)).not.toMatch(/be generous/);
    expect(instructionsFor(3)).toMatch(/be generous/);
    expect(instructionsFor(5)).toMatch(/All-in/);
    expect(instructionsFor(5)).toMatch(/preset accuracy/);
  });
});
