// What a server runs on every start, after the schema is in place: seed an empty database, and
// make sure first-party integrations exist and are paid at the current SOLANA_PAY_TO.
// Existing user-owned marketplace data is left untouched.
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ensureBuiltInIntegrations, ensurePokedex, seedDatabase } from "../lib/db/seed";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();

async function main(): Promise<void> {
  if ((await prisma.provider.count()) === 0) {
    await seedDatabase(prisma);
    console.log("database was empty: seeded");
  } else {
    const [{ created }, integrations] = await Promise.all([ensurePokedex(prisma), ensureBuiltInIntegrations(prisma)]);
    console.log(`database kept as it is${created ? "; added the PokéDex test seller" : ""}${integrations.length ? `; refreshed ${integrations.join(", ")}` : ""}`);
  }
}
main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
