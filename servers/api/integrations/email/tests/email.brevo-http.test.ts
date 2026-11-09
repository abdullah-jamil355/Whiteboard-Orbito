import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createBrevoHttpEmailSender } from "../email.brevo-http.js";

const installFetch = (context: TestContext, implementation: (url: string, init?: RequestInit) => Promise<Response>) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  context.mock.method(globalThis, "fetch", ((url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: requestUrl, ...(init === undefined ? {} : { init }) });
    return implementation(requestUrl, init);
  }) as never);
  return calls;
};
const readBody = (body: BodyInit | null | undefined): string => {
  if (typeof body !== "string") throw new Error("Expected a serialized JSON request body.");
  return body;
};

void test("posts a complete invitation message to Brevo", async (context) => {
  const calls = installFetch(context, () => Promise.resolve({ ok: true }) as Promise<Response>);
  const logs: unknown[][] = [];
  context.mock.method(console, "log", ((...args: unknown[]) => { logs.push(args); }) as never);
  const send = createBrevoHttpEmailSender({ apiKey: "brevo-key", senderEmail: "invite@example.com", senderName: "Whiteboard", timeoutMs: 8_000 });
  await send({ recipient: "person@example.com", subject: "Join", html: "<p>Join</p>", text: "Join" });
  const firstCall = calls[0];
  assert.ok(firstCall?.init);
  assert.equal(firstCall.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(firstCall.init.method, "POST");
  assert.equal(new Headers(firstCall.init.headers).get("api-key"), "brevo-key");
  assert.equal(firstCall.init.signal instanceof AbortSignal, true);
  assert.deepEqual(JSON.parse(readBody(firstCall.init.body)), {
    sender: { name: "Whiteboard", email: "invite@example.com" },
    to: [{ email: "person@example.com" }], subject: "Join", htmlContent: "<p>Join</p>", textContent: "Join"
  });
  assert.match(String(logs[0]?.[0]), /BREVO SUCCESS/);
});

void test("uses the default sender name and reports provider errors", async (context) => {
  const calls = installFetch(context, () => Promise.resolve({ ok: false, status: 429, statusText: "Too Many Requests", text: () => Promise.resolve("slow down") } as Response));
  const errors: unknown[][] = [];
  context.mock.method(console, "error", ((...args: unknown[]) => { errors.push(args); }) as never);
  const send = createBrevoHttpEmailSender({ apiKey: "brevo-key", senderEmail: "invite@example.com" });
  await assert.rejects(send({ recipient: "person@example.com", subject: "Join", html: "", text: "" }), /Brevo 429: slow down/);
  const failedCall = calls[0];
  assert.ok(failedCall?.init);
  const parsed = JSON.parse(readBody(failedCall.init.body)) as { sender: { name: string; email: string } };
  assert.deepEqual(parsed.sender, { name: "Orbito Whiteboard", email: "invite@example.com" });
  assert.match(String(errors[0]?.[0]), /BREVO ERROR/);
  assert.match(String(errors[1]?.[0]), /EMAIL ERROR/);
});

void test("preserves fetch errors from the Brevo adapter", async (context) => {
  const failure = new Error("network down");
  installFetch(context, () => Promise.reject(failure));
  context.mock.method(console, "error", (() => undefined) as never);
  const send = createBrevoHttpEmailSender({ apiKey: "key", senderEmail: "invite@example.com" });
  await assert.rejects(send({ recipient: "person@example.com", subject: "Join", html: "", text: "" }), (error: unknown) => error === failure);
});

void test("uses the provider status message when the Brevo error body cannot be read", async (context) => {
  installFetch(context, () => Promise.resolve({ ok: false, status: 503, statusText: "Unavailable", text: () => Promise.reject(new Error("body unavailable")) } as Response));
  context.mock.method(console, "error", (() => undefined) as never);
  const send = createBrevoHttpEmailSender({ apiKey: "key", senderEmail: "invite@example.com" });
  await assert.rejects(send({ recipient: "person@example.com", subject: "Join", html: "", text: "" }), /Brevo 503: Unavailable/);
});
