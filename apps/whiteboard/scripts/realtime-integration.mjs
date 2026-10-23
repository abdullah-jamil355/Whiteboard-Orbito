import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { HocuspocusProvider } from "@hocuspocus/provider";
import WebSocket from "ws";
import * as Y from "yjs";

const apiOrigin = process.env.WHITEBOARD_API_ORIGIN ?? "http://localhost:4000";
const webOrigin = process.env.WHITEBOARD_WEB_ORIGIN ?? "http://localhost:3000";
const realtimeUrl = process.env.WHITEBOARD_REALTIME_URL ?? "ws://localhost:4001";
const ownerEmail = "wb-integration-owner@example.invalid";
const editorEmail = "wb-integration-editor@example.invalid";
const isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
assert.ok(isLoopback(new URL(apiOrigin).hostname), "The integration test only allows a loopback API.");
assert.ok(isLoopback(new URL(webOrigin).hostname), "The integration test only allows a loopback web origin.");
assert.ok(isLoopback(new URL(realtimeUrl).hostname), "The integration test only allows a loopback realtime server.");
let sessionId;
let ownerCookie;
const clients = [];

const request = async (path, { method = "GET", cookie, body } = {}) => {
  let response;
  try {
    response = await fetch(new URL(path, apiOrigin), {
      method,
      headers: {
        origin: webOrigin,
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error(`Cannot reach the local Whiteboard API at ${apiOrigin}.`);
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data, headers: response.headers };
};

const assertStatus = (result, expected, action) => {
  const retryAfter = result.status === 429 ? result.headers.get("retry-after") : null;
  const guidance = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
  assert.equal(result.status, expected, `${action} returned HTTP ${result.status}.${guidance}`);
};

const withTimeout = (promise, label) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), 8000);
  timeout.unref?.();
  promise.then(
    (value) => { clearTimeout(timeout); resolve(value); },
    (error) => { clearTimeout(timeout); reject(error); }
  );
});

const signIn = async (email) => {
  assertStatus(await request("/auth/magic-links", { method: "POST", body: { email } }), 202, "Sign-in request");
  const mailbox = await request("/__dev/mailbox", { method: "POST", body: { email } });
  assertStatus(mailbox, 200, "Local development mailbox");
  const message = [...mailbox.data.messages].reverse().find(({ kind }) => kind === "sign-in");
  assert.ok(message?.verificationUrl, "Local mailbox must contain a sign-in link.");
  const token = new URLSearchParams(new URL(message.verificationUrl).hash.slice(1)).get("token");
  assert.ok(token, "Sign-in link must contain its one-time token.");
  const consumed = await request("/auth/magic-links/consume", { method: "POST", body: { token } });
  assertStatus(consumed, 200, "Sign-in confirmation");
  const cookie = consumed.headers.getSetCookie?.().find((value) => value.startsWith("wb_session="))?.split(";")[0];
  assert.ok(cookie, "Sign-in must set the Whiteboard session cookie.");
  return cookie;
};

const verifyIdentityCookie = async (cookie, email, label) => {
  const result = await request("/auth/session", { cookie });
  assertStatus(result, 200, `${label} session-cookie verification`);
  assert.equal(result.data?.identity?.email, email, `${label} cookie must resolve to the expected test identity.`);
};

const createRealtimeClient = (cookie) => {
  const messages = [];
  const waiters = new Set();
  const document = new Y.Doc();
  let resolveAuthenticated;
  let rejectAuthenticated;
  const authenticated = new Promise((resolve, reject) => {
    resolveAuthenticated = resolve;
    rejectAuthenticated = reject;
  });
  const provider = new HocuspocusProvider({
    url: realtimeUrl,
    name: sessionId,
    document,
    maxAttempts: 1,
    delay: 1000,
    factor: 1,
    WebSocketPolyfill: class extends WebSocket {
      constructor(address) {
        console.log("step: websocket polyfill constructed");
        super(address, { headers: { Origin: webOrigin, Cookie: cookie } });
        this.on("error", (error) => console.log(`socket error: ${error.message}`));
      }
    },
    onOpen: () => console.log("step: websocket opened"),
    onStatus: ({ status }) => console.log(`step: websocket status ${status}`),
    onClose: ({ event }) => console.log(`step: websocket closed (${event.code}: ${event.reason ?? "no reason"})`),
    onAuthenticated: resolveAuthenticated,
    onAuthenticationFailed: ({ reason }) => {
      const safeReason = typeof reason === "string" ? reason.slice(0, 120) : "unspecified reason";
      console.log(`step: websocket authentication rejected (${safeReason})`);
      rejectAuthenticated(new Error(`Hocuspocus rejected the test identity: ${safeReason}`));
    },
    onMaxAttemptsFailed: ({ error }) => {
      console.log(`step: websocket max attempts failed (${error instanceof Error ? error.message : "unknown transport error"})`);
      rejectAuthenticated(new Error("Hocuspocus could not establish the realtime connection."));
    },
    onStateless: ({ payload }) => {
      let message;
      try { message = JSON.parse(payload); } catch { return; }
      messages.push(message);
      for (const wake of waiters) wake();
    }
  });
  clients.push({ provider, document });
  const waitFor = async (predicate, label) => {
    const existing = messages.find(predicate);
    if (existing) return existing;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`Timed out waiting for ${label}.`));
      }, 8000);
      const check = () => {
        const message = messages.find(predicate);
        if (!message) return;
        clearTimeout(timeout);
        waiters.delete(check);
        resolve(message);
      };
      waiters.add(check);
      check();
    });
  };
  return { authenticated, provider, waitFor };
};

