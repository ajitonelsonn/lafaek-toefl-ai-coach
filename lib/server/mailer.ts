import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, requireEnv } from "./env";
import { ApiError } from "./http";
import { errorSummary, log } from "./log";

// Email adapter. Gmail SMTP has daily sending limits (about 500/day for a
// personal account); swap the transport for a transactional provider later
// without changing the auth logic.

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (transporter) return transporter;
  const e = requireEnv("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM");
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: env().SMTP_PORT,
    secure: env().SMTP_SECURE,
    requireTLS: !env().SMTP_SECURE,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

async function send(to: string, subject: string, text: string, html: string) {
  try {
    await transport().sendMail({ from: `LafaekTOEFL AI Coach <${env().SMTP_FROM}>`, to, subject, text, html });
  } catch (err) {
    // Never log the message body (it may contain a code).
    log.error("email delivery failed", { subject, error: errorSummary(err) });
    throw new ApiError(503, "EMAIL_DELIVERY_FAILED", "We couldn't send the email right now. Please try again in a few minutes.");
  }
}

const wrap = (inner: string) => `<!doctype html><html><body style="margin:0;background:#f5f8ff;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #dce4ef;border-radius:14px">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:bold;color:#101b4d">Lafaek<span style="color:#1769f5">TOEFL</span> <span style="font-size:12px;letter-spacing:2px;color:#64748b">AI COACH</span></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6">${inner}</td></tr></table>
<p style="font-size:12px;color:#64748b;margin-top:16px">You received this email because someone used this address on LafaekTOEFL AI Coach.</p>
</td></tr></table></body></html>`;

export async function sendOtpEmail(to: string, code: string, minutes: number) {
  const text = `Your LafaekTOEFL verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you did not request this, you can ignore this email.`;
  const html = wrap(
    `<p>Use this code to verify your email:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#101b4d;margin:16px 0">${code}</p>
<p>The code expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>`,
  );
  await send(to, "Your LafaekTOEFL verification code", text, html);
}

export async function sendExistingAccountEmail(to: string) {
  const url = `${env().APP_URL}/login`;
  const text = `Someone tried to create a LafaekTOEFL account with this email, but you already have one.\n\nLog in here: ${url}\n\nIf this wasn't you, you can ignore this email.`;
  const html = wrap(
    `<p>Someone tried to create a LafaekTOEFL account with this email, but you already have one.</p>
<p><a href="${url}" style="color:#1769f5;font-weight:bold">Log in to LafaekTOEFL</a></p>
<p>If this wasn't you, you can ignore this email.</p>`,
  );
  await send(to, "You already have a LafaekTOEFL account", text, html);
}
