import type { EmailMessage } from "./send";

export type EmailPurpose = "signup" | "password_reset";

/** No tracking pixels or reset secrets in URLs; the code is entered back on Rialto. */
export function codeEmail(to: string, code: string, purpose: EmailPurpose): EmailMessage {
  const signup = purpose === "signup";
  const title = signup ? "Confirm your email" : "Reset your password";
  const instruction = signup ? "Enter this code on Rialto to finish creating your account." : "Enter this code on Rialto to choose a new password.";
  const text = `${title}\n\n${instruction}\n\n${code}\n\nThis code expires in 10 minutes. Never share it with anyone.\n\nIf you did not request this, you can ignore this email.\n\nRialto · galleriarialto.com`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f4f0e6;color:#17120f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#fffdf7;border:2px solid #17120f"><tr><td style="padding:32px"><p style="margin:0 0 28px;font-size:22px;font-weight:800;letter-spacing:2px">RIALTO<span style="color:#f08a3c">.</span></p><h1 style="font-size:28px;letter-spacing:-1px">${title}</h1><p style="line-height:1.6">${instruction}</p><p style="padding:20px 12px;background:#c8ff3d;border:2px solid #17120f;text-align:center;font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px">${code}</p><p style="font-size:14px;line-height:1.6">This code expires in 10 minutes. Never share it with anyone.</p><p style="margin-top:28px;font-size:13px;color:#655e55;line-height:1.6">If you did not request this, you can ignore this email.</p><p style="margin:28px 0 0;font-size:12px;color:#655e55">Rialto · galleriarialto.com</p></td></tr></table></td></tr></table></body></html>`;
  return { to, subject: signup ? "Confirm your Rialto email" : "Reset your Rialto password", text, html };
}
