import { IdentityServiceFailure } from "./identity.contracts.js";
import type { IdentityMailer, InvitationMailer } from "./identity.contracts.js";

export const unavailableIdentityMailer: IdentityMailer = Object.freeze({
  sendMagicLink: () => Promise.reject(new IdentityServiceFailure("delivery_unavailable"))
});

export const unavailableInvitationMailer: InvitationMailer = Object.freeze({
  sendInvitation: () => Promise.reject(new IdentityServiceFailure("delivery_unavailable"))
});