try {
  ownerCookie = await signIn(ownerEmail);
  await verifyIdentityCookie(ownerCookie, ownerEmail, "Owner");
  console.log("step: owner verified");
  const board = {
    id: randomUUID(), title: `Realtime integration ${Date.now()}`, templateId: "blank",
    canvas: { gridStyle: "graph-paper", gridSpacing: 22 }, objects: []
  };
  const created = await request("/sessions", {
    method: "POST", cookie: ownerCookie,
    body: { title: board.title, board }
  });
  assertStatus(created, 201, "Create test session");
  sessionId = created.data.session.id;
  console.log("step: session created");

  const invited = await request(`/sessions/${sessionId}/invitations`, {
    method: "POST", cookie: ownerCookie, body: { email: editorEmail, role: "editor" }
  });
  assertStatus(invited, 202, "Invite Editor");
  const invitationMailbox = await request("/__dev/mailbox", { method: "POST", body: { email: editorEmail } });
  const invitation = [...invitationMailbox.data.messages].reverse().find(({ kind }) => kind === "invitation");
  assert.ok(invitation?.invitationUrl, "Editor mailbox must contain the private invitation link.");
  const invitationToken = new URLSearchParams(new URL(invitation.invitationUrl).hash.slice(1)).get("token");
  assert.ok(invitationToken, "Invitation link must contain its one-time token.");

  const editorCookie = await signIn(editorEmail);
  await verifyIdentityCookie(editorCookie, editorEmail, "Editor");
  const accepted = await request("/invitations/accept", {
    method: "POST", cookie: editorCookie, body: { token: invitationToken, displayName: "Realtime Editor" }
  });
  assertStatus(accepted, 200, "Accept test invitation");
  assert.equal(accepted.data.membership.role, "editor");
  console.log("step: Editor invitation accepted");

  const owner = createRealtimeClient(ownerCookie);
  const editor = createRealtimeClient(editorCookie);
  await Promise.all([
    withTimeout(owner.authenticated, "owner Hocuspocus authentication"),
    withTimeout(editor.authenticated, "Editor Hocuspocus authentication")
  ]);
  console.log("step: both realtime clients authenticated");
  owner.provider.sendStateless(JSON.stringify({ type: "board:sync" }));
  editor.provider.sendStateless(JSON.stringify({ type: "board:sync" }));
  await Promise.all([
    owner.waitFor((message) => message.type === "board:state" && message.sequence === 0, "owner initial board"),
    editor.waitFor((message) => message.type === "board:state" && message.sequence === 0, "Editor initial board")
  ]);

  const shape = {
    id: randomUUID(), type: "shape", shape: "rectangle",
    geometry: { x: 12, y: 18, width: 120, height: 64 },
    style: { fill: "none", stroke: "#1f2937", lineWeight: "thin" }
  };
  const addActionId = randomUUID();
  owner.provider.sendStateless(JSON.stringify({
    type: "board:edit",
    command: { actionId: addActionId, baseSequence: 0, changes: [{ kind: "object.add", object: shape }] }
  }));
  const [ownerAdded, editorAdded] = await Promise.all([
    owner.waitFor((message) => message.type === "board:state" && message.actionId === addActionId, "owner accepted edit"),
    editor.waitFor((message) => message.type === "board:state" && message.actionId === addActionId, "Editor broadcast")
  ]);
  assert.equal(ownerAdded.sequence, 1);
  assert.deepEqual(editorAdded.board.objects.map(({ id }) => id), [shape.id]);

  const moveActionId = randomUUID();
  editor.provider.sendStateless(JSON.stringify({
    type: "board:edit",
    command: { actionId: moveActionId, baseSequence: 1, changes: [{ kind: "object.set", objectId: shape.id, property: "geometry.x", value: 48 }] }
  }));
  const [ownerMoved, editorMoved] = await Promise.all([
    owner.waitFor((message) => message.type === "board:state" && message.actionId === moveActionId, "Owner Editor-edit broadcast"),
    editor.waitFor((message) => message.type === "board:state" && message.actionId === moveActionId, "Editor accepted edit")
  ]);
  const moved = ownerMoved.board.objects.find(({ id }) => id === shape.id);
  assert.equal(ownerMoved.sequence, 2);
  assert.equal(editorMoved.sequence, 2);
  assert.equal(moved.geometry.x, 48);
  console.log("step: both edit directions broadcast");
  console.log("PASS: separate owner/Editor identities joined one Mongo-backed Hocuspocus room and received each other's accepted edits.");
} finally {
  for (const { provider, document } of clients) {
    provider.destroy();
    document.destroy();
  }
  if (sessionId && ownerCookie) {
    const ended = await request(`/sessions/${sessionId}`, { method: "DELETE", cookie: ownerCookie, body: {} });
    assert.ok(ended.status === 200 || ended.status === 404, "Test session must be ended or already cleaned up.");
  }
}
