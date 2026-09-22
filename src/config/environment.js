import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { ConfigurationError } from "../errors/ConfigurationError.js";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export function readEnvironment(source = process.env) {
  const nodeEnv = source.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new ConfigurationError(
      "NODE_ENV must be development, test, or production"
    );
  }
  const port = Number(source.PORT || 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError("PORT must be an integer from 1 to 65535");
  }
  const mongoUri =
    source.MONGO_URI ||
    source.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/teamflow";
  const redisUrl = source.REDIS_URL || "redis://127.0.0.1:6379";
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongoUri))
    throw new ConfigurationError("MONGO_URI must be a MongoDB connection URL");
  if (!/^rediss?:\/\//.test(redisUrl))
    throw new ConfigurationError("REDIS_URL must be a Redis connection URL");
  const clientUrl = source.CLIENT_URL || "http://localhost:5173";
  const origins = (source.CORS_ORIGIN || clientUrl)
    .split(",")
    .map((origin) => origin.trim());
  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new ConfigurationError(
        "CORS_ORIGIN must contain explicit HTTP(S) origins"
      );
    }
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      throw new ConfigurationError(
        "CORS_ORIGIN must contain explicit HTTP(S) origins without paths"
      );
    }
  }
  if (
    nodeEnv === "production" &&
    (!source.MONGO_URI || !source.REDIS_URL || !source.CORS_ORIGIN)
  ) {
    throw new ConfigurationError(
      "Production requires MONGO_URI, REDIS_URL, and CORS_ORIGIN"
    );
  }
  return Object.freeze({
    nodeEnv,
    port,
    mongoUri,
    redisUrl,
    clientUrl,
    origins,
  });
}
