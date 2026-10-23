import type { Request, Response } from "express";
import { z } from "zod";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../../constants/index.js";
import type { IdentityService } from "../identity/public.js";
import { readIdentitySessionToken } from "../identity/public.js";
import type { InvitationService } from "./invitations.service.js";
import { InvitationFailure } from "./invitations.contracts.js";
import { acceptInvitationSchema, createInvitationSchema } from "./invitations.validation.js";

const idSchema = z.string().regex(/^[\da-f]{24}$/i);
type Dependencies = Readonly<{ identity: IdentityService | null; invitations: InvitationService | null }>;
const failure = (response: Response, error: unknown): void => {
  if (!(error instanceof InvitationFailure)) { response.status(HTTP_STATUS.serviceUnavailable).json({ error: { code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable } }); return; }
  const mapping = {
    not_found: [HTTP_STATUS.notFound, ERROR_CODES.sessionNotFound, ERROR_MESSAGES.sessionNotFound],
    invalid_or_expired: [HTTP_STATUS.badRequest, ERROR_CODES.invalidMagicLink, "This invitation is invalid, expired, or already used."],
    email_mismatch: [403, ERROR_CODES.authenticationRequired, "Sign in using the email address this invitation was sent to."],
    already_member: [409, ERROR_CODES.validation, "This identity is already a session participant."],
    session_full: [409, ERROR_CODES.validation, "This session is full. It can have up to 25 members including the owner."],
    rate_limited: [HTTP_STATUS.tooManyRequests, ERROR_CODES.rateLimited, "Too many invitation attempts. Try again after the rate-limit window."],
    storage_unavailable: [HTTP_STATUS.serviceUnavailable, ERROR_CODES.serviceUnavailable, ERROR_MESSAGES.serviceUnavailable],
    delivery_unavailable: [HTTP_STATUS.serviceUnavailable, ERROR_CODES.serviceUnavailable, "Invitation email could not be sent. Connect or reconnect Gmail from the Whiteboard sidebar, then try again."]
  } as const;
  const [status, code, message] = mapping[error.code];
  if (error.code === "rate_limited") response.setHeader("Retry-After", "900");
  response.status(status).json({ error: { code, message } });
};
export const createInvitationController = ({ identity, invitations }: Dependencies) => {
  const authenticated = async (request: Request, response: Response): Promise<Readonly<{ id: string; email: string }> | null> => {
    if (!identity || !invitations) { response.status(HTTP_STATUS.serviceUnavailable).json({ error: { code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable } }); return null; }
    try {
      const current = await identity.getIdentityForSession(readIdentitySessionToken(request));
      if (!current) response.status(HTTP_STATUS.unauthorized).json({ error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired } });
      return current;
    } catch { response.status(HTTP_STATUS.serviceUnavailable).json({ error: { code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable } }); return null; }
  };
  return Object.freeze({
    create: async (request: Request, response: Response): Promise<void> => {
      const sessionId = idSchema.safeParse(request.params.sessionId);
      const input = createInvitationSchema.safeParse(request.body);
      if (!sessionId.success || !input.success) { response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation } }); return; }
      const current = await authenticated(request, response); if (!current) return;
      try { await invitations?.create(sessionId.data, current.id, input.data.email, request.ip ?? "unknown", input.data.role); response.setHeader("Cache-Control", "no-store"); response.status(HTTP_STATUS.accepted).json({ message: "Invitation sent if delivery is configured." }); }
      catch (error) { failure(response, error); }
    },
    list: async (request: Request, response: Response): Promise<void> => {
      const sessionId = idSchema.safeParse(request.params.sessionId); if (!sessionId.success) { response.sendStatus(HTTP_STATUS.notFound); return; }
      const current = await authenticated(request, response); if (!current) return;
      try { const pending = await invitations?.list(sessionId.data, current.id); response.setHeader("Cache-Control", "no-store"); response.status(HTTP_STATUS.ok).json({ invitations: pending?.map(({ id, email, role, createdAt, expiresAt }) => ({ id, email, role, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() })) ?? [] }); }
      catch (error) { failure(response, error); }
    },
    cancel: async (request: Request, response: Response): Promise<void> => {
      const sessionId = idSchema.safeParse(request.params.sessionId); const invitationId = idSchema.safeParse(request.params.invitationId);
      if (!sessionId.success || !invitationId.success) { response.sendStatus(HTTP_STATUS.notFound); return; }
      const current = await authenticated(request, response); if (!current) return;
      try { await invitations?.cancel(sessionId.data, current.id, invitationId.data); response.sendStatus(HTTP_STATUS.noContent); }
      catch (error) { failure(response, error); }
    },
    listMembers: async (request: Request, response: Response): Promise<void> => {
      const sessionId = idSchema.safeParse(request.params.sessionId);
      if (!sessionId.success) { response.sendStatus(HTTP_STATUS.notFound); return; }
      const current = await authenticated(request, response); if (!current) return;
      try {
        const members = await invitations?.listMembers(sessionId.data, current.id);
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ members: members?.map(({ identityId, email, role, displayName, connected }) => ({ identityId, email, role, displayName, connected })) ?? [] });
      } catch (error) { failure(response, error); }
    },
    removeMember: async (request: Request, response: Response): Promise<void> => {
      const sessionId = idSchema.safeParse(request.params.sessionId);
      const identityId = idSchema.safeParse(request.params.identityId);
      if (!sessionId.success || !identityId.success) { response.sendStatus(HTTP_STATUS.notFound); return; }
      const current = await authenticated(request, response); if (!current) return;
      try { await invitations?.removeMember(sessionId.data, current.id, identityId.data); response.sendStatus(HTTP_STATUS.noContent); }
      catch (error) { failure(response, error); }
    },
    accept: async (request: Request, response: Response): Promise<void> => {
      const input = acceptInvitationSchema.safeParse(request.body);
      if (!input.success) {
        const fields = [...new Set(input.error.issues.flatMap(({ path }) => typeof path[0] === "string" ? [path[0]] : []))];
        const message = fields.length > 0
          ? `Invitation request has invalid fields: ${fields.join(", ")}.`
          : ERROR_MESSAGES.validation;
        response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message } });
        return;
      }
      const current = await authenticated(request, response); if (!current) return;
      try { const result = await invitations?.accept(input.data.token, current, input.data.displayName, request.ip ?? "unknown"); response.setHeader("Cache-Control", "no-store"); response.status(HTTP_STATUS.ok).json({ membership: result }); }
      catch (error) { failure(response, error); }
    }
  });
};
