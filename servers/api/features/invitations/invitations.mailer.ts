import type { InvitationMailer } from "../identity/public.js";

const htmlEscapeMap: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => htmlEscapeMap[character] ?? character);

export const createInvitationMailer = (sendEmail: (ownerIdentityId: string, email: Readonly<{ recipient: string; subject: string; html: string; text: string }>) => Promise<void>): InvitationMailer => Object.freeze({
  sendInvitation: async ({ ownerIdentityId, recipient, invitationUrl, sessionTitle, expiresAt }) => {
    const escapedTitle = escapeHtml(sessionTitle);
    const escapedInvitationUrl = escapeHtml(invitationUrl);
    const expiry = `${expiresAt.toISOString()} UTC`;

    await sendEmail(ownerIdentityId, {
      recipient,
      subject: `You're invited to collaborate on "${sessionTitle}" (Orbito)`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;color:#1e293b;"><h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">Live Whiteboard Collaboration</h2><p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">You have been invited to join the live whiteboard session: <strong>${escapedTitle}</strong>.</p><div style="margin:24px 0;"><a href="${escapedInvitationUrl}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Accept Invitation &amp; Join Session &rarr;</a></div><p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.5;">This invitation link is valid for 10 minutes (expires ${expiry}) and can only be accepted by <strong>${escapeHtml(recipient)}</strong>.</p><p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">If you were not expecting this invitation, you can safely ignore this email.</p></div>`,
      text: `You have been invited to collaborate on "${sessionTitle}".\n\nAccept Invitation: ${invitationUrl}\n\nThis invitation link expires at ${expiry} and can only be accepted by ${recipient}.\n\nIf you were not expecting this invitation, you can ignore this email.`
    });
  }
});
