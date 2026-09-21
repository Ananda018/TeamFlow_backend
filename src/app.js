import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import userRouter from "./routes/user.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { ApiError } from "./errors/ApiError.js";

export function createApp({ config, checks }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.origins.includes(origin))
          return callback(null, true);
        callback(new ApiError(403, "Origin is not allowed"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ limit: "16kb", extended: true }));
  app.use(cookieParser());
  app.use("/api/health", createHealthRouter(checks));
  // Preserve existing routes; authentication redesign belongs to Phase 02.
  app.use("/api/v1/users", userRouter);
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
