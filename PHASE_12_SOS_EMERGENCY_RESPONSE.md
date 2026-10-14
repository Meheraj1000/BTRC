# PHASE 12 — SOS & EMERGENCY RESPONSE

## 1. Existing SOS architecture

The project already had a dedicated SOS path before this phase:

- Backend model: `SosRequest`
- Companion operational event model: `Alert`
- Audit trail: `AuditLog`
- Passenger and monitoring APIs under `GET/POST/PUT /api/sos`
- Passenger UI and police/admin UI for SOS handling
- Socket.IO broadcasts for SOS creation and updates
- Notification rows for SOS create/status changes

This phase reused that architecture. No second emergency system was introduced.

## 2. Emergency event model

The emergency workflow is centered on `SosRequest` and its linked `Alert` row.

Relevant fields already present:

- `id`
- `userId`
- `busId`, `tripId`, `routeId`, `driverId`
- `latitude`, `longitude`
- `locationSource`, `locationAt`
- `message`, `category`, `internalNote`
- `status`, `createdAt`, `updatedAt`, `resolvedAt`, `cancelledAt`
- `idempotencyKey`
- `alertId`

The `Alert` row carries the companion operational event used by the emergency dashboards.

## 3. SOS creation workflow

Passenger/driver SOS creation now follows the application workflow:

1. User confirms the SOS action in the UI.
2. Backend validates authentication and `sos.create` permission.
3. Server rejects duplicate active SOS submissions for the same user.
4. An idempotency key reuses the existing SOS when the client retries.
5. Latest provided GPS is stored only when it is valid.
6. Bus/trip/route/driver associations are resolved when safely available.
7. A companion `Alert` is created for monitoring.
8. Audit logging records the action.
9. Notifications and Socket.IO updates are sent to authorized recipients.

## 4. Status lifecycle

The SOS workflow uses the existing monitored status flow already in the codebase:

- `OPEN`
- `ACKNOWLEDGED`
- `INVESTIGATING`
- `RESPONDING`
- `RESOLVED`
- `CANCELLED`
- `CLOSED`

The service layer enforces valid transitions and rejects invalid ones.

## 5. Role permissions

Passenger:

- Can create own SOS
- Can view own SOS history and status
- Can cancel own `OPEN` SOS only
- Cannot view another passenger’s SOS
- Cannot change severity or police state

Police / emergency:

- Can list and view authorized SOS records
- Can acknowledge / progress / resolve SOS records through the allowed workflow
- Can add internal notes
- Can view the associated vehicle and location context when authorized

Admin:

- Uses existing admin permissions
- No new emergency super-role was added

## 6. Location handling

Location capture is conservative and application-level:

- Uses the latest valid passenger/device coordinates when available
- Stores a location timestamp when captured
- Marks location as unavailable when no valid coordinates exist
- Distinguishes passenger/requester location from vehicle GPS location
- Vehicle GPS is shown separately when a bus association exists

No fabricated coordinates are stored.

## 7. Privacy controls

Location and internal emergency details are protected in the backend:

- Passengers only see their own SOS records
- Other passengers cannot query someone else’s coordinates
- Internal notes are hidden from passenger views
- Public APIs do not expose unrelated emergency data
- Socket.IO broadcasts are scoped by role/user room

## 8. Police/emergency dashboard integration

The existing emergency desk reuses the monitored SOS data and the existing alert desk:

- Paginated SOS list
- Search by passenger/message/registration
- Status filtering
- Severity filtering
- Date filtering
- Internal note editing for authorized users

The dashboard does not load the entire emergency dataset into the browser.

## 9. Map integration

The existing Leaflet / OpenStreetMap map is reused.

- SOS requester location is shown as a distinct marker
- Vehicle GPS is shown separately when available
- Route context remains available through the existing route data
- Unrelated passenger locations are not displayed

## 10. Socket.IO integration

Socket.IO is reused for real-time updates:

- `sos:new` for authorized monitoring roles
- `sos:update` to the owning passenger only
- Role rooms are established on authenticated connection
- No public SOS broadcast exists

## 11. Notifications

Existing in-app notifications are used:

- SOS recorded
- SOS acknowledged / status changed
- SOS resolved / cancelled

This phase did not add FCM/APNs or claim external dispatch.

