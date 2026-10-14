# PHASE 02 — Architecture verification and foundation hardening

Project: Nirapad Transit (AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh)

This phase did **not** rebuild the stack, migrate frameworks, or add ticketing, fare, CCTV, accident prediction, fatigue detection, traffic prediction, government/BRTA APIs, or hardware GPS.

Honesty labels used below: **IMPLEMENTED** · **PARTIAL** · **EXPERIMENTAL** · **FUTURE**.

---

## 1. Architecture summary

Verified as actually present:

| Layer | What exists | Status |
| --- | --- | --- |
| Web | Next.js 14 App Router, React 18, role-prefixed routes, Leaflet/OSM maps | IMPLEMENTED |
| Auth UI | JWT in `localStorage`, `/auth/me` after login, client `AppShell` role gates | IMPLEMENTED |
| API | Express 4, Zod, `{ success, message, data }`, services + Prisma | IMPLEMENTED |
| Realtime | Socket.IO `bus:location`, `bus:location:ops`, `alert:new`, `sos:new`, `notification:new` | IMPLEMENTED |
| Database | PostgreSQL 16, Prisma 6, soft deletes, GPS latest + history | IMPLEMENTED |
| RBAC | Seven roles; runtime matrix in code | IMPLEMENTED |
| GPS | Simulator ingest, live/nearby/ETA, overspeed/deviation rules | IMPLEMENTED (SIMULATION) |
| Mobile | Flutter screens in `mobile/lib` only | PARTIAL |
| ML | Synthetic ETA scripts in `ml/` | EXPERIMENTAL |
| Redis | Compose service only | unused |
| Admin CRUD UI | Mostly read-only table pages | PARTIAL |

Canonical map: `docs/system-architecture.md`.

This deployment is **not** production-ready, national-deployment-ready, government-integrated, hardware-GPS-integrated, or an implemented AI predictor.

---

## 2. Security changes

### Live GPS (P0)

Public passenger tracking stays available. Operational internals are no longer on unauthenticated responses.

| Endpoint | Decision |
| --- | --- |
| GET `/api/gps/live` | Public PUBLIC DTO; operational roles get OPERATIONAL DTO |
| GET `/api/gps/nearby` | Same + bbox in PostgreSQL then haversine |
| GET `/api/gps/buses/:id/location` | Same; owners see operational fields only for their company |
| GET `/api/gps/buses/:id/eta` | Public rule-based prototype (no driver/device dump) |
| GET `/api/gps/source-mode` | Public honesty note |
| GET `/api/gps/buses/:id/history` | Auth + `buses.read`; non-ops lose device/driver/trip fields |
| POST `/api/gps/location` | Auth + `gps.ingest` (unchanged) |

PUBLIC DTO: `projection`, `busId`, `registrationNo`, lat/lng, speed, heading, timestamp, `statusColor`, `routeName`, `dataLabel`.

OPERATIONAL DTO adds: `deviceId`, `routeId`, `driverId`, `tripId`, `companyId`, `allowedSpeed`, `operationalStatus`.

**Mount-order bug found and fixed:** `fleet.routes` is mounted at `/api` with `router.use(authRequired)`. That middleware ran before GPS routes and returned **401** for public GPS. GPS and public `/routes` are now registered first.

Owner isolation: GET/PUT/DELETE bus and driver by id now use `assertOwnerScope`. Passenger bus detail no longer returns device/trip/driver ids on `latestLoc`. Passenger GET `/complaints/:id` cannot read another passenger’s complaint.

Socket.IO: invalid JWT is treated as anonymous (map still works); `subscribe` cannot join another user’s room or an ungranted role room. `bus:location:ops` is emitted only to operational role rooms.

---

## 3. RBAC decision

**Runtime authority:** `ROLE_PERMISSIONS` in `backend/src/utils/permissions.ts`.

**Kept:** `role_permissions` table (seed / future admin UI). It is **not** read at request time.

Least privilege is unchanged for the seven roles: only SUPER_ADMIN has `users.manage`, `settings.manage`, `audit.read`, `simulator.control`. Police get SOS/alert manage, not user admin. BRTA gets verification reads, not SOS dispatch. Owners get fleet writes for their company only. Drivers/passengers do not get analytics or user admin.

Full matrix: `docs/system-architecture.md` §6.

---

## 4. JWT decision

**No httpOnly cookie migration in this phase.**

A cookie cutover would break:

- Flutter `mobile/lib` Bearer client
- GPS simulator login + `Authorization` header
- Socket.IO `auth.token`
- Existing `localStorage` session + refresh flow

Verified / hardened without rewrite:

| Item | Status |
| --- | --- |
| Access expiry | `JWT_EXPIRES_IN` default 8h |
| Refresh expiry | `JWT_REFRESH_EXPIRES_IN` default 7d |
| Refresh rotation | Used refresh row is revoked; a new pair is issued |
| Logout | All unrevoked refresh rows revoked |
| Unauthorized | 401 on protected routes |
| Token logs | Winston redacts token/jwt/secret/password/authorization keys |

