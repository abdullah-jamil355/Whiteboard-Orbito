import assert from "node:assert/strict";
import test from "node:test";
import { isUnavailableSessionError, WhiteboardApiError } from "../api-client.js";

void test("recognizes an unavailable session without treating other API failures as ended sessions", () => {
  assert.equal(isUnavailableSessionError(new WhiteboardApiError("gone", 404, "session_not_found")), true);
  assert.equal(isUnavailableSessionError(new WhiteboardApiError("denied", 403, "authentication_required")), false);
  assert.equal(isUnavailableSessionError(new Error("The session was not found")), false);
});
