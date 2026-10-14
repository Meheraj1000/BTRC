# PHASE 09 — GOVERNMENT / ADMIN DASHBOARD & CENTRAL MONITORING

## 1. Existing dashboard architecture

One shared monitoring surface already existed: `DashboardView`, rendered by role home pages through `DashPage`.

| Path | Role gate | Variant after this phase |
| --- | --- | --- |
| `/admin/dashboard` | SUPER_ADMIN | `admin` |
| `/government/dashboard` | GOVERNMENT, SUPER_ADMIN | `government` |
| `/brta/dashboard` | BRTA, SUPER_ADMIN | `brta` |
| `/police/dashboard` | POLICE, SUPER_ADMIN | `police` |
| `/owner/dashboard` | TRANSPORT_OWNER, SUPER_ADMIN | `owner` |

Analytics pages reuse the same view without the map. Driver, passenger, and public pages were left as their own role homes. No second Admin/Government dashboard was added.

Data already came from Phase 04–08 modules: `/analytics/*`, `/buses`, `/drivers`, `/routes`, `/gps/live`, Leaflet/OSM `LiveMap`, Socket.IO `bus:location` / `bus:location:ops` / `route:status`, alerts, and `audit_logs`.

## 2. Dashboard roles

Existing Prisma / RBAC roles only:

- SUPER_ADMIN — deployment-wide monitoring + audit
- GOVERNMENT — authority overview, including passenger totals and SOS cards
- BRTA — verification-oriented monitoring (no SOS permission)
- POLICE — operational/security monitoring (SOS, no passenger census)
- TRANSPORT_OWNER — own company only
- DRIVER / PASSENGER — no administrative dashboard APIs (`analytics.read` is not granted)

No new roles were invented.

## 3. Access control

Enforced in three places:

1. Frontend: `AppShell allow={...}` redirects unauthorized users.
2. Backend: `requirePermission("analytics.read")` on dashboard aggregation; `audit.read` on audit logs; existing `buses.read` / `drivers.read` / `routes.read` / `alerts.read`.
3. Resource scope: `ownerCompanyId()` forces TRANSPORT_OWNER queries onto their company. Cross-owner GPS, buses, drivers, alerts, incidents, and analytics lists are filtered.

Frontend hiding is not treated as security. Unauthenticated callers receive 401. Unauthorized roles receive 403.

## 4. Summary metrics

`GET /analytics/overview` now uses database counts (not invented numbers):

Vehicles: total, active, inactive, offline, suspended, pending verification, verified  
Drivers: total, active, suspended, pending license, verified license, expired license  
Routes: total, active  
GPS: online, stale (`GPS_STALE_SECONDS`)  
Compliance: on route, near route, off route, deviating, deviations today  
Also: overspeed today, active trips, open complaints

Role-gated cards:

- `openSos` / `emergencyAlerts` only when the caller has `sos.read`
- `totalPassengers` only for SUPER_ADMIN and GOVERNMENT

Owner responses set `scope: "COMPANY"`. Label: `DEMO / SIMULATED`, `method: DATABASE_COUNTS`, `verificationLabel: MANUAL / SIMULATED VERIFICATION`.

## 5. Vehicle monitoring

Dashboard table consumes the existing paginated `/buses` API (search, operational status, sort, page size 8). Columns: registration, type, operator (hidden for owner), driver name, route, GPS state, compliance, last update, vehicle status.

`GET /analytics/buses` is the same fleet, paginated and owner-scoped, for government driver/vehicle statistic pages.

## 6. Driver monitoring

Dashboard table consumes existing `/drivers` with status / license-status filters and pagination.

Shown: name, operator, license status, driver status, assigned vehicle registration.

Not shown on the dashboard: phone, email, address, password hashes, tokens. Police DTO already omits email/phone (Phase 06). Verification actions stay on the existing driver desks.

## 7. Route monitoring

Overview table uses `GET /routes?page=` (search + pagination). This is a monitoring slice, not a second Route Management UI. Assigned vehicle counts come from Phase 08 `assignedVehicleCount`.

## 8. GPS monitoring

Reuses Phase 07 `GET /gps/live` and `gps_latest_locations`. Operational callers see `trackingState`, speed, last update, route, and compliance. Passengers still receive the public GPS DTO. Owners only see their company. History endpoints were not used by the dashboard (no full GPS history load).

## 9. Route compliance overview

Reuses Phase 08 rule-based corridor logic. Cards and activity lists show ON_ROUTE / NEAR_ROUTE / DEVIATING / OFF_ROUTE / STALE and recent `route_compliance_events`. `GET /routes/compliance/summary` remains the dedicated summary API. No AI prediction.

## 10. Live map

