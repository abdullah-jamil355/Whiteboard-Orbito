import assert from "node:assert/strict";
import test from "node:test";
import { readCollaborators } from "../realtime-presence.js";

void test("reads verified participant cursors while hiding the local cursor", () => {
  const participants = readCollaborators(new Map([
    [1, { user: { name: "Owner", role: "owner" }, cursor: { x: 12, y: 20 } }],
    [2, { user: { name: "Viewer", role: "viewer" }, cursor: { x: 80, y: 90 } }],
    [3, { user: { name: "Local", role: "editor" }, cursor: { x: 2, y: 3 } }]
  ]), 3);

  assert.deepEqual(participants.map(({ name, cursor }) => ({ name, cursor })), [
    { name: "Local", cursor: null },
    { name: "Owner", cursor: { x: 12, y: 20 } },
    { name: "Viewer", cursor: { x: 80, y: 90 } }
  ]);
});

void test("ignores malformed collaborator cursor coordinates", () => {
  const [participant] = readCollaborators(new Map([
    [7, { user: { name: "Ari", role: "editor" }, cursor: { x: Number.NaN, y: 1 } }]
  ]), 99);

  assert.equal(participant?.cursor, null);
});
