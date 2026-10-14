# PHASE 03 — DATABASE & DATA MODEL VERIFICATION

Project: Nirapad Transit — AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh.

This phase inspected the **existing** PostgreSQL + Prisma schema. No database rebuild, no reset, no volume delete, no table drops, no PostGIS.

Honesty labels: **IMPLEMENTED** · **PARTIAL** · **MISSING** · **NOT REQUIRED** · **FUTURE** · **EXPERIMENTAL**.

---

## 1. Executive Summary

The schema already models users, seven roles, operators, buses, drivers, routes/stops, trips, GPS latest + history, SOS, alerts, complaints, notifications, and audit logs. Live integrity checks on the current demo database found **no duplicate keys, no orphan FK candidates, and no out-of-range GPS coordinates**.

Justified Phase 03 change: add missing foreign keys and lookup indexes so historical GPS/SOS/complaints cannot silently dangle, and so a hard-delete of a bus cannot wipe GPS history (RESTRICT). Application checks now also block a second in-progress trip for the same driver, and trip list/detail requires an operational permission (passengers no longer list trips via `buses.read`).

Lost & Found is **not** in the schema and was **not** invented. Analytics snapshots and accidents exist as tables but are unused. Runtime RBAC remains the code matrix from Phase 02.

This database is **not** production-ready, national-scale, government-integrated, or hardware-GPS-backed.

---

## 2. Database Technology

| Item | Value | Status |
| --- | --- | --- |
| Engine | PostgreSQL 16 | IMPLEMENTED |
| ORM | Prisma 6 | IMPLEMENTED |
| Migrations | `backend/prisma/migrations/` (3) | IMPLEMENTED |
| Host | `DATABASE_URL` from env | IMPLEMENTED |
| Raw SQL in app | None (`$queryRaw` only in the integrity script) | IMPLEMENTED |
| Redis | Compose only | unused |
| PostGIS | Not installed | NOT REQUIRED at current scale |

---

## 3. Prisma Schema Summary

**Enums (16):** RoleCode, UserStatus, LicenseStatus, FitnessStatus, RegistrationStatus, InsuranceStatus, BusOperationalStatus, TripStatus, AlertType, AlertSeverity, AlertStatus, SosStatus, ComplaintCategory, ComplaintStatus, NotificationType, GpsDataSource, DataSourceLabel, AccidentSeverity, VehicleType.

**Models (29 mapped tables):** User, Role, Permission, UserRole, RolePermission, RefreshToken, Passenger, PassengerFavorite, Driver, DriverDocument, TransportCompany, Bus, GpsDevice, Route, RouteStop, BusAssignment, DriverAssignment, Trip, GpsLocation, GpsLatestLocation, Alert, SosRequest, Complaint, Accident, Violation, Notification, AnalyticsSnapshot, AuditLog, SystemSetting.

### Model inventory

**User** — Identity. PK `id`. Unique email/phone. Soft delete + status. Relations: roles, passenger, driver, owned company, notifications, audit, SOS, complaints, favorites, refresh tokens. Indexes: status, deletedAt. Issue: none critical; passwordHash must never be selected in public APIs (list/detail already omit it).

**Role** — Named RoleCode. PK `id`. Unique `code`. Relations: user_roles, role_permissions.

**Permission** — String code. Unique `code`. Seeded; not runtime auth.

**RolePermission** — Composite PK (roleId, permissionId). Cascade if role/permission deleted. Seed mirror only.

**UserRole** — Composite PK (userId, roleId). Cascade with user/role.

**RefreshToken** — Hashed refresh. Index userId + tokenHash (Phase 03). Cascade with user.

**Passenger** — 1:1 user. Optional emergency contact. Soft delete. Cascade with user.

**PassengerFavorite** — user + optional route/bus. Cascade.

**Driver** — 1:1 user, unique license, optional company. `nidReference` demo-only. Soft delete. Cascade user delete blocked in practice if trips exist (RESTRICT).

**DriverDocument** — Child of driver, cascade.

**TransportCompany** — Operator. Unique registration. Optional unique ownerUserId. Soft delete.

**Bus** — Vehicle. Unique registrationNo and optional gpsDeviceId. Required company. Optional route/driver. Soft delete. Company/route/driver default Restrict/SetNull as optional.

**GpsDevice** — Simulator serials today. Unique serialNumber. Soft delete.

**Route** — Unique code, polyline JSON, stops, optional company, isDemo. Soft delete.

**RouteStop** — Unique (routeId, sequence). Cascade with route.

