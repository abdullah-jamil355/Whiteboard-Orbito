import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { createApiConfig, readApiEnvironment } from "../config/index.js";

void test("derives API configuration from validated environment input", () => {
  const environment = readApiEnvironment({
    NODE_ENV: "production",
    API_HOST: "0.0.0.0",
    API_PORT: "8080",
    WEB_ORIGIN: "https://example.test",
    MONGODB_URI: "mongodb+srv://cluster.example.test/db",
    REALTIME_HOST: "0.0.0.0",
    REALTIME_PORT: "8081",
    IDENTITY_RATE_LIMIT_KEY: "a".repeat(64),
    LOG_LEVEL: "warn"
  });
  assert.deepEqual(createApiConfig(environment), {
    environment: "production",
    host: "0.0.0.0",
    port: 8080,
    webOrigin: "https://example.test",
    logLevel: "warn",
    mongodbUri: "mongodb+srv://cluster.example.test/db",
    realtimeHost: "0.0.0.0",
    realtimePort: 8081,
    identityRateLimitKey: "a".repeat(64)
  });
});

void test("uses the loopback realtime listener defaults in local development", () => {
  const environment = readApiEnvironment({
    NODE_ENV: "development",
    API_HOST: "127.0.0.1",
    API_PORT: "4000",
    WEB_ORIGIN: "http://localhost:3100",
    LOG_LEVEL: "debug"
  });
  const config = createApiConfig(environment);
  assert.equal(config.realtimeHost, "127.0.0.1");
  assert.equal(config.realtimePort, 4001);
});

void test("requires HTTPS, MongoDB, and a 256-bit rate-limit key in production", () => {
  assert.throws(() => readApiEnvironment({
    NODE_ENV: "production",
    API_HOST: "0.0.0.0",
    API_PORT: "8080",
    WEB_ORIGIN: "http://example.test",
    MONGODB_URI: "mongodb+srv://cluster.example.test/db",
    REALTIME_HOST: "0.0.0.0",
    REALTIME_PORT: "8081",
    IDENTITY_RATE_LIMIT_KEY: "a".repeat(64),
    LOG_LEVEL: "warn"
  }));
  assert.throws(() => readApiEnvironment({
    NODE_ENV: "production",
    API_HOST: "0.0.0.0",
    API_PORT: "8080",
    WEB_ORIGIN: "https://example.test",
    LOG_LEVEL: "warn"
  }));
});

void test("rejects invalid server environment input", () => {
  assert.throws(() => readApiEnvironment({ API_PORT: "70000" }));
});

void test("requires runtime values from the environment", () => {
  assert.throws(() => readApiEnvironment({}), ZodError);
});