Existing Leaflet / OpenStreetMap `LiveMap` / `LiveMapInner`. Markers use GPS + compliance color (green on route, amber warning, red off route, grey stale). Popups show registration, route, speed, GPS state, compliance, and last update. Polylines and stops come from the existing route catalog. Government and police live-map pages use the same map (`MapPage`).

## 11. Real-time updates

Existing Socket.IO only. Dashboard and live-map pages listen to `bus:location`, `bus:location:ops`, and `route:status`. Room join rules from Phase 07 were not changed. Unauthorized operational rooms remain blocked (`socket-rooms` tests).

## 12. Alerts / events

`GET /analytics/activity` returns the last 15 alerts and compliance events (owner-scoped). Existing `/alerts` is now company-scoped for owners and driver-scoped for drivers. `GET /incidents` still requires `alerts.read`, but SOS rows are only included for SUPER_ADMIN, GOVERNMENT, and POLICE. This is not the Phase 12 Emergency/SOS product and not a second notification bus.

## 13. Audit activity

`GET /audit-logs` remains `audit.read` (SUPER_ADMIN). Response is paginated. Actor is `user.fullName` only — email is no longer returned. Dashboard activity includes audit rows only for SUPER_ADMIN. Unauthorized roles receive 403.

## 14. API changes

Improved existing endpoints; one additive read:

| Endpoint | Change |
| --- | --- |
| `GET /analytics/overview` | DB counts, role-gated cards, owner scope |
| `GET /analytics/series` | Owner-scoped daily series |
| `GET /analytics/activity` | **New** recent alerts / compliance / optional audit |
| `GET /analytics/buses\|drivers\|routes` | Paginated `{ items, page, pageSize, total }`, owner-scoped |
| `GET /analytics/alerts` | Owner-scoped group-by |
| `GET /audit-logs` | Pagination; no email |
| `GET /alerts` | Owner / driver scope |
| `GET /incidents` | SOS hidden from BRTA and owners |

Existing `/buses`, `/drivers`, `/routes`, `/gps/live`, `/routes/compliance/summary` are reused.

## 15. Database / query optimization

No new tables, cache, or Redis. Counts use Prisma `count` / `groupBy` with existing indexes (`buses.companyId`, `operationalStatus`, `drivers.companyId/status/licenseStatus`, `routes.companyId/status/deletedAt`, `gps_latest_locations.timestamp`, `route_compliance_states.status`, `alerts(type,status)`, `audit_logs.createdAt`). Lists are paginated (max page size 100). Latest GPS only — not `gps_locations` history. No N+1 list loops on the overview.

## 16. Security

- Unauthenticated dashboard APIs: 401
- DRIVER / PASSENGER analytics: 403
- Owner cannot read another owner’s analytics, buses, alerts, or operational GPS
- Audit logs restricted to `audit.read`
- SOS on `/incidents` restricted to roles with operational emergency access
- IDOR on vehicles/drivers remains the Phase 05/06 `assertOwnerScope` / `assertCanViewBus` path
- Socket operational rooms unchanged

## 17. Privacy

Dashboard UI does not render phone, email, address, password, or token fields. Audit responses dropped email. Police driver projection still omits contact fields. Passenger census is limited to SUPER_ADMIN / GOVERNMENT. Internal GPS operational fields (`companyId`, `deviceId`) remain on the existing Phase 07 operational DTO for authorized ops roles only.

## 18. Tests

`backend/tests/dashboard.test.ts` covers unauthenticated/unauthorized access, authorized summary cards, owner scope vs admin totals, pagination, audit privacy, SOS leak on incidents, GPS/compliance visibility, and passenger rejection.

Previous baseline: 94/94. Phase 09 added 6 dashboard cases. Final: **100/100 PASS**.

## 19. Build results

- Prisma validate: PASS (no new migration; schema unchanged)
- Backend `vitest run`: 100/100 PASS
- Backend `tsc` / `npm run build`: PASS
- Frontend `tsc --noEmit`: PASS
- Frontend `next build`: PASS (67 static routes)
- Database: no reset, no deleted rows

## 20. Known limitations

- Single deployment, not a national operations center
- GPS source is the simulator unless `GPS_SOURCE_MODE=DEVICE`
- Verification remains MANUAL / SIMULATED (no BRTA API)
- Live map loads the current latest-location set (academic scale)
- Public `GET /routes` catalog (no `page`) still returns an array for the simulator and passenger map
- Socket.IO is single-process (no Redis adapter)
- Emergency/SOS product work belongs to Phase 12

NOT CLAIMED:

- Production-ready
- National-scale deployment
- Real government deployment
- Official government database integration
- Real BRTA integration
- Real-time national government network
- Physical GPS hardware
- AI-powered dashboard decisions
- Trained AI

This is an academic/FYDP administrative monitoring dashboard using the project’s existing simulated/internal data.