**BusAssignment / DriverAssignment** — History of assignments. Phase 03 added route/bus FKs (Restrict).

**Trip** — bus + driver + route required (Restrict). Status, times, speeds. No DB unique for one open trip.

**GpsLocation** — History. Phase 03: bus Restrict; trip/driver/route SetNull. Indexes (bus,time), (trip,time), (route,time).

**GpsLatestLocation** — PK busId. Cascade with bus (snapshot). Geo + timestamp indexes.

**Alert** — Optional bus/driver/trip/route SetNull. Indexes type+status, createdAt, busId.

**SosRequest** — Required user Restrict; optional bus/trip SetNull. Indexes status+created, user, bus.

**Complaint** — Required passenger; optional bus/driver SetNull. No trip/priority.

**Accident** — Optional bus. Unused in operations.

**Violation** — Written by overspeed/deviation rules.

**Notification** — Cascade with user.

**AnalyticsSnapshot** — Unique (metricKey, metricDate). Unused (0 rows).

**AuditLog** — Optional user. Indexes createdAt, userId, entity+id.

**SystemSetting** — Key/value. Demo keys only.

---

## 4. Entity Inventory

| Conceptual entity | Verdict |
| --- | --- |
| User | IMPLEMENTED |
| Role | IMPLEMENTED |
| Permission | IMPLEMENTED |
| Role Permission | IMPLEMENTED (seed only) |
| Bus / Vehicle | IMPLEMENTED |
| Driver | IMPLEMENTED |
| Transport Owner / Operator | IMPLEMENTED |
| Route | IMPLEMENTED |
| Route Stop | IMPLEMENTED |
| Trip | IMPLEMENTED |
| GPS Location | IMPLEMENTED |
| Latest GPS Location | IMPLEMENTED |
| SOS / Emergency | IMPLEMENTED (no responder column) |
| Alert | IMPLEMENTED |
| Complaint | IMPLEMENTED (no trip/priority/assignee) |
| Lost & Found | MISSING (not added) |
| Notification | IMPLEMENTED |
| Audit Log | IMPLEMENTED |
| Analytics-related | PARTIAL (live counts; snapshot table empty) |

---

## 5. Relationship Verification

Expected Trip chain **Vehicle → Trip → Route → GPS** exists: Trip requires bus/driver/route; `gps_locations.tripId` optional; latest GPS is per bus.

Gaps closed in Phase 03: GPS history had no bus/driver/route FKs; SOS had no bus/trip FKs; complaint had no driver FK; assignment tables lacked the other-side FK.

Still application-only: one open trip per bus/driver (no partial unique index — Prisma cannot express it without raw SQL drift).

---

## 6. User/RBAC Data Model

All seven roles exist (`roles.code` unique). 28 permission codes, 83 role_permission rows matching the code matrix after seed.

**Runtime source of truth remains `ROLE_PERMISSIONS`.** The table is a documented duplicate, not a second authorizer.

Ownership: `transport_companies.ownerUserId` unique optional. Owner APIs scope by that company.

---

## 7. Vehicle/Driver Model

Registration unique. Company required. Driver/route optional. Status enums cover active/inactive/maintenance/offline plus fitness/registration/insurance.

Driver 1:1 user, unique license. Current vehicle via `buses.driverId`. No separate “emergency contact” on Driver (passenger profile has it). `nidReference` stored as `DEMO-NID-REDACTED` in seed — do not treat as a real NID.

---

## 8. Route/Trip Model

Routes support visualization (`polyline` + stops), deviation (distance to polyline), and rule-based ETA without redesign.

Trip start/end exist. Multiple IN_PROGRESS trips for one bus/driver are blocked in the start handler (bus since earlier; driver added this phase). Database does not enforce it.

`GET /trips` previously had **no permission middleware** (any logged-in user). It now requires `trips.own` OR `trips.manage` OR `analytics.read`.

---

## 9. GPS Data Model

Simulation-based ingest. Fields match the simulator payload. Lat/lng ranges enforced at ingest (Zod). Current 29,634 history rows and 16 latest rows: all in range, no orphans.

Latest uniqueness: PK `busId`. History growth: unbounded (documented; not deleted).

`deviceId` on GPS rows is a string (simulator / bus.gpsDeviceId), **not** a FK to `gps_devices`. Intentional — ingest can send a serial without a device row.

---

## 10. SOS/Emergency Model

Preserves timestamp, location, status, message, user, optional bus/trip. Priority/severity is on the linked Alert (CRITICAL). No dedicated responder field. User delete cannot cascade-wipe SOS (Restrict). Bus delete SET NULLs `busId` and keeps the SOS.

