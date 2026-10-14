# PHASE 10 — POLICE & EMERGENCY MONITORING

## 1. Existing Police / Emergency functionality

Already present before this phase:

- `POLICE` role and seed account `police@nirapad.gov.bd`
- Pages: `/police/dashboard`, `/police/live-map`, `/police/emergencies`, `/police/alerts`, `/police/incidents`, `/police/reports`
- Shared `DashboardView` (Phase 09) on the police dashboard
- `Alert`, `SosRequest`, `Accident`, `RouteComplianceEvent` tables
- `GET/PUT /alerts`, `GET /incidents`, `GET/PUT /sos`
- Operational GPS, route compliance, Socket.IO `alert:new` / `sos:new` / `route:status`
- Police driver/bus DTO stripping of contact fields

Phase 10 improved that stack. It did **not** add a second GPS, map, notification, or SOS product.

## 2. Role configuration

Existing `POLICE` permissions (unchanged, still sufficient):

`buses.read`, `drivers.read`, `routes.read`, `alerts.read`, `alerts.manage`, `sos.read`, `sos.manage`, `complaints.read`, `analytics.read`, `reports.read`, `notifications.read`

No new role. SUPER_ADMIN remains a break-glass monitor. GOVERNMENT can read alerts but cannot change alert status (`alerts.manage` is police/admin only).

## 3. Access control

1. Frontend: `AppShell allow={["POLICE", "SUPER_ADMIN"]}`
2. Backend: `alerts.read` / `alerts.manage` / `analytics.read` / `buses.read`
3. Data: owners remain company-scoped; police sees deployment-wide operational data; passengers/drivers cannot open police APIs

Frontend hiding is not treated as security.

## 4. Dashboard

`/police/dashboard` now renders `PoliceMonitoring` (map-first operational view) instead of the generic government-style dashboard.

Cards (database counts only): active vehicles, GPS online/stale, off-route/deviating, deviations today, suspended vehicles/drivers, open SOS, overspeed today.

## 5. Live vehicle monitoring

Reuses `GET /buses` with backend filters: registration search, `trackingState`, `complianceStatus`, pagination.

Columns: registration, operator, driver name, route, GPS, compliance, speed, vehicle status.

## 6. GPS integration

Phase 07 `GET /gps/live` + Socket.IO `bus:location` / `bus:location:ops`. Police receive the operational projection. Public callers still get the public DTO. History is not loaded on the dashboard.

## 7. Route deviation monitoring

Phase 08 rule-based corridor status. Filter vehicles by `ON_ROUTE` / `NEAR_ROUTE` / `DEVIATING` / `OFF_ROUTE` / `STALE`. Cards come from `analytics/overview` and `/routes/compliance/summary`. Deviation alerts use existing `AlertType.ROUTE_DEVIATION` (MEDIUM, or HIGH when deviation &gt; 600 m).

## 8. Events / incidents

No new Incident table. **`Alert` is the operational event record** (id, type, vehicle, driver, route, location, severity, status, timestamps).

`GET /alerts` and `GET /incidents` now return paginated `{ items, page, pageSize, total }`. `/incidents` also keeps a role-gated SOS summary (name + coordinates only) and unused `Accident` rows. Full SOS lifecycle is Phase 12.

## 9. Event severity

Existing enum only: `LOW | MEDIUM | HIGH | CRITICAL`. Deterministic GPS/compliance rules. SOS alerts stay `CRITICAL`. Not an AI classifier.

## 10. Event status

Existing enum: `OPEN | ACKNOWLEDGED | RESOLVED`. `PUT /alerts/:id/status` requires `alerts.manage` and Zod validation. GOVERNMENT / BRTA / OWNER / DRIVER / PASSENGER cannot change status.

## 11. Real-time updates

Existing Socket.IO only. Police join `role:POLICE` on connect.

- Vehicle location: `bus:location:ops`
- Compliance: `route:status`
- New event: `alert:new` (now **not** blasted to every transport owner; company room only)
- SOS: `sos:new` (admin / government / police)

## 12. Privacy

Police driver DTO still omits email/phone. Alert/incident projections omit email, phone, passwords, and tokens. SOS list/update no longer returns requester email/phone (name + location only). Full emergency contact handling is Phase 12.

## 13. Security

- Unauthenticated alerts: 401
- Passenger alerts: 403
- Owner cannot acknowledge another operator’s — or any — alert (`alerts.manage` denied)
- Owner alert lists remain company-scoped
- `alert:new` no longer emits to all `TRANSPORT_OWNER` sockets
- Overspeed/deviation notifications go to authority roles + the vehicle’s company owner, not every owner
- Socket room join rules unchanged

## 14. Audit logging

Existing `auditAction("alert.status", "Alert")` and `auditAction("sos.status", "SosRequest")`. GPS points are not written to audit logs.

## 15. Database changes

None. No migration. No reset. Existing indexes on `alerts(type,status)`, `alerts.createdAt`, `alerts.busId`, GPS latest timestamp, and compliance status are reused.

## 16. Performance

Alert and incident lists are paginated (max 100). Vehicle search filters in SQL (`complianceState`, `latestLoc.timestamp`). Overview uses Phase 09 counts. No GPS history dump. No new cache.

## 17. Tests

`backend/tests/police-emergency.test.ts`: unauthenticated/unauthorized access, police pagination, GPS/compliance visibility, acknowledge/resolve authorization, invalid status, owner scope, police driver privacy.

Previous baseline: 100/100. Phase 10 added 4 cases. Final: **104/104 PASS**.

## 18. Build results

- Prisma validate: PASS (no migration)
- Backend `vitest run`: 104/104 PASS
- Backend `tsc` / `npm run build`: PASS
- Frontend `tsc --noEmit`: PASS
- Frontend `next build`: PASS
- Database: no reset, no deleted rows

## 19. Known limitations

- Single deployment, not a national police network
- GPS source is the simulator unless `GPS_SOURCE_MODE=DEVICE`
- `Accident` remains unused (no write API)
- SOS desk is visibility + existing status buttons only
- Socket.IO is single-process
- No SMS / email / push provider

NOT CLAIMED:

- Production-ready
- National-scale police deployment
- Real police database integration
- Real emergency service integration
- Real dispatch center integration
- Real government integration
- Physical GPS hardware
- Real BRTA integration
- AI emergency detection
- Trained AI
- Full SOS emergency response

PHASE 10 is a **monitoring foundation**. Full SOS / Emergency Response is PHASE 12.
