// What a server runs on every start, after the schema is in place: seed an empty database, and
// make sure the PokéDex test seller exists and is paid at the current SOLANA_PAY_TO.
// Never touches a database that already has data.
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ensurePokedex, seedDatabase } from "../lib/db/seed";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();

async function main(): Promise<void> {
  if ((await prisma.provider.count()) === 0) {
    await seedDatabase(prisma);
    console.log("database was empty: seeded");
  } else {
    const { created } = await ensurePokedex(prisma);
    console.log(`database kept as it is${created ? "; added the PokéDex test seller" : ""}`);
  }
}
main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
