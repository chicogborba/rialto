// Adds the PokéDex test seller (the public PokéAPI behind the gateway) to an existing database
// without touching anything else, or re-points it at the current SOLANA_PAY_TO.
//
//   npm run seed:pokedex
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ensurePokedex, POKEDEX } from "../lib/db/seed";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
ensurePokedex(prisma)
  .then(({ created, payTo }) => console.log(`${POKEDEX.name}: ${created ? "created" : "updated"}, paid to ${payTo}`))
  .finally(() => prisma.$disconnect());
