import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { RpcBusyError } from "@/lib/x402/rpc-busy";
import { solanaRpc } from "@/lib/x402/solana";

/** A fake RPC: answers 429 (Retry-After: 1) while `busy` > 0, then a balance. */
let busy = 0;
let calls = 0;
let server: Server;
let url = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls++;
      if (busy > 0) {
        busy--;
        res.writeHead(429, { "retry-after": "1" }).end("Too many requests");
        return;
      }
      const { id } = JSON.parse(body) as { id: number };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, result: { context: { slot: 1 }, value: 42 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

const who = address("GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz");

describe("a busy Solana RPC", () => {
  it("is waited out instead of failing", async () => {
    busy = 2;
    calls = 0;
    const res = await solanaRpc(url).getBalance(who).send();
    expect(Number(res.value)).toBe(42);
    expect(calls).toBe(3);
  }, 15_000);
  it("gives up after about 10 seconds with a message that says to wait", async () => {
    busy = 100;
    const started = Date.now();
    await expect(solanaRpc(url).getBalance(who).send()).rejects.toBeInstanceOf(RpcBusyError);
    expect(Date.now() - started).toBeLessThan(12_000);
    busy = 0;
  }, 20_000);
});
