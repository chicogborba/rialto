import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

/** A real inbox's plus aliases for deployed checks; local previews need no inbox. */
export function e2eEmail(role: string, run: string): string {
  const mailbox = process.env.E2E_EMAIL?.trim();
  if (!mailbox) return `${role}-${run}@example.com`;
  const at = mailbox.lastIndexOf("@");
  if (at < 1) throw new Error("E2E_EMAIL must be an email address you can read.");
  return `${mailbox.slice(0, at)}+rialto-${role}-${run}${mailbox.slice(at)}`;
}

export function checkEmailTestSetup(base: string): void {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname) && !process.env.E2E_EMAIL) throw new Error("Deployed account tests require E2E_EMAIL=your-inbox@example.com (with plus-alias support). Codes will be requested interactively. Local tests can use EMAIL_TRANSPORT=preview.");
}

export async function readEmailCode(email: string): Promise<string> {
  if (process.env.E2E_EMAIL) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const code = (await prompt.question(`Enter the six-digit code sent to ${email}: `)).trim();
      if (!/^\d{6}$/.test(code)) throw new Error("Expected a six-digit email code.");
      return code;
    } finally {
      prompt.close();
    }
  }
  const directory = path.resolve(process.env.EMAIL_PREVIEW_DIR || ".local/emails");
  const messages = existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")) as { to: string; text: string; createdAt: string }) : [];
  const latest = messages.filter((message) => message.to.toLowerCase() === email.toLowerCase()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const code = latest?.text.match(/\n\n(\d{6})\n\n/)?.[1];
  if (!code) throw new Error("No local email code found. Run the development server with EMAIL_TRANSPORT=preview, or set E2E_EMAIL to a real inbox for an interactive check.");
  return code;
}
