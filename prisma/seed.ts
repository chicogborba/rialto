import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/db/seed";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(async () => {
    console.log("seeded");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