Residual risk: XSS on the web origin can read `nt_access` / `nt_refresh`. Report download helper can still put a token in a query string (`reportUrl`). Cookie + CSRF migration is a later dedicated phase.

---

## 5. Rate-limit changes

GPS ingest is **no longer skipped**. Limits are endpoint-specific so 16 buses at 2 s (~480/min) stay viable.

| Scope | Limit | Notes |
| --- | --- | --- |
| Auth (`/api/auth/*`) | 30 / 15 min / IP | Brute-force control |
| GPS ingest POST `/gps/location` | 2400 / min / IP | Headroom vs ~480/min demo fleet |
| GPS read live/nearby/location/eta | 180 / min / IP | Polling |
| SOS POST | 15 / 15 min / IP | Abuse control |
| Complaints POST | 30 / 15 min / IP | Abuse control |
| General API | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` (example 2000 / 15 min) | Skips `/api/auth` and `/api/gps` (those use dedicated limiters) |

Implemented in `backend/src/middlewares/rateLimits.ts`. In-memory store (not Redis).

---

## 6. Database migration status

| Step | Result |
| --- | --- |
| Inspected schema vs existing `nirapad_transit` | Compatible (originally created with `db push`) |
| Created `backend/prisma/migrations/` | `20260905000000_init` + `20260905000001_gps_latest_geo_index` |
| `prisma migrate reset` / volume delete | **Not used** |
| Existing DB | `migrate resolve --applied 20260905000000_init` then `migrate deploy` |
| Current DB | `prisma migrate status` → up to date; `migrate diff` datasource vs schema → no difference |
| `prisma validate` | Passed |
| Fresh empty instance from history | SQL generated with `migrate diff --from-empty`. A second blank Postgres was **not** stood up in this session |
| Docker backend | `CMD` now `prisma migrate deploy` (was `db push`) |

---

## 7. Database optimization

- Nearby: bounding box on `gps_latest_locations.latitude/longitude` in SQL, then haversine refine (no PostGIS)
- New indexes: `(latitude, longitude)` and `(timestamp)` on `gps_latest_locations`
- Analytics series: per-day `count` queries + `complaint.groupBy` instead of loading 7 days of trip/alert/complaint rows into Node
- Existing indexes on buses, routes, trips, alerts, SOS, complaints, notifications, audit logs left in place

---

## 8. GPS architecture

- Simulator → POST `/api/gps/location` → history insert + latest upsert → rules → Socket.IO
- Public vs operational DTOs as above
- Nearby no longer loads the full latest table when a radius is supplied
- History growth: documented in `docs/gps-retention.md` — **no automatic delete**
- Source in this project: **SIMULATION**. DEVICE mode is a config flag only; no hardware feed is connected

---

## 9. Socket.IO architecture

| Event | Audience |
| --- | --- |
| `bus:location` | All sockets in `public:buses` (PUBLIC DTO) |
| `bus:location:ops` | SUPER_ADMIN, GOVERNMENT, BRTA, POLICE, TRANSPORT_OWNER |
| `alert:new` | Same operational roles |
| `sos:new` | SUPER_ADMIN, GOVERNMENT, POLICE |
| `notification:new` | `user:{id}` |

No Redis adapter (single node). No guaranteed replay on reconnect. Client-initiated `subscribe` is authorization-checked.

---

## 10. Docker / infrastructure findings

| Item | Finding |
| --- | --- |
| Service deps | Backend waits for Postgres healthcheck |
| Redis | Image + port + healthcheck; **application does not use it** |
| Simulator | `profiles: [sim]`; needs JWT user with `gps.ingest` |
| Secrets | Compose still uses demo password `nirapad_demo_only` (documented). Do not treat as production |
| `.env.example` | Aligned with demo DB URL + rate-limit comments |
| Backend image | Needs `prisma.config.ts` in the image (copied); starts with `migrate deploy` |
| Flutter | No android/ios folders; `flutter create .` not run (SDK not assumed) |

---

## 11. API contract findings

Envelope `{ success, message, data }` is unchanged.

| Case | Status |
| --- | --- |
| Validation | 422 + Zod flatten |
| Auth missing/invalid | 401 |
| Forbidden | 403 |
| Not found | 404 (including complaint-by-id) |
| Server / Prisma init | 500 |

Live/nearby `data` is `{ projection, dataLabel, items }` — the web client already expected `items`.

---

## 12. Tests executed

- Backend Vitest (`npm test` in `backend/`)
- Backend `tsc --noEmit` and `npm run build`
- Frontend `tsc --noEmit` and `next build`
- `prisma validate`
- `prisma migrate status` + schema/datasource diff

Added: `tests/gps-dto.test.ts`, `tests/security.test.ts`, expanded `tests/permissions.test.ts`.

Vitest previously defaulted `DATABASE_URL` to a fake `nirapad_transit_test` URL, which hid `.env` and made HTTP login tests fail. Config now loads the project `.env`.

---

## 13. Test results

**30 / 30 backend tests passed.**

Covered in HTTP tests against the seeded demo DB:

- Unauthenticated `/gps/source-mode` and `/gps/live` → PUBLIC, no `deviceId`/`driverId`/`tripId`
- Unauthenticated SOS and analytics → 401
- PASSENGER → PUBLIC GPS, `/users` 403, `/settings` 403
- DRIVER → PUBLIC GPS, `/users` 403, `/analytics/overview` 403
- POLICE → `/sos` 200, `/users` 403, OPERATIONAL GPS
- BRTA → `/buses` 200, SOS status update not 200 (403/404/422)
- SUPER_ADMIN → `/users` 200, `/settings` 200, OPERATIONAL GPS

Frontend production build: compiled, 65 static pages generated.

No Socket.IO automated suite existed; behavior was reviewed in code only.

---

## 14. Files modified

**Created**

- `backend/src/utils/gpsDto.ts`
- `backend/src/middlewares/rateLimits.ts`
- `backend/tests/gps-dto.test.ts`
- `backend/tests/security.test.ts`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20260905000000_init/migration.sql`
- `backend/prisma/migrations/20260905000001_gps_latest_geo_index/migration.sql`
- `docs/system-architecture.md`
- `docs/gps-retention.md`
- `PHASE_02_ARCHITECTURE_VERIFICATION.md`