## 12. Duplicate SOS protection

Duplicate creation is prevented by:

- Server-side active SOS reuse
- Idempotency key reuse
- Client confirmation UI
- Rate limiting on the SOS endpoint

## 13. Cancellation

Cancellation remains constrained:

- Passenger can cancel own SOS only
- Only `OPEN` SOS can be cancelled by the requester
- Cancellation is audited
- Cancellation does not delete the record

## 14. Audit logging

Important actions are auditable through the existing audit middleware:

- `sos.create`
- `sos.status`
- `sos.cancel`
- `sos.note`

Audit rows include actor, timestamp, request context, and the relevant entity id.

## 15. Flutter implementation

The Flutter passenger app already contains an SOS entry point in `mobile/lib/src/screens/passenger_home.dart`:

- Confirm-before-send UI
- GPS capture via `geolocator` when available
- Status message after creation
- Cancel button for open SOS records
- Own SOS history list

Flutter SDK was not installed in this environment, so a full Flutter build could not be run.

## 16. Next.js implementation

The Next.js passenger and police SOS screens are already wired:

- Passenger: `/passenger/sos`
- Police / admin monitoring: `/police/emergencies`, `/admin/sos`
- Shared components: `SosWorkflow.tsx`, `SosDesk`, `SosButtonPage`, `EventDesk`

The UI provides confirmation, status display, loading/error states, filtering, and secure API usage.

## 17. Security testing

The backend test suite covers emergency authorization and privacy boundaries:

- Unauthenticated SOS create/list fails
- Passenger IDOR is blocked
- Passenger cancellation is limited to own open SOS
- Invalid status transitions are rejected
- Police monitoring access is scoped
- Socket room access is restricted

## 18. Performance

The implementation uses pagination and selective queries. Emergency list and monitoring endpoints avoid unbounded browser loads and do not fetch unrelated history.

## 19. Test results

- Emergency slice: PASS
- Full backend suite: 116/116 PASS
- Frontend build: PASS
- Backend build: PASS
- Flutter check: NOT APPLICABLE — Flutter SDK unavailable

## 20. Build results

- Backend build: PASS
- Frontend build: PASS
- Database migration: none required for this phase

## 21. Known limitations

- No real police dispatch
- No real ambulance/fire/999 integration
- No FCM/APNs push delivery
- Flutter live Socket.IO map is not implemented
- GPS remains simulated unless device mode is configured

## 22. Future improvements

- Optional richer incident note model if operational note history becomes necessary
- Flutter live emergency map updates
- Push notification integration if the platform later adds a real messaging backend
- Additional SOS analytics and SLA reporting

NOT CLAIMED:

- Production-ready emergency service
- Real police dispatch
- Real ambulance/fire dispatch
- Real 999 integration
- Real government emergency integration
- Physical GPS hardware
- Real BRTA integration
- AI emergency detection
- Trained AI
- Other unsupported claims# Phase 12 — SOS & Emergency Response

Application-level SOS and emergency monitoring workflow for Nirapad Transit.
This is **not** live police, ambulance, fire, 999, BRTA, or government dispatch.

## 1. Existing SOS architecture (audit)

| Piece | Status |
| --- | --- |
| `SosRequest` Prisma model | Present (`sos_requests`) |
| Companion `Alert` (`type: SOS`) | Created on SOS create; `alertId` stored on SosRequest |
| Incident / Event tables | **Do not exist** — operational events = `Alert`; UI `EventDesk` / `/incidents` |
| Passenger / driver create | `POST /api/sos` |
| Police / government / admin desk | `SosDesk` + `/sos` list/status/note |
| Socket.IO | `sos:new` (monitors), `sos:update` (requester), `alert:new` on SOS companion alert |
| Notifications | In-app `NotificationType.SOS` only (no FCM/APNs) |
| Audit | `sos.create`, `sos.status`, `sos.cancel`, `sos.note` |

## 2. Emergency event model

Primary workflow record: **`SosRequest`**.

Key fields: `id`, `userId`, optional `busId` / `tripId` / `routeId` / `driverId`, `alertId`, `latitude` / `longitude`, `locationSource` (`DEVICE` \| `UNAVAILABLE`; `VEHICLE`/`PROVIDED` reserved), `locationAt`, `message`, `category`, `internalNote`, `idempotencyKey`, `status`, timestamps, `resolvedAt`, `cancelledAt`, `cancelledById`.

