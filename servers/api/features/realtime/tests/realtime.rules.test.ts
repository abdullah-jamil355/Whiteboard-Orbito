import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedRealtimeOrigin, parseRealtimeRoomId, readRealtimeSessionCookie, sanitizeRealtimeAwarenessState } from "../realtime.rules.js";

void test("accepts only a server session id as a room name", () => {
  assert.equal(parseRealtimeRoomId("507f1f77bcf86cd799439011"), "507f1f77bcf86cd799439011");
  assert.equal(parseRealtimeRoomId("507F1F77BCF86CD799439011"), "507F1F77BCF86CD799439011");
  assert.equal(parseRealtimeRoomId("public-room"), null);
  assert.equal(parseRealtimeRoomId("507f1f77bcf86cd799439011?role=owner"), null);
});

void test("reads only the encoded HttpOnly session cookie and rejects malformed encoding", () => {
  assert.equal(readRealtimeSessionCookie("theme=dark; wb_session=opaque%2Dtoken; x=y"), "opaque-token");
  assert.equal(readRealtimeSessionCookie("other=value"), undefined);
  assert.equal(readRealtimeSessionCookie("wb_session=%E0%A4%A"), undefined);
});

void test("requires an exact configured realtime browser origin", () => {
  assert.equal(isAllowedRealtimeOrigin("http://localhost:3100", "http://localhost:3100"), true);
  assert.equal(isAllowedRealtimeOrigin("http://127.0.0.1:3100", "http://localhost:3100"), false);
  assert.equal(isAllowedRealtimeOrigin(null, "http://localhost:3100"), false);
});

void test("awareness identity is server-owned and bounded cursors are retained for every role", () => {
  assert.deepEqual(sanitizeRealtimeAwarenessState({ user: { name: "spoofed", role: "owner" }, cursor: { x: 12, y: 32 }, privateData: "drop" }, "Ari", "editor"), {
    user: { name: "Ari", role: "editor" }, cursor: { x: 12, y: 32 }
  });
  assert.deepEqual(sanitizeRealtimeAwarenessState({ user: { role: "owner" }, cursor: { x: 12, y: 32 } }, "Viewer", "viewer"), {
    user: { name: "Viewer", role: "viewer" }, cursor: { x: 12, y: 32 }
  });
  assert.deepEqual(sanitizeRealtimeAwarenessState({ cursor: { x: 1_000_001, y: 0 } }, "Owner", "owner"), {
    user: { name: "Owner", role: "owner" }
  });
  assert.deepEqual(sanitizeRealtimeAwarenessState(null, ` ${"A".repeat(90)} `, "owner"), {
    user: { name: "A".repeat(80), role: "owner" }
  });
});
