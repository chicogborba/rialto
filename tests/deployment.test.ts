import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Execute the actual SSH rollout script with a disposable environment and a fake Docker CLI.
const workflow = readFileSync(path.resolve(".github/workflows/deploy.yml"), "utf8");
const rollout = workflow.split("      - name: Back up, switch to the new image, roll back if it is not healthy")[1]
  .split("<<'REMOTE'\n")[1].split("\n          REMOTE")[0]
  .split("\n").map((line) => line.slice(10)).join("\n");

const fakeDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'compose' && args[1] === 'exec') {
  fs.readFileSync(0); // Docker exec forwards stdin; it must not eat the SSH script.
  console.log('backup written');
} else if (args[0] === 'login') {
  fs.readFileSync(0);
} else if (args[0] === 'inspect') {
  console.log(process.env.FAIL_NEW_IMAGE && process.env.IMAGE === 'new-image' ? 'unhealthy' : 'healthy');
} else if (args[0] === 'compose' && args[1] === 'ps') {
  console.log('test-container');
} else if (args[0] === 'compose' && args[1] === 'up') {
  fs.appendFileSync(process.env.ROLLOUT_MARKER, process.env.IMAGE + '\\n');
}
`;

function runRollout(failNewImage = false) {
  const directory = mkdtempSync(path.join(tmpdir(), "rialto-deploy-test-"));
  const bin = path.join(directory, "bin");
  // Keep all commands that could mutate a real service inside this fixture.
  spawnSync("mkdir", [bin]);
  writeFileSync(path.join(bin, "docker"), fakeDocker);
  chmodSync(path.join(bin, "docker"), 0o700);
  writeFileSync(path.join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  // BSD sed has different -i syntax; exercise the Linux workflow through a tiny fixture edit.
  writeFileSync(path.join(bin, "sed"), `#!/usr/bin/env node
const fs = require('node:fs');
const match = process.argv[3].match(/^s\\|\\^IMAGE=\.\\*\\|IMAGE=([^|]+)\\|$/);
if (!match) process.exit(1);
fs.writeFileSync('.env', fs.readFileSync('.env','utf8').replace(/^IMAGE=.*$/m, 'IMAGE=' + match[1]));
`, { mode: 0o700 });
  writeFileSync(path.join(directory, ".env"), "IMAGE=old-image\nPAYMENT_MODE=live\n");
  const marker = path.join(directory, "rollouts");
  const result = spawnSync("bash", ["-s"], {
    input: rollout,
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DIR: directory, IMAGE: "new-image", GHCR_USER: "test-user", GHCR_TOKEN: "test-token", ROLLOUT_MARKER: marker, FAIL_NEW_IMAGE: failNewImage ? "1" : "" },
  });
  try {
    return { result, rollouts: readFileSync(marker, "utf8"), env: readFileSync(path.join(directory, ".env"), "utf8") };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("the production rollout", () => {
  it("continues past backup to start and check the new image", () => {
    const { result, rollouts, env } = runRollout();
    expect(result.status, result.stderr).toBe(0);
    expect(rollouts).toBe("new-image\n");
    expect(result.stdout).toContain("app is healthy on new-image");
    expect(env).toContain("PAYMENT_MODE=live\n");
  });

  it("actually switches Compose back to the old image if the new one fails health checks", () => {
    const { result, rollouts, env } = runRollout(true);
    expect(result.status, result.stderr).toBe(1);
    expect(rollouts).toBe("new-image\nold-image\n");
    expect(result.stdout).toContain("rolled back to old-image");
    expect(env).toContain("IMAGE=old-image\n");
  }, 20_000);
});
