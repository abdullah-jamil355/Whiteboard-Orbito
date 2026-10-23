import assert from "node:assert/strict";
import test from "node:test";
import { resetInFlightActionOnTransportLoss } from "../realtime-connection.js";

void test("keeps an in-flight action while the transport remains connected", () => {
  assert.equal(resetInFlightActionOnTransportLoss("connected", "action-1"), "action-1");
});

void test("releases an unacknowledged action marker when reconnect begins", () => {
  assert.equal(resetInFlightActionOnTransportLoss("connecting", "action-1"), null);
  assert.equal(resetInFlightActionOnTransportLoss("disconnected", "action-1"), null);
});
