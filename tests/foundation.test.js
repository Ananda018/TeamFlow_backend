import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import express from "express";
import { spawnSync } from "node:child_process";
import { createApp } from "../src/app.js";
import { readEnvironment } from "../src/config/environment.js";
import { createHealthChecks, probe } from "../src/services/health.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";

const config = readEnvironment({ NODE_ENV: "test" });
const healthy = { database: async () => {}, redis: async () => {} };
const buildApp = (checks = healthy) => createApp({ config, checks });

test("all health endpoints report successful dependency probes", async () => {
  const app = buildApp();
  for (const path of [
    "/api/health",
    "/api/health/database",
    "/api/health/redis",
  ]) {
    const response = await request(app).get(path).expect(200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.ok(response.headers["x-request-id"]);
  }
});

test("a failed dependency returns 503 without leaking details", async () => {
  const app = buildApp({
    ...healthy,
    redis: async () => {
      throw new Error("private-connection-details");
    },
  });
  const response = await request(app).get("/api/health").expect(503);
  assert.deepEqual(response.body.services, { database: "up", redis: "down" });
  assert.ok(!response.text.includes("private-connection-details"));
  await request(app).get("/api/health/redis").expect(503);
  await request(app).get("/api/health/database").expect(200);
});

test("database outage returns 503 while Redis remains independently healthy", async () => {
  const app = buildApp({
    ...healthy,
    database: async () => {
      throw new Error("offline");
    },
  });
  await request(app).get("/api/health").expect(503);
  await request(app).get("/api/health/database").expect(503);
  await request(app).get("/api/health/redis").expect(200);
});

test("health probes terminate when dependencies hang", async () => {
  assert.equal(await probe(() => new Promise(() => {}), 20), "down");
});

test("real dependency adapters ping their services and reject disconnected clients", async () => {
  let databasePings = 0;
  let redisPings = 0;
  const database = {
    readyState: 1,
    db: {
      admin: () => ({
        ping: async () => {
          databasePings++;
        },
      }),
    },
  };
  const redis = {
    isReady: true,
    ping: async () => {
      redisPings++;
      return "PONG";
    },
  };
  const checks = createHealthChecks(database, redis);
  assert.equal(await probe(checks.database), "up");
  assert.equal(await probe(checks.redis), "up");
  assert.equal(databasePings, 1);
  assert.equal(redisPings, 1);
  database.readyState = 0;
  redis.isReady = false;
  assert.equal(await probe(checks.database), "down");
  assert.equal(await probe(checks.redis), "down");
});

test("unknown routes produce structured JSON errors", async () => {
  const response = await request(buildApp()).get("/missing").expect(404);
  assert.equal(response.body.message, "Route not found");
  assert.ok(response.body.requestId);
});

test("invalid JSON and oversized bodies are handled centrally", async () => {
  const app = buildApp();
  const invalid = await request(app)
    .post("/missing")
    .set("Content-Type", "application/json")
    .send("{")
    .expect(400);
  assert.equal(invalid.body.message, "Invalid JSON body");
  await request(app)
    .post("/missing")
    .send({ text: "a".repeat(20000) })
    .expect(413);
});

test("CORS permits configured origins and rejects others", async () => {
  const app = buildApp();
  const allowed = await request(app)
    .get("/api/health")
    .set("Origin", "http://localhost:5173")
    .expect(200);
  assert.equal(
    allowed.headers["access-control-allow-origin"],
    "http://localhost:5173"
  );
  assert.equal(allowed.headers["access-control-allow-credentials"], "true");
  await request(app)
    .options("/api/health")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "GET")
    .expect(204);
  await request(app)
    .get("/api/health")
    .set("Origin", "https://untrusted.example")
    .expect(403);
});

test("unexpected errors do not expose stack traces or credentials", async () => {
  const app = express();
  app.get("/", async () => {
    throw new Error("password=private");
  });
  app.use(errorHandler);
  const response = await request(app).get("/").expect(500);
  assert.deepEqual(response.body, {
    success: false,
    message: "Internal server error",
  });
  assert.ok(!response.text.includes("private"));
});

test("configuration defaults and legacy MongoDB variable are supported", () => {
  assert.equal(config.port, 8000);
  assert.equal(
    readEnvironment({ MONGODB_URI: "mongodb://localhost/legacy" }).mongoUri,
    "mongodb://localhost/legacy"
  );
  assert.equal(
    readEnvironment({
      MONGO_URI: "mongodb://localhost/current",
      MONGODB_URI: "mongodb://localhost/legacy",
    }).mongoUri,
    "mongodb://localhost/current"
  );
});

test("configuration rejects unsafe or invalid settings", () => {
  for (const input of [
    { PORT: "NaN" },
    { PORT: "0" },
    { NODE_ENV: "invalid" },
    { MONGO_URI: "https://example.com" },
    { REDIS_URL: "https://example.com" },
    { CORS_ORIGIN: "*" },
    { CORS_ORIGIN: "https://example.com/path" },
    { NODE_ENV: "production" },
  ]) {
    assert.throws(() => readEnvironment(input));
  }
});

test("startup fails cleanly with unavailable infrastructure without printing secrets", () => {
  const result = spawnSync(process.execPath, ["src/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      MONGO_URI: "mongodb://private-user:private-password@127.0.0.1:1/teamflow",
      REDIS_URL: "redis://127.0.0.1:1",
      CORS_ORIGIN: "http://localhost:5173",
    },
    encoding: "utf8",
    // Allow cold module loading on Windows in addition to the 5s DB timeout.
    timeout: 45000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /server.startup_failed/);
  assert.ok(!(result.stdout + result.stderr).includes("private-password"));
});
