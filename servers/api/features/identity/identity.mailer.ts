import type { EmailSender } from "../../integrations/email/index.js";
import type { IdentityMailer } from "./identity.contracts.js";

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export const createIdentityMailer = (sendEmail: EmailSender): IdentityMailer => Object.freeze({
  sendMagicLink: async ({ recipient, verificationUrl, expiresAt }) => {
    const escapedUrl = escapeHtml(verificationUrl);
    const expiry = `${expiresAt.toISOString()} UTC`;

    await sendEmail({
      recipient,
      subject: "Your Whiteboard sign-in link",
      html: `<div style="font-family:Arial,sans-serif;color:#17263d;line-height:1.6"><h1 style="font-size:22px">Sign in to Whiteboard</h1><p>Use this secure link to verify your email and sign in.</p><p><a href="${escapedUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#2f68d8;color:#ffffff;text-decoration:none;font-weight:600">Sign in to Whiteboard</a></p><p>This one-time link expires at ${expiry}. If you didn't request it, you can ignore this email.</p></div>`,
      text: `Sign in to Whiteboard using this one-time link: ${verificationUrl}\n\nIt expires at ${expiry}. If you didn't request it, you can ignore this email.`
    });
  }
});
