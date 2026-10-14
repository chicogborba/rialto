import { describe, expect, it } from "vitest";
import { internalBase } from "@/lib/http";
import { isAdmin } from "@/lib/security/admin";

const req = (auth?: string) => new Request("https://rialto.example.com/api/reset", { method: "POST", headers: auth ? { authorization: auth } : {} });

describe("who may reset the data", () => {
  it("is open while developing", () => {
    expect(isAdmin(req(), { NODE_ENV: "development" })).toBe(true);
  });
  it("in production needs the admin token, and with none set nobody passes", () => {
    const prod = { NODE_ENV: "production", ADMIN_TOKEN: "s3cret-token" };
    expect(isAdmin(req(), prod)).toBe(false);
    expect(isAdmin(req("Bearer wrong"), prod)).toBe(false);
    expect(isAdmin(req("Bearer s3cret-token-and-more"), prod)).toBe(false);
    expect(isAdmin(req("Bearer s3cret-token"), prod)).toBe(true);
    expect(isAdmin(req("Bearer anything"), { NODE_ENV: "production" })).toBe(false);
    expect(isAdmin(req("Bearer "), { NODE_ENV: "production", ADMIN_TOKEN: "" })).toBe(false);
  });
});

describe("server settings", () => {
  it("reaches itself on INTERNAL_BASE_URL when set, else where the request came in", () => {
    const r = new Request("https://rialto.example.com/api/runs");
    const before = process.env.INTERNAL_BASE_URL;
    delete process.env.INTERNAL_BASE_URL;
    expect(internalBase(r)).toBe("https://rialto.example.com");
    process.env.INTERNAL_BASE_URL = "http://127.0.0.1:3000/";
    expect(internalBase(r)).toBe("http://127.0.0.1:3000");
    if (before === undefined) delete process.env.INTERNAL_BASE_URL;
    else process.env.INTERNAL_BASE_URL = before;
  });
});
