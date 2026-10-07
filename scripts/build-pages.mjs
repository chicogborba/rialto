// Builds the GitHub Pages site: a static export of the landing page only.
//
// The full app has API routes and a database, which a static host can't run. This script temporarily
// moves those routes aside, runs `next build` in export mode and puts everything back (even on failure),
// so you can run it locally without touching your working tree. Output: ./out
//
//   NEXT_PUBLIC_BASE_PATH=/rialto node scripts/build-pages.mjs     (GitHub project site)
//   node scripts/build-pages.mjs                                    (served from a domain root)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const stash = path.join(root, ".pages-stash");
const MOVE = ["app/api", "app/app", "app/connect", "app/publish"];
const moved = [];

function restore() {
  for (const rel of moved.splice(0).reverse()) {
    renameSync(path.join(stash, rel.replaceAll("/", "__")), path.join(root, rel));
  }
  rmSync(stash, { recursive: true, force: true });
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(); process.exit(1); });

let status = 1;
try {
  mkdirSync(stash, { recursive: true });
  for (const rel of MOVE) {
    if (!existsSync(path.join(root, rel))) continue;
    renameSync(path.join(root, rel), path.join(stash, rel.replaceAll("/", "__")));
    moved.push(rel);
  }
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
  rmSync(path.join(root, "out"), { recursive: true, force: true });
  const res = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_STATIC: "1" },
  });
  status = res.status ?? 1;
  if (status === 0) {
    writeFileSync(path.join(root, "out", ".nojekyll"), "");
    // Pages serves 404.html for unknown paths
    if (existsSync(path.join(root, "out", "404", "index.html"))) cpSync(path.join(root, "out", "404", "index.html"), path.join(root, "out", "404.html"));
  }
} finally {
  restore();
  rmSync(path.join(root, ".next"), { recursive: true, force: true }); // static build artefacts: dev server regenerates
}
process.exit(status);
