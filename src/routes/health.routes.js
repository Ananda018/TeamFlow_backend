import { Router } from "express";
import { createHealthController } from "../controllers/health.controller.js";

export function createHealthRouter(checks) {
  const router = Router();
  router.get("/", createHealthController(checks));
  router.get(
    "/database",
    createHealthController({ database: checks.database })
  );
  router.get("/redis", createHealthController({ redis: checks.redis }));
  return router;
}
