import { randomUUID } from "node:crypto";
import { normalizeEmail } from "./identity.rules.js";
import type { IdentityMailer, InvitationEmail, InvitationMailer, MagicLinkEmail } from "./identity.contracts.js";

export type DevMailboxMessage = Readonly<(
  | (MagicLinkEmail & { kind: "sign-in" })
  | (InvitationEmail & { kind: "invitation" })
) & {
  id: string;
  createdAt: Date;
}>;

export type DevMailbox = Readonly<{
  mailer: IdentityMailer;
  invitationMailer: InvitationMailer;
  listFor: (email: string) => readonly DevMailboxMessage[];
}>;

export const createDevMailbox = (): DevMailbox => {
  const messages: DevMailboxMessage[] = [];
  const mailer: IdentityMailer = Object.freeze({
    sendMagicLink: (message) => {
      messages.push(Object.freeze({ ...message, kind: "sign-in", recipient: normalizeEmail(message.recipient), id: randomUUID(), createdAt: new Date() }));
      return Promise.resolve();
    }
  });
  const invitationMailer: InvitationMailer = Object.freeze({
    sendInvitation: (message) => {
      messages.push(Object.freeze({ ...message, kind: "invitation", recipient: normalizeEmail(message.recipient), id: randomUUID(), createdAt: new Date() }));
      return Promise.resolve();
    }
  });
  return Object.freeze({
    mailer,
    invitationMailer,
    listFor: (email: string) => Object.freeze(messages.filter((message) => message.recipient === normalizeEmail(email)))
  });
};
