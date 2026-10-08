// What the operator can do with accounts, since there is no email to recover a password with.
//
//   npm run user:admin -- list                       who has signed up
//   npm run user:admin -- reset-password <email>     set a new random password (printed once), sign the user out everywhere
//
// On the server: docker compose exec app npm run -s user:admin -- list
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../lib/auth/password";

if (existsSync(".env")) process.loadEnvFile(".env");
const prisma = new PrismaClient();
const [command, arg] = process.argv.slice(2);

async function main(): Promise<void> {
  if (command === "list") {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { agents: true } }, seller: { select: { providers: { select: { id: true } } } } } });
    for (const u of users) {
      console.log(`${u.createdAt.toISOString().slice(0, 16)}  ${u.email.padEnd(34)} ${(u.walletAddress ? (u.walletVerifiedAt ? "wallet ✓" : "wallet") : "no wallet").padEnd(10)} agents ${u._count.agents}  apis ${u.seller?.providers.length ?? 0}  balance $${(u.balanceMicro / 1e6).toFixed(3)}`);
    }
    console.log(`${users.length} account(s)`);
  } else if (command === "reset-password" && arg) {
    const email = normalizeEmail(arg);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No account with ${email}`);
    // four short random words' worth of entropy, easy to read out
    const next = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
    await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }), prisma.session.deleteMany({ where: { userId: user.id } })]);
    console.log(`New password for ${email}: ${next}\nThey are signed out everywhere. Ask them to change it after signing in.`);
  } else {
    console.log("Usage: user:admin list | reset-password <email>");
    process.exitCode = 1;
  }
}
main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
