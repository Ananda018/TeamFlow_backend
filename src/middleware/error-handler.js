import { ApiError } from "../errors/ApiError.js";
import { logger } from "../utils/logger.js";

export function notFound(_req, _res, next) {
  next(new ApiError(404, "Route not found"));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof ApiError ? error.statusCode : 500;
  let message =
    error instanceof ApiError && status < 500
      ? error.message
      : "Internal server error";
  if (error.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  }
  if (error.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large";
  }
  if (status >= 500)
    logger.error("http.error", { requestId: req.requestId, status });
  res
    .status(status)
    .json({ success: false, message, requestId: req.requestId });
}
