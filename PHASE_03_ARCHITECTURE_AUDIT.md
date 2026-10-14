# PHASE 03 — Architecture and system-design audit

Project: Nirapad Transit (AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh)

Phase 02 was left in place. This phase audited the **existing** codebase, documented the real architecture, and applied only small authorization/layering fixes. No stack migration. No microservices. No new roles. No fake AI.

Canonical map: `docs/system-architecture.md`.

Honesty labels: **IMPLEMENTED** · **PARTIAL** · **EXPERIMENTAL** · **FUTURE**.

---

## 1. Project structure (what exists)

```
frontend/src/app/{admin,government,police,brta,owner,driver,passenger,login,register}
frontend/src/components/{AppShell,DashboardView,ResourceTable,pages/SimplePages,map}
frontend/src/lib/{api,auth,socket,nav,types}
backend/src/{app,index,config,lib,middlewares,routes,services,utils}
backend/prisma/{schema.prisma,migrations,seed.ts}
gps-simulator/src/index.ts
mobile/lib          (no android/ios)
ml/                 (synthetic ETA scripts)
docker-compose.yml
```

There are **no** dedicated controllers, repositories, or frontend `hooks/` folders. Express route files act as controllers. Prisma is the model layer.

---

## 2. Technology stack (from packages / config)

### Frontend

| Item | Actual |
| --- | --- |
| Framework | Next.js ^14.2 (production build reported **14.2.35**), App Router |
| UI | React ^18.3 |
| CSS | Tailwind CSS ^3.4 + PostCSS / Autoprefixer |
| Icons / charts | lucide-react, recharts |
| Maps | Leaflet ^1.9.4 + react-leaflet ^4.2 + OSM tiles |
| HTTP | native `fetch` in `lib/api.ts` |
| State | React Context (`AuthProvider`) + local `useState` |
| Realtime client | socket.io-client ^4.8 |
| Tests | **none** (script is `tsc --noEmit`) |

### Backend

| Item | Actual |
| --- | --- |
| Runtime | Node.js >= 20 (Dockerfile node:22) |
| Framework | Express ^4.21 |
| Auth | JWT access + refresh (`jsonwebtoken` ^9, bcryptjs ^3) |
| Authorization | `ROLE_PERMISSIONS` in code + `requirePermission` |
| Validation | Zod ^3.24 |
| API | REST `/api/*` + `{ success, message, data }` |
| Realtime | Socket.IO ^4.8 |
| Tests | Vitest ^3.1 + Supertest |
| Logging | Winston |

### Database

PostgreSQL 16, Prisma ^6.6, relational schema with FKs, unique keys, soft `deletedAt`, GPS latest + history.

### Infrastructure

Docker Compose (db, redis unused, backend, frontend, simulator profile). dotenv. File `UPLOAD_DIR`. No cache, no queue, no object storage.

---

## 3. Architecture pattern

**Modular monolith + layered Express routes.**

Not microservices. Not Clean Architecture. Not a separate MVC controller package.

**Recommendation (CURRENT):** keep this shape. A national-sounding title is not a reason to split services.

---

## 4. Data-flow audit

Traced paths:

1. Login — UI → POST `/auth/login` → Zod → `auth.service` → users + refresh_tokens → JWT JSON  
2. Register — same, passenger role only  
3. Role verification — JWT payload + backend `requirePermission`; UI `AppShell` is cosmetic  
4. Vehicle registration — POST `/buses` + `buses.manage` + owner company check  
5. Driver registration — POST `/drivers` + `drivers.manage`  
6. Route creation — POST `/routes` + `routes.manage`; GET `/routes` public  
7. Trip creation — POST `/trips/start` + `trips.own` + assigned-bus check (Phase 03)  
8. GPS submit — POST `/gps/location` + `gps.ingest` + driver assignment check (Phase 03); simulator uses SUPER_ADMIN  
9. GPS retrieve — GET live/nearby/location with PUBLIC/OPERATIONAL DTO  
10. Passenger tracking — `/gps/live` + `bus:location` (simulated samples)  
11. Admin monitoring — analytics + ops socket rooms  
12. SOS — POST `/sos` → DB + `sos:new`  
13. API request — helmet/CORS/limiter/auth/RBAC/Zod → handler → envelope  
14. Persistence — Prisma transactions on ingest; no outbox/queue  

