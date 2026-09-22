import mongoose from "mongoose";
import { readEnvironment } from "./config/environment.js";
import { createRedisClient } from "./config/redis.js";
import connectDB from "./db/index.js";
import { createHealthChecks } from "./services/health.service.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { startupDiagnostics } from "./utils/startup-diagnostics.js";

let server;
let redis;
let shuttingDown = false;
let startupStage = "configuration";

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 5000);
  deadline.unref();
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (redis?.isOpen) redis.destroy();
    await mongoose.disconnect();
    process.exitCode = exitCode;
    logger.info("server.stopped");
  } catch {
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

async function start() {
  const config = readEnvironment();
  startupStage = "redis";
  redis = createRedisClient(config.redisUrl);
  startupStage = "database";
  await connectDB(config.mongoUri, {
    legacy: !process.env.MONGO_URI && Boolean(process.env.MONGODB_URI),
  });
  if (shuttingDown) {
    await mongoose.disconnect();
    return;
  }
  startupStage = "redis";
  await redis.connect();
  if (shuttingDown) {
    if (redis.isOpen) redis.destroy();
    return;
  }
  startupStage = "http";
  const app = createApp({
    config,
    checks: createHealthChecks(mongoose.connection, redis),
  });
  server = app.listen(config.port, () =>
    logger.info("server.started", { port: config.port })
  );
  server.on("error", (error) => {
    logger.error("server.listen_failed", startupDiagnostics("http", error));
    void shutdown(1);
  });
}

try {
  await start();
} catch (error) {
  logger.error(
    "server.startup_failed",
    startupDiagnostics(startupStage, error)
  );
  await shutdown(1);
}