**Updated**

- `backend/src/app.ts` — limiter split; GPS/routes mounted before fleet auth
- `backend/src/routes/gps.routes.ts` — DTO projection, per-route limits, owner downgrade
- `backend/src/routes/fleet.routes.ts` — owner scope on bus/driver mutations; passenger latestLoc strip
- `backend/src/routes/safety.routes.ts` — SOS/complaint limiters; complaint-by-id 404/403
- `backend/src/services/gps.service.ts` — DTO broadcast; bbox nearby
- `backend/src/services/analytics.service.ts` — count-based series
- `backend/src/services/auth.service.ts` — refresh rotation
- `backend/src/lib/socket.ts` — rooms, ops event, subscribe guard
- `backend/src/utils/permissions.ts` — runtime-authority comment
- `backend/src/utils/scope.ts` — `assertOwnerScope`
- `backend/prisma/schema.prisma` — latest-location indexes
- `backend/Dockerfile` — `migrate deploy` + `prisma.config.ts`
- `backend/vitest.config.ts` — load real `.env`
- `backend/tests/permissions.test.ts`
- `docker-compose.yml` — Redis healthcheck
- `.env.example` — rate-limit notes
- `docs/architecture.md`, `docs/api.md`, `docs/database.md`, `docs/deployment.md`, `docs/gps-tracking.md`

---

## 15. Remaining risks

1. Web JWT still in `localStorage` (XSS)
2. Report URL helper can place an access token in a query string
3. `role_permissions` can drift from code if someone edits only the database
4. GPS history still grows without a job (`docs/gps-retention.md`)
5. Redis unused — no shared rate-limit or Socket.IO scale-out
6. Owner live list still includes other companies as PUBLIC points (intentional for maps)
7. Government/BRTA/Police operational GPS is fleet-wide (no agency-level data partition)
8. Admin/owner UIs remain largely read-only tables
9. Flutter platform folders missing — cannot `flutter run` without `flutter create .`
10. Compose demo password is hardcoded; not a production secret store
11. In-memory rate limits and alert cooldowns do not work across multiple API processes
12. No automated Socket.IO tests
13. Fresh-DB `migrate deploy` on an empty volume was not executed in a second container this session

---

## 16. Recommended Phase 03

Stop here for Phase 02. Suggested next (choose explicitly):

1. Admin/owner write UIs (create/update buses, drivers, routes) on the existing APIs
2. httpOnly cookie session for **web only**, keep Bearer for Flutter + simulator
3. GPS retention job (hot 7-day window) after stakeholder sign-off
4. Flutter `flutter create .` + wire existing `lib` screens
5. Owner/agency scoped operational GPS rooms (not a Redis adapter unless you scale out)
6. Do **not** start ticketing, CCTV, fare, or government APIs until the above foundation items are chosen

---

## 17. Final status

PHASE 02 STATUS: **COMPLETED**

SECURITY: **IMPROVED**

DATABASE MIGRATION: **COMPLETED**

RBAC: **VERIFIED**

GPS SECURITY: **FIXED**

API: **VERIFIED**

TESTS: **PASS** (30/30 backend; frontend build succeeded)

READY FOR PHASE 03: **YES**

Do not proceed into Phase 03 until you ask for it.

---

## Completion summary

Phase 02 hardened the existing Nirapad Transit foundation without a rewrite. Live GPS is now split into a passenger-safe PUBLIC DTO and a role-gated OPERATIONAL DTO; a fleet-router mount bug that 401’d public GPS was fixed. JWT stays in localStorage (cookie migration would break Flutter, the simulator, and Socket.IO). Refresh tokens now rotate. Rate limits cover ingest and live reads without blocking a 16-bus / 2 s simulator. RBAC runtime remains the code matrix. Prisma now has a real migration history on the existing database (no reset). Nearby uses a SQL bbox; analytics series no longer loads week-long row sets. Architecture, retention, and this report document what is implemented versus future.
