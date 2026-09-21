# TeamFlow backend

Express 5 API with MongoDB (Mongoose), Redis, explicit CORS origins, JSON request logging, centralized errors, and service health checks.

## Local setup

Use Node.js >=22.12 and Docker Desktop with Linux containers / Compose v2.

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --wait
npm run dev
```

If `.env` exists, add missing variables from `.env.example` without overwriting credentials. This Compose file is also usable from a standalone clone of this repository. Containers expose MongoDB and Redis only on localhost and use persistent named volumes.

`MONGO_URI` is the complete database URI, including its database name. For compatibility, `MONGODB_URI` is accepted when `MONGO_URI` is absent and uses the existing database name from `src/constants.js`. Defaults point to local Compose services. Production requires explicit `MONGO_URI`, `REDIS_URL`, and `CORS_ORIGIN`.

`CORS_ORIGIN` accepts comma-separated HTTP(S) origins, without trailing slashes. It defaults to `CLIENT_URL`, then `http://localhost:5173`. Wildcards are rejected because requests may use credentials. JWT variables in the example are reserved for Phase 02; existing legacy authentication still uses its original environment names and is not Phase 02-complete.

The backend loads `.env` relative to this repository, independently of the shell's current directory. It listens on port 8000 by default after both dependencies connect. Failures exit nonzero with redacted logs; SIGINT/SIGTERM close the server and clients.

## Health API

| Method | Path                 | Checks            |
| ------ | -------------------- | ----------------- |
| GET    | /api/health          | MongoDB and Redis |
| GET    | /api/health/database | MongoDB ping      |
| GET    | /api/health/redis    | Redis ping        |

Healthy responses use HTTP 200; unavailable or timed-out dependencies use 503. Response example:

```json
{
  "status": "ok",
  "services": { "database": "up", "redis": "up" },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

Checks have a 1.5-second response deadline and do not disclose connection strings. Redis has a bounded retry policy; restart the backend after a prolonged outage.

## Commands

- `npm start`: run the backend.
- `npm run dev`: restart on source changes.
- `npm run lint`: ESLint.
- `npm test`: Node test runner and HTTP integration tests with dependency doubles.
- `npm run build`: syntax validation of plain JavaScript source.
- `npm run format:check` / `npm run format`: Prettier check / format.
- `docker compose down`: stop services, retaining database volumes.

## Structure

`src/config`, `controllers`, `middleware`, `routes`, `services`, `repositories`, `models`, `errors`, and `utils` separate concerns. Existing `middlewares/` contains legacy authentication/upload middleware. `src/utils/ApiError.js` re-exports the shared error class for compatibility.

Existing `/api/v1/users` code is retained for later review. Its nonexistent channel-profile handler was removed to allow startup. Authentication, authorization, and uploads are not certified by Phase 01.

See [decisions](docs/DECISIONS.md) and [phase report](docs/phase-reports/PHASE-01-REPORT.md).