---

## 11. Complaint Model

Complainant, category, description, optional vehicle/driver/geo, status, resolution, resolver, timestamps. No trip, priority, or assigned-authority columns. Passenger can list/read only own complaints.

---

## 12. Notification Model

Recipient, type, title, body, payload, readAt. Indexed for inbox and unread queries. 533 rows in the demo DB (alert fan-out).

---

## 13. Audit Log Model

Actor, action, entity, entityId, IP, user-agent, metadata. Used for user/fleet writes; Phase 03 also logs SOS/alert/complaint status changes. 2 rows before those new actions. Does not log GPS points or passwords.

---

## 14. Index Review

Already present for bus/route/trip/alert/SOS/complaint/notification/audit and latest lat/lng.

**Added (Phase 03):** `refresh_tokens.tokenHash`, `sos_requests.busId`, `complaints.driverId`, `gps_locations(routeId, timestamp)`, `bus_assignments.routeId`.

Nearby remains bbox + haversine — acceptable for the current 16-bus fleet. PostGIS is FUTURE.

---

## 15. Foreign Key & Cascade Review

| Link | onDelete | Intent |
| --- | --- | --- |
| GpsLocation.bus | RESTRICT | Keep history if someone tries to hard-delete a bus |
| GpsLatestLocation.bus | CASCADE | Latest snapshot dies with the bus |
| GpsLocation.trip/driver/route | SET NULL | History survives trip/driver/route removal |
| SosRequest.user | RESTRICT | Emergencies survive only via soft-delete of users |
| SosRequest.bus/trip | SET NULL | Keep SOS without the vehicle |
| Complaint.bus/driver | SET NULL | Keep complaint text |
| Alert optional FKs | SET NULL | Keep alert |
| Trip.bus/driver/route | RESTRICT | Cannot hard-delete a used bus/driver/route |
| Notification.user | CASCADE | Inbox is user-scoped |
| UserRole / RefreshToken | CASCADE | Session/role rows follow the user |

Soft-delete is the supported deactivation path for users, buses, drivers, routes, companies, devices.

---

## 16. Data Integrity Findings

Checked on the live demo database (no writes except the new migration):

| Check | Result |
| --- | --- |
| Duplicate emails / regs / licenses / route codes / permissions | None |
| Orphan GPS / SOS / complaint / assignment FKs | None |
| Invalid lat/lng | None |
| Overlapping IN_PROGRESS trips | None |
| Users without roles | None |
| Role set | All 7 present |
| Soft-deleted users | 0 |
| Analytics snapshots | 0 (unused) |
| Accidents | 0 (unused) |
| GPS history size | 29,634 (growth risk, not corruption) |

Verdict: **PASS** for integrity of current data. Issues are structural (missing Lost & Found, unused tables), not dirty rows.

---

## 17. API/Database Consistency

Aligned: bus/driver/route/trip/GPS DTO fields, complaint categories, SOS statuses, alert enums, `{ success, message, data }`.

| Finding | Severity |
| --- | --- |
| `GET /trips` had no RBAC | Fixed (any-of trips/analytics) |
| Trip overlap only checked for bus | Driver check added |
| `AnalyticsSnapshot` never written | Documented PARTIAL |
| `Accident` rarely written | Documented PARTIAL |
| SOS create can accept busId/tripId without proving they exist | App-level; new FKs will now 400 on bad ids |
| `deviceId` on GPS is not `gps_devices.id` | Documented |
| `GET /trips/:id` still has no owner/driver row scope | Remaining risk |
| Report `reportUrl` can put a token in a query string | Remaining (Phase 02) |

---

## 18. Frontend/Database Consistency

Tables generally use real API fields (`registrationNo`, `licenseNumber`, `operationalStatus`, `fitnessStatus`). Flattening helpers exist for `company.name` and `route.name`.

| Finding | Notes |
| --- | --- |
| Admin/owner pages are read-only tables | Known PARTIAL UI, not a schema bug |
| Government drivers uses `/analytics/drivers` (`name`, `company` strings) | Matches analytics DTO |
| Admin drivers list omits driver name | UI gap; `user.fullName` exists |
| MapPage prefers `row.bus.registrationNo` | PUBLIC DTO has top-level `registrationNo` — map still works via live socket |
| No Lost & Found UI | Consistent with missing model |
| Hardcoded demo copy in seed/login docs | Expected |

Frontend was **not** redesigned.

---

## 19. Seed Data Review

