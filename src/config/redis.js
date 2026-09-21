import { createClient } from "redis";
import { logger } from "../utils/logger.js";

export function createRedisClient(url) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) =>
        retries < 3 ? Math.min(200 * (retries + 1), 1000) : false,
    },
  });
  client.on("error", () => logger.error("redis.connection_error"));
  client.on("ready", () => logger.info("redis.connected"));
  return client;
}
