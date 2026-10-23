import assert from "node:assert/strict";
import test from "node:test";
import { canPublishCursor } from "../realtime-presence-policy.js";

void test("authenticated current-session participants of every role publish cursor presence", () => {
  assert.equal(canPublishCursor({ authenticated: true, currentSession: true, role: "editor" }), true);
  assert.equal(canPublishCursor({ authenticated: true, currentSession: true, role: "owner" }), true);
  assert.equal(canPublishCursor({ authenticated: true, currentSession: true, role: "viewer" }), true);
  assert.equal(canPublishCursor({ authenticated: true, currentSession: false, role: "editor" }), false);
  assert.equal(canPublishCursor({ authenticated: false, currentSession: true, role: "editor" }), false);
});
