import type { Request, Response } from "express";
import { z } from "zod";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../../constants/index.js";
import type { IdentityService } from "../identity/public.js";
import { readIdentitySessionToken } from "../identity/public.js";
import { SessionFailure } from "./sessions.contracts.js";
import type { SessionService } from "./sessions.service.js";
import { createSessionSchema, endSessionSchema, renameSessionSchema } from "./sessions.validation.js";

const sessionIdSchema = z.string().regex(/^[\da-f]{24}$/i);
type SessionControllerDependencies = Readonly<{ identity: IdentityService | null; sessions: SessionService | null }>;

const publicSession = (session: Awaited<ReturnType<SessionService["create"]>>) => ({
  id: session.id, ownerIdentityId: session.ownerIdentityId, title: session.title,
  status: session.status, board: session.board, sequence: session.sequence, createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null
});

export const createSessionController = ({ identity, sessions }: SessionControllerDependencies) => {
  const sessionService = sessions;
  const unavailable = (response: Response): void => {
    response.status(HTTP_STATUS.serviceUnavailable).json({ error: { code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable } });
  };
  const withIdentity = async (request: Request, response: Response, action: (identityId: string) => Promise<void>): Promise<void> => {
    if (!identity || !sessions) { unavailable(response); return; }
    try {
      const current = await identity.getIdentityForSession(readIdentitySessionToken(request));
      if (!current) {
        response.status(HTTP_STATUS.unauthorized).json({ error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired } });
        return;
      }
      await action(current.id);
    } catch (error) {
      if (error instanceof SessionFailure) {
        const notFound = error.code === "not_found";
        const revisionChanged = error.code === "revision_changed";
        const boardTooLarge = error.code === "board_too_large";
        response.status(notFound ? HTTP_STATUS.notFound : revisionChanged ? HTTP_STATUS.conflict : boardTooLarge ? HTTP_STATUS.payloadTooLarge : HTTP_STATUS.serviceUnavailable).json({
          error: { code: notFound ? ERROR_CODES.sessionNotFound : revisionChanged ? "session_revision_changed" : boardTooLarge ? ERROR_CODES.boardTooLarge : ERROR_CODES.serviceUnavailable, message: notFound ? ERROR_MESSAGES.sessionNotFound : revisionChanged ? "New board changes arrived during export. Download the latest board before ending the session." : boardTooLarge ? ERROR_MESSAGES.boardTooLarge : ERROR_MESSAGES.serviceUnavailable }
        });
        return;
      }
      unavailable(response);
    }
  };
  return Object.freeze({
    create: async (request: Request, response: Response): Promise<void> => {
      const input = createSessionSchema.safeParse(request.body);
      if (!input.success) { response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation } }); return; }
      await withIdentity(request, response, async (identityId) => {
        const session = await sessions?.create(identityId, input.data);
        if (!session) { unavailable(response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.created).json({ session: publicSession(session) });
      });
    },
    get: async (request: Request, response: Response): Promise<void> => {
      const parsed = sessionIdSchema.safeParse(request.params.sessionId);
      if (!parsed.success) { response.status(HTTP_STATUS.notFound).json({ error: { code: ERROR_CODES.sessionNotFound, message: ERROR_MESSAGES.sessionNotFound } }); return; }
      await withIdentity(request, response, async (identityId) => {
        const session = await sessions?.get(parsed.data, identityId);
        if (!session) { unavailable(response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ session: publicSession(session) });
      });
    },
    listMine: async (request: Request, response: Response): Promise<void> => {
      await withIdentity(request, response, async (identityId) => {
        const memberSessions = await sessionService?.listMine(identityId);
        if (!memberSessions) { unavailable(response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ sessions: memberSessions.map((session) => ({
          id: session.id, title: session.title, sequence: session.sequence,
          updatedAt: session.updatedAt.toISOString()
        })) });
      });
    },
    rename: async (request: Request, response: Response): Promise<void> => {
      const parsed = sessionIdSchema.safeParse(request.params.sessionId);
      const input = renameSessionSchema.safeParse(request.body);
      if (!parsed.success || !input.success) { response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation } }); return; }
      await withIdentity(request, response, async (identityId) => {
        const session = await sessions?.rename(parsed.data, identityId, input.data.title);
        if (!session) { unavailable(response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ session: publicSession(session) });
      });
    },
    end: async (request: Request, response: Response): Promise<void> => {
      const parsed = sessionIdSchema.safeParse(request.params.sessionId);
      const input = endSessionSchema.safeParse(request.body ?? {});
      if (!parsed.success || !input.success) { response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation } }); return; }
      await withIdentity(request, response, async (identityId) => {
        const session = await sessions?.end(parsed.data, identityId, input.data.expectedSequence);
        if (!session) { unavailable(response); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ session: publicSession(session) });
      });
    }
  });
};
