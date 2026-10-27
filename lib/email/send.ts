import { HttpError } from "@/lib/http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Fail closed: never create an account or claim delivery without a configured sender. */
export function emailConfig(): { transport: "resend"; apiKey: string; from: string } | { transport: "preview"; directory: string } {
  if (process.env.EMAIL_TRANSPORT === "preview") {
    if (process.env.NODE_ENV !== "development") throw new HttpError(503, "email_unavailable", "Email delivery is not configured yet. Please try again later.");
    return { transport: "preview", directory: path.resolve(/* turbopackIgnore: true */ process.env.EMAIL_PREVIEW_DIR || ".local/emails") };
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new HttpError(503, "email_unavailable", "Email delivery is not configured yet. Please try again later.");
  return { transport: "resend", apiKey, from };
}

/** Resend's HTTP API keeps this sending-only integration free of SDK dependencies. */
export async function sendEmail(message: EmailMessage, idempotencyKey: string): Promise<void> {
  const config = emailConfig();
  if (config.transport === "preview") {
    // Explicit local development only. Never expose codes through an HTTP endpoint or logs.
    await mkdir(config.directory, { recursive: true, mode: 0o700 });
    const filename = createHash("sha256").update(idempotencyKey).digest("hex");
    await writeFile(path.join(config.directory, `${filename}.json`), JSON.stringify({ ...message, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    return;
  }
  const { apiKey, from } = config;
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(503, "email_unavailable", "We could not send the email. Please try again in a minute.");
  }
  if (!response.ok) {
    // Provider bodies can contain addresses or request data. Log only the status.
    console.error(`[email] Resend returned HTTP ${response.status}`);
    throw new HttpError(503, "email_unavailable", "We could not send the email. Please try again in a minute.");
  }
}
