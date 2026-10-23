import test from "node:test";
import assert from "node:assert/strict";
import { createSessionService } from "../sessions.service.js";
import { SessionFailure, type BoardSession, type SessionRepository } from "../sessions.contracts.js";
import { BoardPersistenceLimitError } from "../sessions.persistence.js";

const board = { id: "board-1", title: "Untitled", templateId: "blank", canvas: { gridStyle: "graph-paper" as const, gridSpacing: 22 }, objects: [] };
const createRepository = (seed?: BoardSession): SessionRepository => {
  let session = seed ?? null;
  return {
    create: ({ ownerIdentityId, title, board: snapshot, now }) => {
      session = { id: "507f1f77bcf86cd799439011", ownerIdentityId, title, status: "active", board: snapshot, sequence: 0, createdAt: now, updatedAt: now, endedAt: null };
      return Promise.resolve(session);
    },
    findById: (id) => Promise.resolve(id === session?.id ? session : null),
    findActiveForMember: (identityId) => Promise.resolve(session?.status === "active" && (session.ownerIdentityId === identityId || identityId === "member-1") ? [session] : []),
    rename: (_id, ownerIdentityId, title, now) => {
      if (!session || session.ownerIdentityId !== ownerIdentityId || session.status !== "active") return Promise.resolve(null);
      session = { ...session, title, updatedAt: now };
      return Promise.resolve(session);
    },
    end: (_id, ownerIdentityId, now, expectedSequence) => {
      if (!session || session.ownerIdentityId !== ownerIdentityId || (expectedSequence !== undefined && (session.status !== "active" || session.sequence !== expectedSequence))) return Promise.resolve(null);
      session = { ...session, status: "ended", endedAt: now, updatedAt: now };
      return Promise.resolve(session);
    },
    deleteEndedSession: () => Promise.resolve()
  };
};

void test("session export end compares the downloaded revision before closing", async () => {
  const session = await createRepository().create({ ownerIdentityId: "owner-1", title: "Board", board, now: new Date("2026-10-18T10:00:00Z") });
  const repository = createRepository({ ...session, sequence: 2 });
  const closedRooms: string[] = [];
  const service = createSessionService({ repository, closeSessionConnections: (id) => closedRooms.push(id) });
  await assert.rejects(service.end(session.id, session.ownerIdentityId, 1), (error: unknown) => error instanceof SessionFailure && error.code === "revision_changed");
  assert.deepEqual(closedRooms, []);
  const ended = await service.end(session.id, session.ownerIdentityId, 2);
  assert.equal(ended.status, "ended");
  assert.deepEqual(closedRooms, [session.id]);
});

void test("lists only active server sessions that belong to the verified identity", async () => {
  const session = await createRepository().create({ ownerIdentityId: "owner-1", title: "Board", board, now: new Date("2026-10-18T10:00:00Z") });
  const repository = createRepository(session);
  const service = createSessionService({ repository, now: () => new Date("2026-10-18T10:00:00Z") });
  assert.deepEqual(await service.listMine(session.ownerIdentityId), [session]);
  assert.deepEqual(await service.listMine("member-1"), [session]);
  assert.deepEqual(await service.listMine("unrelated-identity"), []);
});

void test("an active session remains available regardless of elapsed time", async () => {
  const repository = createRepository();
  const createdAt = new Date("2026-10-18T10:00:00Z");
  const session = await repository.create({ ownerIdentityId: "owner-1", title: "Long-running", board, now: createdAt });
  const service = createSessionService({ repository, now: () => new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) });
  assert.equal((await service.get(session.id, session.ownerIdentityId)).status, "active");
  assert.equal((await service.rename(session.id, session.ownerIdentityId, "Still active")).title, "Still active");
  assert.equal((await service.end(session.id, session.ownerIdentityId)).status, "ended");
});

void test("reports an oversized initial board separately from storage failures", async () => {
  const repository = { ...createRepository(), create: () => Promise.reject(new BoardPersistenceLimitError()) };
  const service = createSessionService({ repository });
  await assert.rejects(service.create("owner-1", { title: "Large", board }),
    (error: unknown) => error instanceof SessionFailure && error.code === "board_too_large");
});

void test("creates an active server-owned session and allows only its owner to rename/end it", async () => {
  const repository = createRepository();
  const closedRooms: string[] = [];
  const service = createSessionService({ repository, now: () => new Date("2026-10-18T10:00:00.000Z"), closeSessionConnections: (sessionId) => closedRooms.push(sessionId) });
  const created = await service.create("owner-1", { title: "Demo", board });
  assert.equal(created.status, "active");
  assert.equal(created.ownerIdentityId, "owner-1");
  await assert.rejects(() => service.rename(created.id, "other-owner", "Taken"), SessionFailure);
  const renamed = await service.rename(created.id, "owner-1", "Updated demo");
  assert.equal(renamed.title, "Updated demo");
  const ended = await service.end(created.id, "owner-1");
  assert.equal(ended.status, "ended");
  assert.deepEqual(closedRooms, [created.id]);
  await assert.rejects(() => service.rename(created.id, "owner-1", "After end"), SessionFailure);
});

void test("session end keeps an inaccessible ended record and retries cleanup in order", async () => {
  const events: string[] = [];
  const baseRepository = createRepository();
  const repository: SessionRepository = { ...baseRepository, deleteEndedSession: () => { events.push("records"); return Promise.resolve(); } };
  let invitationCleanupAttempts = 0;
  const session = await repository.create({ ownerIdentityId: "owner-1", title: "Board", board, now: new Date("2026-10-18T10:00:00Z") });
  const service = createSessionService({
    repository,
    closeSessionConnections: () => events.push("close"),
    deleteSessionInvitations: () => {
      events.push("invitations");
      invitationCleanupAttempts += 1;
      return invitationCleanupAttempts === 1 ? Promise.reject(new Error("temporary DB failure")) : Promise.resolve();
    },
  });

  await assert.rejects(service.end(session.id, session.ownerIdentityId), SessionFailure);
  await assert.rejects(service.get(session.id, session.ownerIdentityId), (error: unknown) => error instanceof SessionFailure && error.code === "not_found");
  assert.deepEqual(events, ["close", "invitations"]);
  await service.end(session.id, session.ownerIdentityId);
  assert.deepEqual(events, ["close", "invitations", "close", "invitations", "records"]);
});