Severity for SOS workflow responses is fixed as **CRITICAL** (companion Alert also CRITICAL). Passengers choose a **category** (`SAFETY` \| `MEDICAL` \| `ACCIDENT` \| `OTHER`), not severity.

## 3. SOS creation workflow

1. Passenger/driver confirms in UI.
2. Optional device geolocation (not invented if missing).
3. `POST /api/sos` with optional `idempotencyKey` (UUID).
4. Auth + `sos.create` + rate limit (15 / 15 min).
5. Idempotency replay or active-SOS reuse returns `existing: true`.
6. Associations: drivers auto-link assigned bus / in-progress trip when possible.
7. Companion Alert created; notifications + sockets + audit.

Honest copy: recorded for authorized monitoring — **not** live dispatch.

## 4. Status lifecycle

`OPEN` → `ACKNOWLEDGED` → (`INVESTIGATING` \| `DISPATCHED` \| `RESPONDING`) → `RESOLVED` → `CLOSED`

Also: `OPEN`/`ACKNOWLEDGED`/`INVESTIGATING` → `FALSE_ALARM` → `CLOSED`; requester `OPEN` → `CANCELLED` → (monitor) `CLOSED`.

Invalid transitions return **422**. Linked Alert status is synced (OPEN / ACKNOWLEDGED / RESOLVED).

## 5. Role permissions

| Role | Create | List/get | Manage status/notes |
| --- | --- | --- | --- |
| PASSENGER / DRIVER | own | own | no |
| POLICE / GOVERNMENT / SUPER_ADMIN | create if permitted | all | yes |
| BRTA / OWNER | no | no | no |

## 6–8. Location & privacy

- Device coords stored only when valid; else `locationSource: UNAVAILABLE`.
- Monitors also see separate **vehicle GPS** from `bus.latestLoc` (may be stale); never merged into SOS lat/lng without distinction.
- Passenger projection hides `internalNote`, `requesterName`, emails/phones.
- IDOR: other passengers cannot `GET /sos/:id`.

## 9–11. Monitoring, map, realtime

- Desks: `/police/emergencies`, `/admin/sos`, `/government/sos`.
- Map: Leaflet SOS marker (requester) vs bus marker (vehicle GPS).
- Sockets: role rooms for `sos:new`; `user:{id}` for `sos:update`; companion `alert:new` for EventDesk. Room ACL blocks foreign `user:` / `role:` joins.

## 12. Notifications

In-app only: requester (created / status), monitors (new SOS). Payload `{ sosId, status }` — no coordinates in notification bodies.

## 13–15. Duplicate protection, cancellation, notes

- Idempotency key + one active SOS per user.
- Terminal statuses clear `idempotencyKey` so a later create can reuse a client key.
- Cancel: own + `OPEN` only; audited; not deleted.
- Internal notes: `sos.manage` only; hidden from passenger responses.

## 16–17. Flutter / Next.js

- Next.js: `SosWorkflow` (`SosButtonPage`, `SosDesk`) with confirm, history, cancel, filters, map.
- Flutter: passenger Safety tab + driver home — confirm, optional GPS, list, cancel, idempotency. No Socket.IO SOS live updates on mobile yet.

## 18–20. Security, performance, tests

Backend RBAC on every SOS endpoint; pagination/indexes on `(status, createdAt)`, `(userId, status)`.

See `backend/tests/sos-emergency.test.ts` and related security/permissions tests.

## Known limitations

- Not real emergency services / 999 / dispatch centers.
- No FCM/APNs.
- Flutter SDK may be unavailable in CI/dev machines.
- No Prisma FK relation object between SosRequest and Alert (string `alertId` only).
- Lost & Found / ticketing still out of scope.

## Builds / tests (Phase 12 close-out)

- Migration applied: `20260905000004_sos_emergency_workflow` (backward-compatible; no reset).
- Backend tests: **116/116 PASS** (prior baseline 108; SOS suite + related coverage expanded).
- Backend build / `tsc`: PASS
- Frontend build: PASS (includes `/government/sos`)
- Flutter check: NOT APPLICABLE — Flutter SDK unavailable
- Data loss: NONE
