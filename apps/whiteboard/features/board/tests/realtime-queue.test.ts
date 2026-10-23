import assert from "node:assert/strict";
import test from "node:test";
import { nextQueuedEdit, queueStorageKey, readQueue, type PendingEdit } from "../realtime-queue.js";

const edit = (actionId: string, blocked: boolean): PendingEdit => ({
  command: { actionId, baseSequence: 0, changes: [{ kind: "board.title", value: actionId }] },
  blocked,
  createdAt: 1
});

void test("sends only the queue head so a blocked stale edit pauses later edits", () => {
  const blocked = edit("blocked", true);
  const later = edit("later", false);

  assert.equal(nextQueuedEdit([blocked, later]), null);
});

void test("sends the oldest eligible edit in deterministic queue order", () => {
  const first = edit("first", false);
  const later = edit("later", false);

  assert.equal(nextQueuedEdit([first, later]), first);
});

void test("retains text-formatting edits when restoring the offline queue", () => {
  const pending: PendingEdit = {
    command: {
      actionId: "4b25c8c0-2c45-4f8f-a7ab-b36f2eb6a0ad",
      baseSequence: 0,
      changes: [
        { kind: "object.set", objectId: "text-1", property: "italic", value: true },
        { kind: "object.set", objectId: "text-1", property: "underline", value: true }
      ]
    },
    blocked: false,
    createdAt: Date.now()
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => key === queueStorageKey("session-1") ? JSON.stringify([pending]) : null
      }
    }
  });

  try {
    assert.deepEqual(readQueue("session-1"), [pending]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  }
});
