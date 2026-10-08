// Writes a consistent copy of the SQLite database next to it, in backups/, and keeps the last 14.
// Safe while the server is running (VACUUM INTO takes a snapshot).
//
//   npm run db:backup
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const KEEP = 14;
const url = process.env.DATABASE_URL ?? "file:./dev.db";
// Prisma resolves a relative SQLite path from the schema's directory
const file = path.resolve("prisma", url.replace(/^file:/, ""));
const dir = path.join(path.dirname(file), "backups");
mkdirSync(dir, { recursive: true });
const target = path.join(dir, `rialto-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);

const prisma = new PrismaClient();
prisma
  .$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  .then(() => {
    const old = readdirSync(dir).filter((f) => f.startsWith("rialto-") && f.endsWith(".db")).sort().slice(0, -KEEP);
    for (const f of old) rmSync(path.join(dir, f));
    console.log(`backup written: ${target}`);
  })
  .finally(() => prisma.$disconnect());
