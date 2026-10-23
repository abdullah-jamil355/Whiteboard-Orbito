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
      subject: `You're invited to ${sessionTitle}`,
      html: `<div style="font-family:Arial,sans-serif;color:#17263d;line-height:1.6"><h1 style="font-size:22px">Whiteboard session invitation</h1><p>You've been invited to join <strong>${escapedTitle}</strong>.</p><p><a href="${escapedInvitationUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#2f68d8;color:#ffffff;text-decoration:none;font-weight:600">Accept invitation</a></p><p>This private link expires at ${expiry}. It can only be accepted by the invited email address.</p><p>If you weren't expecting this invitation, you can ignore this email.</p></div>`,
      text: `You've been invited to join ${sessionTitle}.\n\nAccept invitation: ${invitationUrl}\n\nThis private link expires at ${expiry} and can only be accepted by the invited email address. If you weren't expecting this invitation, you can ignore this email.`
    });
  }
});
