import { probe } from "../services/health.service.js";

export function createHealthController(checks) {
  return async (_req, res) => {
    const entries = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => [
        name,
        await probe(check),
      ])
    );
    const services = Object.fromEntries(entries);
    const healthy = entries.every(([, status]) => status === "up");
    res
      .set("Cache-Control", "no-store")
      .status(healthy ? 200 : 503)
      .json({
        status: healthy ? "ok" : "degraded",
        services,
        timestamp: new Date().toISOString(),
      });
  };
}