Duplication remaining: Prisma queries still live in several route files (fleet, trips, platform). That is acceptable for this monolith size.

---

## 5. Role and permission architecture

Seven roles only. **No Fleet Manager role added.**

Backend remains authoritative. Phase 03 closed gaps where UI hid data but the API leaked it:

- Passenger `GET /trips` → 403  
- Passenger `GET /buses` strips `gpsDevice`  
- Driver `GET /buses` = assigned buses only  
- Driver GPS ingest / trip start-end = assigned bus/trip only  
- Notification mark-read and favorite delete = owner user only  
- Owner analytics series/tables scoped to company  

Frontend `AppShell` still cannot replace API checks (tokens are in localStorage, so Next middleware cannot see them).

---

## 6. GPS architecture

| Question | Fact |
| --- | --- |
| Source today | **SIMULATED** — `gps-simulator` posts REST samples |
| Hardware | **NOT CONNECTED** |
| Browser GPS | Not used for fleet tracking |
| Validation | lat/lng/speed/heading Zod; timestamp must be ISO datetime |
| Auth | ingest requires JWT + `gps.ingest` |
| Driver ownership | assigned bus only (Phase 03) |
| Simulator | SUPER_ADMIN, all buses |
| History | append-only `gps_locations`; latest upsert |
| Nearby | SQL bbox + haversine |
| Real vs simulated | `source` / `dataLabel`; default SIMULATION |

---

## 7. Real-time architecture

**Socket.IO** (WebSocket transport). Dashboards also do an initial REST `/gps/live` fetch.

Classification: **NEAR REAL-TIME** over a **SIMULATED** source (typically 2 s ticks). Not a hardware telemetry bus. Not SSE. No guaranteed replay.

---

## 8. Database architecture

Users ↔ roles, companies ↔ buses/drivers, buses ↔ routes/trips/GPS, SOS/complaints/alerts/notifications/audit.

Indexes exist for live GPS, history, trips, alerts, SOS, complaints, notifications, audit. Soft delete on core entities. `role_permissions` is not runtime auth.

Justified change this phase: none to the schema (Phase 02 migrations remain).

---

## 9. API architecture

REST, resource names, envelope unchanged. Auth/RBAC/Zod/limiters from Phase 02. Pagination on users/buses. Filtering is ad hoc (query params on some lists). Sorting is mostly `createdAt`/`registrationNo`.

---

## 10. Frontend architecture

Role-prefixed App Router pages, most wrapping `SimplePages` / `ResourceTable`. Protected UI is client-only. Forms: login/register + a few ops pages. Loading/error: table + dashboard only. Maps: `LiveMap` / `LiveMapInner`. **PARTIAL** admin write UI (APIs exist, pages are mostly read-only).

---

## 11. Backend architecture

| Layer | Present |
| --- | --- |
| Routes | yes |
| Controllers | route handlers |
| Services | auth, gps, analytics, reports, sos, complaints, notifications |
| Repositories | no (Prisma) |

Fat routes remain on fleet/platform. Phase 03 did **not** extract them into a rewrite. Circular deps were not found.

---

## 12. Security architecture (high level)

Phase 02 controls kept. Additional least-privilege on trips, buses, ingest, notifications, favorites, analytics scope. JWT still in localStorage. Compose demo password still demo-only. Errors use generic 500 for unexpected failures.

---

## 13. Scalability (not national-ready)

| Area | Class | Note |
| --- | --- | --- |
| GPS history growth | FUTURE | documented retention, no job |
| Single-node Socket.IO | FUTURE | Redis adapter only if you scale out |
| In-memory rate limits / alert cooldown | FUTURE | per-process |
| Map markers | CURRENT | fine for demo fleet |
| Analytics counts | CURRENT | improved in Phase 02 |
| Notifications | CURRENT | per-user rows, no push gateway |
| Background jobs | FUTURE | none exist |