`backend/prisma/seed.ts` upserts demo roles, permissions (from code matrix), 8 demo routes, 3 demo companies, 16 buses, 12 drivers, 2 passengers, sample complaints/alerts/settings.

Logins use a **shared development password** documented in the seed output. Emails are `@demo.bd` / `@nirapad.gov.bd` placeholders. `nidReference` is `DEMO-NID-REDACTED`. GPS devices are labeled simulator.

Phase 03 made driver phone numbers deterministic (`01711200001`…) so re-seed does not collide on unique phone.

Not real citizens, not production secrets, not government records.

---

## 20. Database Security Review

| Check | Result |
| --- | --- |
| App SQL | Prisma parameterized; no dynamic `$queryRaw` in request handlers |
| passwordHash | Omitted from user list/detail |
| Tokens | Hashed at rest; logger redacts token keys |
| Connection | `DATABASE_URL` from environment |
| Compose / `.env.example` | Demo DB password is a **known development credential**, not a production secret. Do not reuse it outside this lab |
| Hardcoded production secrets in source | None found |
| Integrity script | Uses tagged `$queryRaw` (safe) |

If a non-demo secret is later committed: report **SECRET FOUND — LOCATION REDACTED**.

---

## 21. Performance Review

| Area | Current | Note |
| --- | --- | --- |
| Nearby | Bbox SQL + haversine | Fine for 16 latest rows |
| Live | Full latest table | Fine at current N |
| History | Indexed, `take` capped 500 | OK |
| Analytics series | Per-day counts (Phase 02) | OK |
| Notifications | 533 rows, indexed | OK |
| GPS ingest | Two writes + optional alerts | History will dominate storage |
| Trip list | `take` 200, includes | OK |
| N+1 | Driver trip start loads driver.buses | Acceptable |

No destructive load test was run.

---

## 22. Changes Made

1. Prisma relations/FKs for GPS history, SOS bus/trip, complaint driver, assignment sides, alert route
2. Indexes: refresh tokenHash, SOS busId, complaint driverId, GPS (routeId, timestamp), bus_assignment routeId
3. Migration `20260905000002_integrity_fks` applied with `migrate deploy` (no reset)
4. Trip start rejects a second IN_PROGRESS trip for the same driver
5. Trip GET requires `trips.own` \| `trips.manage` \| `analytics.read`
6. Audit log on SOS/alert/complaint status changes
7. Deterministic demo driver phones in seed
8. `docs/database-architecture.md`
9. Integrity helper `backend/scripts/integrity-check.ts` (read-only)
10. Tests: passenger `/trips` 403; trip-read permission matrix

**Data loss: NONE.** Existing rows unchanged except new indexes/constraints.

---

## 23. Remaining Risks

1. GPS history unbounded (~29k already; FUTURE retention job)
2. Dual RBAC (code vs table) can drift if only the table is edited
3. No DB-level lat/lng CHECK (app only)
4. No partial unique index for open trips
5. `GET /trips/:id` not scoped to owner/driver row
6. `AnalyticsSnapshot` / `Accident` unused
7. Lost & Found missing
8. JWT still in localStorage (Phase 02)
9. Demo password shared in seed
10. `prisma generate` can EPERM while the API process locks the query engine on Windows
11. Compose demo DB password is hardcoded for local Docker

---

## 24. Future Scalability Recommendations

All **FUTURE**: GPS partitioning, hot/warm/cold aggregation, read replicas, Redis latest-location cache, PostGIS if nearby outgrows bbox, ingest streaming, object-storage archive, sharding by operator/region.

Do not implement until volume requires it.

---

## Tests executed

- `prisma validate` — pass
- `prisma migrate status` — 3 migrations, up to date
- `prisma migrate diff` datasource vs schema — no difference
- Integrity counts — pass (see §16)
- Backend Vitest: **31/31 PASS** (was 30/30)
- Backend `tsc --noEmit` and `npm run build`: PASS
- Frontend `tsc --noEmit` and `next build`: PASS (65 pages)

---

## Final status

PHASE 03 STATUS: COMPLETED

DATABASE: VERIFIED

PRISMA: VERIFIED

MIGRATIONS: VERIFIED

DATA INTEGRITY: PASS

RELATIONSHIPS: VERIFIED

INDEXES: IMPROVED

GPS DATA MODEL: VERIFIED

RBAC DATA MODEL: VERIFIED

SECURITY: IMPROVED

TESTS: PASS

BACKEND BUILD: PASS

FRONTEND BUILD: PASS

DATA LOSS: NONE

READY FOR PHASE 04: YES
