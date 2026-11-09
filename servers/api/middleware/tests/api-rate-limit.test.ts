import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createApiRateLimitMiddleware } from "../api-rate-limit.js";

const createRequest = (method: string, path: string, headers: Record<string, string> = {}): Request => ({
  method, path, headers, ip: "192.0.2.15"
} as unknown as Request);
const createResponse = () => {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name.toLowerCase(), value); return response; },
    status: (code: number) => { statusCode = code; return response; },
    json: (value: unknown) => { body = value; return response; }
  } as unknown as Response;
  return { response, headers, get statusCode() { return statusCode; }, get body() { return body; } };
};
const flushPromises = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

void test("bypasses health, metrics, observability, favicon and preflight requests", () => {
  const calls: unknown[] = [];
  const middleware = createApiRateLimitMiddleware({ reserve: (input) => { calls.push(input); return Promise.resolve({ allowed: true, retryAfterSeconds: 30 }); } });
  const bypassedRequests: readonly (readonly [string, string])[] = [["OPTIONS", "/write"], ["GET", "/health"], ["GET", "/favicon.ico"], ["GET", "/observability/traces"], ["GET", "/metrics"]];
  for (const [method, path] of bypassedRequests) {
    let continued = false;
    middleware(createRequest(method, path), createResponse().response, (() => { continued = true; }) as NextFunction);
    assert.equal(continued, true, `${method} ${path} should bypass limiting`);
  }
  assert.equal(calls.length, 0);
});

void test("reserves against a valid bearer session token and continues when allowed", async () => {
  let captured: unknown;
  let continued = false;
  const middleware = createApiRateLimitMiddleware({ reserve: (input) => { captured = input; return Promise.resolve({ allowed: true, retryAfterSeconds: 30 }); } });
  middleware(createRequest("POST", "/sessions", { authorization: `Bearer ${"x".repeat(43)}` }), createResponse().response, (() => { continued = true; }) as NextFunction);
  await flushPromises();
  assert.deepEqual(captured, { sessionToken: "x".repeat(43), ipAddress: "192.0.2.15" });
  assert.equal(continued, true);
});

void test("reads a valid cookie when bearer is invalid and rejects malformed cookie encoding", async () => {
  const captured: unknown[] = [];
  const middleware = createApiRateLimitMiddleware({ reserve: (input) => { captured.push(input); return Promise.resolve({ allowed: true, retryAfterSeconds: 30 }); } });
  middleware(createRequest("GET", "/api", { authorization: "Bearer short", cookie: `other=x; wb_session=${"c".repeat(40)}` }), createResponse().response, (() => undefined) as NextFunction);
  middleware(createRequest("GET", "/api", { cookie: "wb_session=%E0%A4%A" }), createResponse().response, (() => undefined) as NextFunction);
  await flushPromises();
  assert.deepEqual(captured, [
    { sessionToken: "c".repeat(40), ipAddress: "192.0.2.15" },
    { ipAddress: "192.0.2.15" }
  ]);
});

void test("returns rate-limited response and retry headers when reservation is denied", async () => {
  const middleware = createApiRateLimitMiddleware({ reserve: () => Promise.resolve({ allowed: false, retryAfterSeconds: 12 }) });
  const output = createResponse();
  middleware(createRequest("POST", "/write"), output.response, (() => assert.fail("denied request must not continue")) as NextFunction);
  await flushPromises();
  assert.equal(output.statusCode, 429);
  assert.equal(output.headers.get("retry-after"), "12");
  assert.equal(output.headers.get("cache-control"), "no-store");
});

void test("fails closed when reservation storage rejects", async () => {
  const middleware = createApiRateLimitMiddleware({ reserve: () => Promise.reject(new Error("storage")) });
  const output = createResponse();
  middleware(createRequest("POST", "/write"), output.response, (() => assert.fail("unavailable request must not continue")) as NextFunction);
  await flushPromises();
  assert.equal(output.statusCode, 503);
  assert.equal(output.headers.get("cache-control"), "no-store");
  assert.deepEqual(output.body, { error: { code: "service_unavailable", message: "Whiteboard API is temporarily unavailable." } });
});
