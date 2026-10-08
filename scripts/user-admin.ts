// What the operator can do with accounts, since there is no email to recover a password with.
//
//   npm run user:admin -- list                       who has signed up
//   npm run user:admin -- reset-password <email>     set a new random password (printed once), sign the user out everywhere
//   npm run user:admin -- purge <@domain>            delete the accounts whose email ends with this, with their agents and APIs
//                                                    (e.g. @example.com: what the e2e script leaves behind)
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
  } else if (command === "purge" && arg?.startsWith("@")) {
    const users = await prisma.user.findMany({ where: { email: { endsWith: arg.toLowerCase() } }, select: { id: true, seller: { select: { id: true } } } });
    const ids = users.map((u) => u.id);
    const sellerIds = users.flatMap((u) => (u.seller ? [u.seller.id] : []));
    const providerIds = (await prisma.provider.findMany({ where: { sellerId: { in: sellerIds } }, select: { id: true } })).map((p) => p.id);
    const agentIds = (await prisma.agent.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((a) => a.id);
    // their history goes with them: calls to their APIs, calls by their agents, and the ledger lines of both
    const txIds = (await prisma.transaction.findMany({ where: { OR: [{ providerId: { in: providerIds } }, { agentId: { in: agentIds } }] }, select: { id: true } })).map((t) => t.id);
    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({ where: { OR: [{ transactionId: { in: txIds } }, { agentId: { in: agentIds } }, { sellerId: { in: sellerIds } }, { userId: { in: ids } }] } }),
      prisma.transaction.deleteMany({ where: { id: { in: txIds } } }),
      prisma.run.deleteMany({ where: { agentId: { in: agentIds } } }),
      prisma.provider.deleteMany({ where: { id: { in: providerIds } } }),
      prisma.seller.deleteMany({ where: { id: { in: sellerIds } } }),
      prisma.agent.deleteMany({ where: { id: { in: agentIds } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
    console.log(`Deleted ${ids.length} account(s) ending in ${arg}.`);
  } else {
    console.log("Usage: user:admin list | reset-password <email> | purge <@domain>");
    process.exitCode = 1;
  }
}
main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
