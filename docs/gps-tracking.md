# GPS tracking

## Ingest payload

```json
{
  "busId": "...",
  "deviceId": "...",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "speed": 42,
  "heading": 180,
  "timestamp": "2026-09-05T10:00:00.000Z",
  "routeId": "...",
  "driverId": "...",
  "tripId": "..."
}
```

## Public vs operational payloads

Unauthenticated passengers and drivers receive a PUBLIC DTO (bus id,
registration, coordinates, speed, heading, timestamp, status color, route
name, data label). Operational roles receive additional device/route/driver/
trip/company fields. Socket event `bus:location` is public;
`bus:location:ops` is role-gated.

Nearby uses a PostgreSQL bounding box on `gps_latest_locations`, then
haversine refine. See `docs/gps-retention.md` for history growth.

Live payloads include `trackingState` (`ONLINE` | `STALE`) using `GPS_STALE_SECONDS` (default 45). Owners receive only their fleet on `/gps/live`. History is paginated and owner-scoped.

## Simulator

`gps-simulator/` moves seeded buses along demo polylines in Dhaka, Chattogram,
Sylhet, Rajshahi and Khulna. It loads buses from `/buses?pageSize=100` and
polylines from `/routes`. Stdin commands: `start`, `stop`, `overspeed`,
`deviate`, `emergency`.

This is **not** a hardware tracker. Label: **SIMULATION / TEST DATA**.

## Rules

- Overspeed: `speed > route.allowedSpeed + GPS_OVERSPEED_MARGIN_KMH`
- Deviation: distance to assigned polyline vs `ROUTE_DEVIATION_THRESHOLD_METERS` (default 250 m)
- Near-route band: `ROUTE_NEAR_THRESHOLD_METERS` (default 100 m)
- Noise: `ROUTE_DEVIATION_CONSECUTIVE` (default 3) off-route samples before `OFF_ROUTE`
- Return: `ROUTE_RETURN_CONSECUTIVE` (default 2) on-route samples before `ON_ROUTE`

`ROUTE_DEVIATION` alerts fire on the ON→OFF transition only (plus a 2 minute cooldown). GPS points are not audit-logged.

## Replacing the simulator

1. Keep `POST /api/gps/location` as the device contract
2. Set `GPS_SOURCE_MODE=DEVICE`
3. Point the physical modem/app at that endpoint with a driver or device JWT
