# PHASE 08 — ROUTE & ROUTE COMPLIANCE

## 1. Existing Route implementation

Already present before this phase:

- Prisma `Route`, `RouteStop`, `Bus.routeId`, `BusAssignment`
- Public `GET /api/routes` catalog used by the passenger UI, VehicleDesk, and GPS simulator
- Admin-only `POST/PUT/DELETE /api/routes` (no owner manage, no ownership checks, no coordinate validation)
- GPS ingest compared each point to the polyline and raised `ROUTE_DEVIATION` immediately (2-minute cooldown)
- Leaflet already drew polylines when callers passed them

Phase 08 improved that stack. It did not add a second route, GPS, or Socket.IO system.

## 2. Route data model

Existing columns reused: `code`, `name`, `startName`/`endName`, start/end coordinates, `city`, `allowedSpeed`, `polyline` (JSON), `status`, `companyId`, `isDemo`, soft `deletedAt`.

Stops remain `route_stops` with unique `(routeId, sequence)`.

Additive migration `20260905000003_route_compliance` only:

- `RouteComplianceStatus` enum
- `route_compliance_states` (one row per bus)
- `route_compliance_events` (status transitions only)
- indexes on `routes.companyId`, `routes.deletedAt`, `bus_assignments(busId, endedAt)`

No GPS history, vehicle, or driver rows were deleted. `prisma migrate reset` was not used.

## 3. Route geometry

Single representation: JSON array of `{ lat, lng }` (the existing seed/simulator format).

Validated on write: at least two points; latitude −90…90; longitude −180…180. `parsePolyline` still accepts `[lat, lng]` tuples when reading older values.

## 4. Route stops

Create / replace / patch / delete through `/api/routes/:id/stops`. Sequences must be unique positive integers. Order is `sequence ASC`. The map draws stops in that order.

## 5. Vehicle-route assignment

Uses existing `Bus.routeId` + `BusAssignment` history.

Dedicated `POST /routes/:id/assign` and `DELETE /routes/:id/assignments/:busId`.

Rejected when the vehicle is archived, `INACTIVE` (assign endpoint), `OFFLINE`, or `registrationStatus=SUSPENDED`. New vehicle registration may still set a planning `routeId` while `INACTIVE` (Phase 05).

A bus may use:

- its operator’s own route
- a shared route (`companyId` null)
- a seeded demo catalog route (`isDemo=true`)

Owner-created routes are exclusive (`isDemo=false`). Cross-operator assignment to those is blocked.

## 6. Driver compatibility

Route assignment does not change driver ownership. If the vehicle already has a driver, that driver must be duty-eligible (active, license VALID or EXPIRING_SOON). Suspended / expired-license drivers block a new route assignment.

## 7. GPS integration

`ingestLocation` still writes `gps_locations` / `gps_latest_locations`. After each accepted point it calls `evaluateAndPersistCompliance` against the **bus** assigned polyline (client `routeId` is ignored).

Operational GPS DTO adds `complianceStatus` and `deviationM`. Public DTO does not.

Stale GPS remains `GPS_STALE_SECONDS` (default 45). A gap longer than that records a `STALE` transition, then the new point is evaluated.

## 8. Route deviation algorithm

Rule-based distance from the GPS point to the assigned polyline (`distanceToPolylineMeters`).

| Sample | Rule |
| --- | --- |
| ON_ROUTE | deviation ≤ `ROUTE_NEAR_THRESHOLD_METERS` |
| NEAR_ROUTE | near < deviation ≤ `ROUTE_DEVIATION_THRESHOLD_METERS` |
| DEVIATING | deviation > off-route threshold |

This is **not** AI and **not** a government permit check.

## 9. Deviation threshold

| Env | Default | Role |
| --- | --- | --- |
| `ROUTE_DEVIATION_THRESHOLD_METERS` | 250 | Off-route distance |
| `ROUTE_NEAR_THRESHOLD_METERS` | 100 | Near-route band |
| `ROUTE_DEVIATION_CONSECUTIVE` | 3 | Points before `OFF_ROUTE` |
| `ROUTE_RETURN_CONSECUTIVE` | 2 | Points before return to `ON_ROUTE` |

## 10. GPS noise handling

One noisy point becomes `DEVIATING` only. `OFF_ROUTE` requires three consecutive off-corridor samples. Return requires two consecutive in-corridor samples. Single-point flicker does not create a deviation alert.

## 11. Compliance events

`route_compliance_events` stores **transitions** only (`ON_ROUTE` → `DEVIATING` → `OFF_ROUTE` → `ON_ROUTE`, plus `STALE` / `UNASSIGNED`). GPS history stays in `gps_locations`. Audit logs are not written per GPS point.

`ROUTE_DEVIATION` alerts fire on the transition into `OFF_ROUTE`, with a 2-minute cooldown.

## 12. Socket.IO integration

Existing rooms only. New event `route:status` is emitted to SUPER_ADMIN / GOVERNMENT / POLICE / BRTA role rooms and `company:{id}`. Owners do not receive another operator’s status. `canJoinSocketRoom` is unchanged.

## 13. Map UI

Leaflet/OSM unchanged as the provider. Live map now loads catalog polylines and stop markers. Vehicle color: green on-route, amber deviating, red off-route, grey stale. Popup shows route status, deviation metres, and last GPS time.

## 14. API changes

Improved `/api/routes` instead of adding `/vehicles` or a second router.

- Public `GET /routes` (no `page`) remains an **array** (simulator + passenger + VehicleDesk)
- `GET /routes?page=` returns `{ items, page, pageSize, total }`
- Owner `companyId` is forced on create; client ownership is ignored
- `TRANSPORT_OWNER` now has `routes.manage` for **own** routes
- Compliance endpoints under `/api/routes/compliance/*` and `/:id/compliance|events`

## 15. Security

Backend authorization is authoritative. Owner A cannot update, archive, stop-edit, or assign against Owner B exclusive routes. Passengers cannot write routes. Compliance reads are owner-scoped. IDOR on another operator’s bus compliance returns 403.

## 16. Database changes

One additive Prisma migration. Existing route/GPS/vehicle/driver FKs preserved. New indexes support route lookup, assignment history, and compliance event pages.

## 17. Performance

- Paginated route lists and compliance events (max 100)
- Compliance state upserted once per ingest; events only on transition
- Live list does not load unlimited GPS history
- No N+1 stop reload on catalog (stops included in the same query)

## 18. Tests

New: `backend/tests/route-compliance.test.ts` (3), `backend/tests/routes.test.ts` (8).

Previous baseline 83 + 11 Phase 08 tests = **94/94 PASS**.

## 19. Build results

- Backend tests: 94/94 PASS
- Backend `tsc --noEmit` / `tsc` build: PASS
- Frontend `tsc --noEmit`: PASS
- Prisma migrate deploy `20260905000003_route_compliance`: applied (no reset)

## 20. Known limitations

- Corridor check is a planar polyline distance, not map-matched roads
- Seeded demo routes stay `isDemo=true` and remain assignable catalog corridors
- No official BRTA / government route-permit API
- GPS source in this deployment is the simulator
- Full trip lifecycle and the Government Dashboard are out of scope (later phases)
- Single-process Socket.IO (no Redis adapter)

NOT CLAIMED:

- Production-ready
- National-scale deployment
- Official government route-permit integration
- Real BRTA integration
- AI-based route prediction
- AI-based route compliance
- Physical GPS hardware
- Government-integrated GPS

Route compliance in this phase is **RULE-BASED + GPS SIMULATOR DATA**.
