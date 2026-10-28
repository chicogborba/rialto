import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/x402", () => ({ currentMode: vi.fn(() => "simulated"), getRail: vi.fn(() => ({})) }));
import { currentMode } from "@/lib/x402";
import { requireSimulation, simulationAllowed } from "@/lib/simulation";
import { POST as topup } from "@/app/api/agents/me/topup/route";
import { POST as register } from "@/app/api/agents/route";
import { POST as credit } from "@/app/api/account/test-credit/route";
import { POST as fund } from "@/app/api/account/agents/[id]/fund/route";
import { POST as run } from "@/app/api/runs/route";
import { POST as demo } from "@/app/api/x/[provider]/[capability]/route";

afterEach(() => { vi.unstubAllEnvs(); vi.mocked(currentMode).mockReturnValue("simulated"); });

describe("simulation isolation", () => {
  it("keeps development simulation available", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(simulationAllowed()).toBe(true);
    expect(() => requireSimulation()).not.toThrow();
  });

  it("disables simulation when live payments are configured, including development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(currentMode).mockReturnValue("live");
    expect(simulationAllowed()).toBe(false);
  });

  it("blocks legacy credit and demo entry points in production even if live config is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(simulationAllowed()).toBe(false);
    expect(() => requireSimulation()).toThrow("Simulation is disabled");
    const req = () => new Request("http://localhost", { method: "POST" });
    for (const response of [await topup(req()), await register(req()), await credit(req()), await fund(req(), { params: Promise.resolve({ id: "agent" }) }), await run(req())]) {
      expect(response.status).toBe(403);
    }
    expect((await demo(req(), { params: Promise.resolve({ provider: "demo", capability: "image.generate" }) })).status).toBe(404);
  });
});
