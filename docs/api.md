# API

Base URL: `http://localhost:4000/api`

Envelope:

```json
{ "success": true, "message": "OK", "data": {} }
```

Errors use `success: false` with HTTP 4xx/5xx.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | /auth/register | Passenger only |
| POST | /auth/login | JWT access + refresh |
| POST | /auth/refresh | Rotate access |
| POST | /auth/logout | Revoke refresh tokens |
| GET | /auth/me | Current user |
| PATCH | /auth/me | Self profile only (name, phone, emergency fields). Roles cannot be changed. |
| POST | /auth/change-password | Authenticated |

Header: `Authorization: Bearer <accessToken>`

## Users

CRUD at `/users`. Super admin only.

## Fleet

`/buses`, `/drivers`, `/companies`, `/gps-devices`

## Routes

Public catalog `GET /routes` (no `page`) returns an array of ACTIVE routes.  
Authenticated `GET /routes?page=&pageSize=&q=&city=&status=` returns `{ items, page, pageSize, total }`. Owners see only their company rows when paginating.

| Method | Path | Access |
| --- | --- | --- |
| GET | /routes | Public catalog / paginated search (`q` matches name, code, origin, destination, **stop name**) |
| GET | /routes/:id | Public detail (polyline + ordered stops) |
| POST | /routes | `routes.manage` (owner company forced) |
| PUT | /routes/:id | `routes.manage` + ownership |
| PATCH | /routes/:id/status | Activate / deactivate |
| DELETE | /routes/:id | Soft archive |
| POST/PUT/PATCH/DELETE | /routes/:id/stops[/:stopId] | Stop management |
| POST | /routes/:id/assign | `{ busId }` — active, non-suspended, same operator |
| DELETE | /routes/:id/assignments/:busId | Unassign |
| GET | /routes/compliance/summary | Ops roles only (passengers 403) |
| GET | /routes/:id/compliance | Current vehicles on that route |
| GET | /routes/:id/events | Paginated status transitions |
| GET | /routes/compliance/buses/:busId | One vehicle |

Compliance is rule-based (distance to polyline). It is not AI and not a BRTA permit check.

## GPS

| Method | Path | Access | Projection |
| --- | --- | --- | --- |
| POST | /gps/location | Auth + `gps.ingest` | Operational DTO |
| GET | /gps/live | Public | PUBLIC unless operational role |
| GET | /gps/nearby?lat=&lng=&radiusM= | Public | PUBLIC unless operational role |
| GET | /gps/buses/:id/location | Public | PUBLIC unless operational role |
| GET | /gps/buses/:id/history | Auth + `buses.read` | History stripped for non-ops roles |
| GET | /gps/buses/:id/eta | Public | Rule-based prototype only |
| GET | /gps/source-mode | Public | Mode + honesty note |

Public DTO: busId, registration, lat/lng, speed, heading, timestamp, statusColor, routeName, dataLabel.
Operational DTO adds deviceId, routeId, driverId, tripId, companyId, allowedSpeed, operationalStatus.

`source=DEVICE` is rejected while `GPS_SOURCE_MODE=SIMULATION`.

## Trips

`POST /trips/start`, `POST /trips/end`, `GET /trips`, `GET /trips/:id`

## Safety

`POST /sos`, `GET /sos`, `PUT /sos/:id/status`
`POST /complaints`, `GET /complaints`, `GET /complaints/:id`, `PUT /complaints/:id`
`GET /alerts` (paginated; `type`, `severity`, `status`, `q`)
`PUT /alerts/:id/status` (`OPEN` / `ACKNOWLEDGED` / `RESOLVED`; `alerts.manage` only)
`GET /incidents` (paginated Alert events + role-gated SOS summary)

Police monitoring reuses these endpoints plus `/gps/live`, `/buses`, `/drivers`, `/routes/compliance/summary`, and `/analytics/overview`. Full SOS dispatch is Phase 12.

## Platform

`/notifications`, `/analytics/overview|series|activity|buses|drivers|routes|alerts`
`/reports/:kind?format=json|csv|xlsx|pdf`
`/settings`, `/audit-logs` (paginated; actor name only, no email)
`/favorites`

`GET /analytics/overview` and list endpoints are scoped to the owner’s company for `TRANSPORT_OWNER`. SOS/passenger totals are role-gated. Dashboard activity is `analytics.read`; audit logs remain `audit.read`.

Report kinds: bus-activity, driver-performance, route-violations,
speed-violations, sos, complaints, trips, vehicle-status.

## WebSocket

URL: `http://localhost:4000` with `auth.token`.

Events: `bus:location` (public DTO), `bus:location:ops` (operational roles only), `route:status` (ops / company rooms), `alert:new`, `sos:new`, `notification:new`.
