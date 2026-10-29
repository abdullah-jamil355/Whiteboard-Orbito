import { createServer } from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createMetricsRegistry, createTraceMiddleware } from "@workspace/logging";
import { HTTP_STATUS } from "../../../constants/index.js";
import { createMonitoringRoutes } from "../index.js";

void test("Monitoring routes and trace middleware expose metrics and trace records", async (context) => {
  const app = express();
  const metrics = createMetricsRegistry();
  app.use(createTraceMiddleware(metrics));
  app.use(createMonitoringRoutes({ metrics }));

  app.get("/test-endpoint", (_req, res) => {
    res.status(HTTP_STATUS.ok).json({ success: true });
  });

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${String(address.port)}`;

  // 1. Hit the dummy endpoint
  const testRes = await fetch(`${baseUrl}/test-endpoint`);
  assert.equal(testRes.status, HTTP_STATUS.ok);
  const traceId = testRes.headers.get("x-trace-id");
  assert.ok(traceId && traceId.startsWith("trc_"), "Response must contain x-trace-id header");

  // 2. Check /observability/stats endpoint
  const statsRes = await fetch(`${baseUrl}/observability/stats`);
  assert.equal(statsRes.status, HTTP_STATUS.ok);
  const stats = await statsRes.json() as {
    totalRequests: number;
    endpoints: Array<{ route: string; hits: number }>;
    recentTraces: Array<{ traceId: string; route: string }>;
  };

  assert.ok(stats.totalRequests >= 1);
  assert.ok(stats.endpoints.some((e) => e.route === "/test-endpoint"));
  assert.ok(stats.recentTraces.some((t) => t.traceId === traceId));

  // 3. Check /metrics endpoint for Prometheus
  const metricsRes = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsRes.status, HTTP_STATUS.ok);
  const metricsText = await metricsRes.text();
  assert.ok(metricsText.includes("http_requests_total"));
  assert.ok(metricsText.includes("http_request_duration_seconds"));
});
