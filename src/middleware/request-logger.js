import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  req.requestId = randomUUID();
  res.set("X-Request-Id", req.requestId);
  const start = performance.now();
  res.on("finish", () =>
    logger.info("http.request", {
      requestId: req.requestId,
      method: req.method,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - start),
    })
  );
  next();
}
