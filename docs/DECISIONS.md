# Architecture decisions

## Phase 01 — 2026-09-21

1. **Keep two repositories.** The workspace already has separately published `Backend/` and `Frontend/` repositories. Retain their names and history instead of the proposed `client/` / `server/` monorepo. Root scripts and Compose simplify local work; each repository remains independently installable. Shared packages and CI are deferred until needed. The monorepo acceptance item is an explicit deviation for review.
2. **Preserve existing code.** Keep legacy user routes and auth/upload helpers for Phase 02 review. Remove only the nonexistent channel-profile import/route that prevented startup, plus unused bindings required by lint. This does not certify or complete authentication.
3. **Separate app creation from startup.** `createApp` accepts validated configuration and health checks; tests do not connect to live services. The entry point owns client lifecycle and startup failure handling.
4. **Use complete MongoDB URIs.** New configuration uses `MONGO_URI`. The legacy `MONGODB_URI` alias retains the original database name. The user's existing `.env` is not overwritten or printed.
5. **Require both services at startup.** MongoDB and Redis must connect before listening. Readiness endpoints ping dependencies and return 503 on failure or timeout. Redis retries are bounded; a long outage can require a backend restart. More extensive fallback/caching belongs to Phase 06.
6. **Log safe metadata.** Foundation logging records event names, generated request IDs, method, status, and elapsed time. It does not log request bodies, cookies, tokens, connection strings, or raw infrastructure errors.
7. **Keep local infrastructure minimal.** Compose runs MongoDB 7 and Redis 7 with health checks, persistent volumes, and loopback-only ports. App containers and CI/CD remain Phase 08 work.
8. **Test observable behavior.** Backend tests cover HTTP status/contracts, CORS, errors, configuration, dependency outages/timeouts, and startup failure. Frontend tests cover user-visible states and retry/navigation. Live Compose verification must be performed separately.
9. **Keep phase records available in Git.** Root `docs/` provides the requested workspace reports. Matching copies live in `Backend/docs/` because the workspace root has no Git repository.

## References

- [Express error handling](https://expressjs.com/en/guide/error-handling/)
- [node-redis connections](https://redis.io/docs/latest/develop/clients/nodejs/connect/)
