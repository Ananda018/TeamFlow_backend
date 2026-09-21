import mongoose from "mongoose";
import { readEnvironment } from "./config/environment.js";
import { createRedisClient } from "./config/redis.js";
import connectDB from "./db/index.js";
import { createHealthChecks } from "./services/health.service.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

let server;
let redis;
let shuttingDown = false;

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
  redis = createRedisClient(config.redisUrl);
  await connectDB(config.mongoUri, {
    legacy: !process.env.MONGO_URI && Boolean(process.env.MONGODB_URI),
  });
  if (shuttingDown) {
    await mongoose.disconnect();
    return;
  }
  await redis.connect();
  if (shuttingDown) {
    if (redis.isOpen) redis.destroy();
    return;
  }
  const app = createApp({
    config,
    checks: createHealthChecks(mongoose.connection, redis),
  });
  server = app.listen(config.port, () =>
    logger.info("server.started", { port: config.port })
  );
  server.on("error", () => {
    logger.error("server.listen_failed");
    void shutdown(1);
  });
}

try {
  await start();
} catch {
  logger.error("server.startup_failed", {
    hint: "Check environment configuration and MongoDB/Redis availability",
  });
  await shutdown(1);
}
