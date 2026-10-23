import { SessionFailure } from "./sessions.contracts.js";
import type { ActiveBoardSession, BoardSession, SessionRepository } from "./sessions.contracts.js";
import type { CreateSessionInput } from "./sessions.validation.js";
import { BoardPersistenceLimitError } from "./sessions.persistence.js";

type SessionServiceDependencies = Readonly<{
  repository: SessionRepository;
  hasMembership?: (sessionId: string, identityId: string) => Promise<boolean>;
  closeSessionConnections?: (sessionId: string) => void;
  deleteSessionInvitations?: (sessionId: string) => Promise<void>;
  onCleanupFailure?: (sessionId: string, stage: "invitations" | "session_records") => void;
  now?: () => Date;
}>;
export type SessionService = Readonly<{
  create: (ownerIdentityId: string, input: CreateSessionInput) => Promise<BoardSession>;
  get: (sessionId: string, identityId: string) => Promise<BoardSession>;
  listMine: (identityId: string) => Promise<readonly ActiveBoardSession[]>;
  rename: (sessionId: string, identityId: string, title: string) => Promise<BoardSession>;
  end: (sessionId: string, identityId: string, expectedSequence?: number) => Promise<BoardSession>;
}>;

export const createSessionService = ({ repository, hasMembership = () => Promise.resolve(false), closeSessionConnections = () => undefined, deleteSessionInvitations = () => Promise.resolve(), onCleanupFailure = () => undefined, now = () => new Date() }: SessionServiceDependencies): SessionService => {
  const findSession = async (sessionId: string): Promise<BoardSession | null> => {
    let session: BoardSession | null;
    try { session = await repository.findById(sessionId); }
    catch { throw new SessionFailure("storage_unavailable"); }
    return session;
  };
  const requireOwner = async (sessionId: string, identityId: string): Promise<BoardSession> => {
    const session = await findSession(sessionId);
    if (!session || session.ownerIdentityId !== identityId) throw new SessionFailure("not_found");
    return session;
  };
  return Object.freeze({
    create: async (ownerIdentityId, input) => {
      try { return await repository.create({ ...input, ownerIdentityId, now: now() }); }
      catch (error) { throw new SessionFailure(error instanceof BoardPersistenceLimitError ? "board_too_large" : "storage_unavailable"); }
    },
    get: async (sessionId, identityId) => {
      const session = await findSession(sessionId);
      if (!session || session.status !== "active" || (session.ownerIdentityId !== identityId && !await hasMembership(sessionId, identityId))) throw new SessionFailure("not_found");
      return session;
    },
    listMine: async (identityId) => {
      try { return await repository.findActiveForMember(identityId); }
      catch { throw new SessionFailure("storage_unavailable"); }
    },
    rename: async (sessionId, identityId, title) => {
      const current = await requireOwner(sessionId, identityId);
      if (current.status !== "active") throw new SessionFailure("not_found");
      try {
        const updated = await repository.rename(sessionId, identityId, title, now());
        if (!updated) throw new SessionFailure("not_found");
        return updated;
      } catch (error) { if (error instanceof SessionFailure) throw error; throw new SessionFailure("storage_unavailable"); }
    },
    end: async (sessionId, identityId, expectedSequence) => {
      await requireOwner(sessionId, identityId);
      let ended: BoardSession;
      try {
        const session = await repository.end(sessionId, identityId, now(), expectedSequence);
        if (!session) {
          if (expectedSequence !== undefined) {
            const latest = await findSession(sessionId);
            if (latest?.status === "active" && latest.sequence !== expectedSequence) throw new SessionFailure("revision_changed");
          }
          throw new SessionFailure("not_found");
        }
        ended = session;
      } catch (error) { if (error instanceof SessionFailure) throw error; throw new SessionFailure("storage_unavailable"); }
      closeSessionConnections(sessionId);
      try {
        await deleteSessionInvitations(sessionId);
      } catch {
        onCleanupFailure(sessionId, "invitations");
        throw new SessionFailure("storage_unavailable");
      }
      try {
        await repository.deleteEndedSession(sessionId, identityId);
      } catch {
        onCleanupFailure(sessionId, "session_records");
        throw new SessionFailure("storage_unavailable");
      }
      return ended;
    }
  });
};