---

## 14. AI/ML architecture

| Module | Status |
| --- | --- |
| Rule-based ETA `GET /gps/buses/:id/eta` | IMPLEMENTED (heuristic) |
| Overspeed / deviation rules | IMPLEMENTED |
| `ml/` synthetic ETA training scripts | EXPERIMENTAL |
| Accident / fatigue / traffic / driver-risk models in API | FUTURE |

The live API does **not** load pickle/joblib models.

---

## 15. Problems and safe changes

### Critical (fixed this phase)

1. Authenticated passengers could list all trips.  
2. Drivers could ingest GPS for any `busId`.  
3. Drivers could start/end another driver’s trip if they guessed IDs.  
4. `GET /buses` leaked `gpsDevice` to passengers and listed the whole fleet to drivers.

### Medium (fixed or documented)

5. Notification read and favorite delete were not user-scoped — **fixed**.  
6. Owner analytics series/tables were global — **fixed**.  
7. JWT in localStorage — **documented**, not rewritten.  
8. Admin UI still read-only — **documented**.  
9. Prisma remains inside some routes — **accepted**.

### Minor

10. No frontend test suite.  
11. Unused Redis.  
12. `reportUrl` no longer appends a token (download uses Authorization header).

### Unnecessary complexity avoided

- No microservices, PostGIS, Redis adapter, new roles, or AI façade.

---

## 16. Tests

Executed after the changes (see section 17 of this file’s status block).

---

## Changes made

- `backend/src/utils/scope.ts` — driver/passenger/oversight helpers; assigned-bus assert  
- `backend/src/routes/gps.routes.ts` — driver ingest ownership; ISO timestamp  
- `backend/src/routes/fleet.routes.ts` — driver bus list/detail; passenger list DTO  
- `backend/src/routes/trip.routes.ts` — passenger deny; trip/bus ownership  
- `backend/src/routes/platform.routes.ts` — notification/favorite ownership; owner analytics  
- `backend/src/services/analytics.service.ts` — optional company scope  
- `frontend/src/lib/api.ts` — `reportUrl` does not put JWT in the query string  
- `backend/tests/security.test.ts` — trip/bus/ingest cases  
- `docs/system-architecture.md` — pattern, flows, stack, current vs future  
- `PHASE_03_ARCHITECTURE_AUDIT.md` — this report  

---

## Future recommendations (not started)

1. Admin/owner write UIs on existing APIs (likely Phase 04 if requested)  
2. Web-only httpOnly cookies; keep Bearer for Flutter + simulator  
3. GPS retention job after a signed policy  
4. Flutter platform folders  
5. Extract fleet/trip Prisma into services if those files keep growing  
6. Do not add government APIs, ticketing, or trained AI until those products exist  

---

## Final status

PHASE 03 STATUS:

Architecture Audit: **PASS**  
Frontend Architecture: **PASS** (PARTIAL write UI, client-only route gates)  
Backend Architecture: **PASS**  
Database Architecture: **PASS**  
API Architecture: **PASS**  
RBAC Architecture: **PASS**  
GPS Architecture: **PASS** (SIMULATION)  
Real-Time Architecture: **PASS** (NEAR REAL-TIME, simulated source)  
Security Architecture: **PASS** (IMPROVED, not production-claimed)  
AI/ML Architecture: **EXPERIMENTAL** (`ml/`) / **FUTURE** (API models)

Tests:  
Backend: **(run recorded below)**  
Frontend tests: **N/A** (no suite)  
Frontend typecheck/build: **(run recorded below)**  
Backend build: **(run recorded below)**

Production-ready: **NOT CLAIMED**  
National-scale: **NOT CLAIMED**  
Government integration: **NOT CLAIMED**  
Hardware GPS: **NOT CLAIMED**  
Trained AI: **NOT CLAIMED**

READY FOR PHASE 04: **YES** (do not start until asked)
