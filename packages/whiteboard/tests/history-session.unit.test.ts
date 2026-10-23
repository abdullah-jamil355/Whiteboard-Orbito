import assert from "node:assert/strict";
import test from "node:test";
import { createBoard, renameBoard } from "../src/board/board.js";
import { applyBoardHistorySnapshot, createBoardHistoryEdit } from "../src/board/history.js";
import { createBoardSession, isBoardSessionOwner, renameBoardSession } from "../src/board/session.js";
import { shapeObject } from "./fixtures.js";

void test("creates reversible history edits for additions, changes, removals, order and title", () => {
  const before = { ...createBoard("board"), objects: [shapeObject("a", 0, 0, 40, 30), shapeObject("b", 50, 0, 40, 30)] };
  const after = { ...renameBoard(before, "Changed"), objects: [shapeObject("b", 50, 0, 40, 30), shapeObject("c", 100, 0, 40, 30)] };
  const edit = createBoardHistoryEdit(before, after);
  assert.ok(edit);
  assert.equal(edit.beforeTitle, "Untitled");
  assert.equal(edit.afterTitle, "Changed");
  assert.deepEqual(applyBoardHistorySnapshot(after, edit, "before"), before);
  assert.deepEqual(applyBoardHistorySnapshot(before, edit, "after"), after);
  assert.equal(createBoardHistoryEdit(before, before), null);
});

void test("creates sessions with cloned boards and limits rename to the active owner", () => {
  const board = { ...createBoard("board"), objects: [shapeObject("shape", 0, 0, 10, 10)] };
  const session = createBoardSession({ id: "session", ownerId: "owner", title: "  Planning  ", board, createdAt: "now" });
  assert.equal(session.title, "Planning");
  assert.equal(session.status, "active");
  assert.notEqual(session.initialBoard, board);
  assert.equal(isBoardSessionOwner(session, "owner"), true);
  assert.equal(isBoardSessionOwner(session, "member"), false);
  assert.equal(renameBoardSession(session, "member", "Nope", "later"), null);
  assert.equal(renameBoardSession(session, "owner", "  ", "later"), null);
  assert.equal(renameBoardSession(session, "owner", "  Review  ", "later")?.title, "Review");
});
