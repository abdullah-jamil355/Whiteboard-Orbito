import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { createGmailSmtpEmailSender } from "../email.gmail-smtp.js";

void test("configures Gmail SMTP and sends the expected message", async (context) => {
  let options: unknown;
  let message: unknown;
  context.mock.method(nodemailer, "createTransport", ((configuration: unknown) => {
    options = configuration;
    return { sendMail: (input: unknown) => { message = input; return Promise.resolve({ messageId: "message-1" }); } };
  }) as never);
  const logs: unknown[][] = [];
  context.mock.method(console, "log", ((...args: unknown[]) => { logs.push(args); }) as never);
  const send = createGmailSmtpEmailSender({ username: "owner@gmail.com", appPassword: "app-password", timeoutMs: 4_000 });
  await send({ recipient: "invitee@example.com", subject: "Join", html: "<p>Join</p>", text: "Join" });
  assert.deepEqual(options, {
    service: "gmail", auth: { user: "owner@gmail.com", pass: "app-password" },
    connectionTimeout: 4_000, greetingTimeout: 4_000, socketTimeout: 4_000
  });
  assert.deepEqual(message, {
    from: { name: "Orbito Whiteboard", address: "owner@gmail.com" },
    to: "invitee@example.com", subject: "Join", html: "<p>Join</p>", text: "Join"
  });
  assert.match(String(logs[0]?.[0]), /EMAIL SUCCESS/);
});

void test("logs and rethrows Gmail SMTP delivery errors", async (context) => {
  const failure = new Error("SMTP unavailable");
  context.mock.method(nodemailer, "createTransport", (() => ({ sendMail: () => Promise.reject(failure) })) as never);
  const errors: unknown[][] = [];
  context.mock.method(console, "error", ((...args: unknown[]) => { errors.push(args); }) as never);
  const send = createGmailSmtpEmailSender({ username: "owner@gmail.com", appPassword: "app-password" });
  await assert.rejects(send({ recipient: "invitee@example.com", subject: "Join", html: "", text: "" }), (error: unknown) => error === failure);
  assert.match(String(errors[0]?.[0]), /EMAIL ERROR/);
  assert.equal(errors[0]?.[1], failure);
});
