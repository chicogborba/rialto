import { describe, expect, it } from "vitest";
import { DEFAULT_FEES, feeConfigFromEnv, splitFromCharge, splitFromSellerPrice } from "@/lib/billing/fees";
import { deriveInput, fill, pick } from "@/lib/gateway/template";
import { bearerFrom, generateKey, hashKey, kindOfKey } from "@/lib/security/keys";
import { allow } from "@/lib/security/rate-limit";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";
import { assertPublicUrl, isPrivateIp, UnsafeUpstreamError } from "@/lib/security/ssrf";

describe("fees", () => {
  it("seller always gets their price; buyer pays price + fee", () => {
    const s = splitFromSellerPrice(10_000);
    expect(s).toEqual({ sellerMicro: 10_000, feeMicro: 1_000, buyerMicro: 11_000 }); // 5% = 500 < $0.001 floor
    expect(splitFromSellerPrice(100_000).feeMicro).toBe(5_000);
    expect(splitFromSellerPrice(0).feeMicro).toBe(1_000);
  });
  it("rounds the percentage up and keeps integers", () => {
    const s = splitFromSellerPrice(333_333, { bps: 500, minMicro: 0 });
    expect(Number.isInteger(s.feeMicro)).toBe(true);
    expect(s.feeMicro).toBe(Math.ceil(333_333 * 0.05));
    expect(s.buyerMicro).toBe(s.sellerMicro + s.feeMicro);
  });
  it("env overrides with sane fallbacks", () => {
    expect(feeConfigFromEnv({ PLATFORM_FEE_BPS: "250", PLATFORM_MIN_FEE_MICRO: "2000" })).toEqual({ bps: 250, minMicro: 2000 });
    expect(feeConfigFromEnv({ PLATFORM_FEE_BPS: "abc" })).toEqual(DEFAULT_FEES);
    expect(feeConfigFromEnv({ PLATFORM_FEE_BPS: "999999" }).bps).toBe(DEFAULT_FEES.bps);
  });
  it("rejects bad input and splits a settled charge", () => {
    expect(() => splitFromSellerPrice(-1)).toThrow();
    expect(() => splitFromSellerPrice(1.5)).toThrow();
    expect(splitFromCharge(11_000, 10_000)).toEqual({ sellerMicro: 10_000, feeMicro: 1_000, buyerMicro: 11_000 });
  });
});

describe("keys", () => {
  it("generates unique, prefixed, hashed keys", () => {
    const a = generateKey("buyer");
    const b = generateKey("buyer");
    expect(a.key).not.toBe(b.key);
    expect(a.key.startsWith("sy_buyer_")).toBe(true);
    expect(a.hash).toBe(hashKey(a.key));
    expect(a.hash).not.toContain(a.key);
    expect(kindOfKey(generateKey("seller").key)).toBe("seller");
    expect(kindOfKey("nope")).toBeNull();
  });
  it("parses bearer headers", () => {
    expect(bearerFrom("Bearer sy_buyer_x")).toBe("sy_buyer_x");
    expect(bearerFrom("bearer abc")).toBe("abc");
    expect(bearerFrom("Basic abc")).toBeNull();
    expect(bearerFrom(null)).toBeNull();
  });
});

describe("secrets", () => {
  it("round-trips and never stores plaintext", () => {
    const blob = encryptSecret("sk-live-123");
    expect(blob).not.toContain("sk-live-123");
    expect(decryptSecret(blob)).toBe("sk-live-123");
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });
  it("detects tampering", () => {
    const [iv, tag, enc] = encryptSecret("secret").split(".");
    const bad = [iv, tag, Buffer.from("zzzz").toString("base64")].join(".");
    expect(() => decryptSecret(bad)).toThrow();
    expect(enc.length).toBeGreaterThan(0);
  });
});

describe("ssrf guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "0.0.0.0"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("blocks unsafe URLs", async () => {
    const strict = { allowPrivate: false };
    for (const u of ["http://example.com", "https://localhost/x", "https://127.0.0.1/", "https://169.254.169.254/latest/meta-data", "https://user:pw@example.com/", "ftp://example.com", "not a url", "https://foo.internal/"]) {
      await expect(assertPublicUrl(u, strict), u).rejects.toBeInstanceOf(UnsafeUpstreamError);
    }
  });
  it("allows a public literal IP and local dev when opted in", async () => {
    await expect(assertPublicUrl("https://1.1.1.1/dns-query", { allowPrivate: false })).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("http://localhost:3000/x", { allowPrivate: true })).resolves.toBeInstanceOf(URL);
  });
});

describe("gateway templates", () => {
  it("derives a query from goals", () => {
    expect(deriveInput("Look up the Pokémon pikachu.").query).toBe("pikachu");
    expect(deriveInput('Weather for "São Paulo"').query).toBe("São Paulo");
    expect(deriveInput("tell me about Ditto").query).toBe("ditto");
    expect(deriveInput("charizard").query).toBe("charizard");
  });
  it("encodes per mode", () => {
    expect(fill("https://x/{query}", { query: "a b/c" }, "url")).toBe("https://x/a%20b%2Fc");
    expect(fill('{"q":"{query}"}', { query: 'he said "hi"' }, "json")).toBe('{"q":"he said \\"hi\\""}');
    expect(fill("{missing}", {})).toBe("");
  });
  it("picks fields with wildcards", () => {
    const d = { name: "pikachu", id: 25, sprites: { front_default: "u" }, types: [{ type: { name: "electric" } }, { type: { name: "x" } }] };
    expect(pick(d, "name,id,sprite=sprites.front_default,types=types.*.type.name")).toEqual({ name: "pikachu", id: 25, sprite: "u", types: ["electric", "x"] });
    expect(pick(d, "nope.deep")).toEqual({});
  });
});

describe("rate limit", () => {
  it("allows a burst then throttles, then refills", () => {
    const k = `t-${Math.random()}`;
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => allow(k, 3, 1, t0))).toEqual([true, true, true]);
    expect(allow(k, 3, 1, t0)).toBe(false);
    expect(allow(k, 3, 1, t0 + 2_000)).toBe(true);
  });
});
