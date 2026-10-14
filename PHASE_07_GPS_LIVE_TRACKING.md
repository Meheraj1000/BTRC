# PHASE 07 — GPS LIVE TRACKING

## 1. Existing GPS architecture

Already present before this phase:

- `POST /api/gps/location` ingest (simulator + JWT)
- `gps_latest_locations` (one row per bus) and `gps_locations` history
- Public vs operational DTOs (Phase 02)
- Socket.IO `bus:location` / `bus:location:ops` (Phase 04 room checks)
- Leaflet/OSM live map
- IP rate limits (2400 ingest / 180 read per minute)
- `gps-simulator` posting every 2s as Super Admin

Phase 07 improved that stack. It did not add a second GPS or WebSocket system.

## 2. GPS data model

Existing Prisma models only. No new migration.

`GpsLocation` / `GpsLatestLocation`: `busId`, lat/lng `Decimal(10,7)`, speed, heading, timestamp, source, optional device/trip/route/driver ids.

No accuracy/altitude columns were added. Client `accuracy` is not persisted.

## 3. GPS ingestion flow

1. Auth + `gps.ingest`
2. Reject DEVICE source unless `GPS_SOURCE_MODE=DEVICE`
3. Load non-archived bus
4. Super Admin / `gps.manage` may ingest any bus (simulator)
5. Driver may ingest only the assigned vehicle
6. Owners cannot ingest (no `gps.ingest`)
7. Validate coordinates, speed, heading, timestamp
8. Reject city-scale jumps from the last point
9. Persist history + latest using the **bus** route/driver (client `driverId` does not reassign)
10. Broadcast public + operational Socket.IO events
11. Rule-based overspeed / deviation alerts (unchanged)

## 4. Validation rules

| Check | Rule |
| --- | --- |
| Latitude | −90…90 |
| Longitude | −180…180 |
| Speed | 0…200 km/h |
| Heading | 0…360 |
| Timestamp | not > 5 min future (`GPS_TIMESTAMP_FUTURE_SEC`) |
| Timestamp | not > 24 h past (`GPS_TIMESTAMP_PAST_HOURS`) |
| Jump | reject if > 50 km from last point within 1 h (`GPS_MAX_JUMP_KM`) |

Simulator `deviate` (~1.3 km) is allowed. Dhaka→Chattogram teleports are rejected.

## 5. Rate limiting

Unchanged, IP-based, sized for the demo simulator:

- Ingest: **2400 / minute / IP** (16 buses × 2s ≈ 480/min)
- Read: **180 / minute / IP**

Do not log every GPS point as an audit row.

## 6. Live tracking

`GET /api/gps/live` and nearby/location return `trackingState`:

- **ONLINE** — last sample within `GPS_STALE_SECONDS` (default 45)
- **STALE** — older than that threshold

This is independent of vehicle `operationalStatus` (ACTIVE/OFFLINE lifecycle).

Transport owners see only their company’s live points. Public/passenger live remains fleet-wide PUBLIC DTOs (Phase 02).

## 7. Socket.IO flow

- Anyone may join `public:buses` → `bus:location` (PUBLIC DTO)
- Operational `bus:location:ops` goes to SUPER_ADMIN / GOVERNMENT / POLICE / BRTA role rooms
- Owners no longer receive every operator’s ops events; they get `company:{id}` only
- `canJoinSocketRoom` rejects foreign `company:` rooms

## 8. GPS history

`GET /api/gps/buses/:id/history` is authenticated + `buses.read` + resource ownership.

Database `skip`/`take` (max 100 via shared pagination), `from`/`to`, `total`.

Passengers/drivers receive public fields only. Owners cannot read another company’s history.

Retention: documented in `docs/gps-retention.md`. **No automatic delete.**

## 9. Map integration

Existing Leaflet/OSM `LiveMap`:

- Socket updates without reload
- Grey markers for STALE
- Heading rotation
- Selected vehicle caption (speed, last update)
- Fit bounds once (not on every tick)

## 10. Ownership / security

- Driver cannot spoof `busId` for another vehicle
- Owner cannot ingest or read another owner’s private location/history
- GPS cannot change driver ownership
- Public live map remains public-safe (no device/driver/trip ids)

## 11. GPS simulator

`gps-simulator` is **TEST/DEMO DATA**. Not hardware.

Updated to load polylines from `GET /routes` because Phase 05 bus list DTOs no longer embed route polylines. Still authenticates as admin and posts `source: SIMULATION`.

## 12. Database changes

None. Indexes already present: `[busId, timestamp]`, latest `[latitude, longitude]`, `[timestamp]`.

## 13. Performance

Latest table is one row per bus. History is paginated. Nearby still uses bbox + haversine. No N+1 added.

## 14. Tests

**83/83 PASS** (previous baseline 73/73, plus 10 new GPS tests).

## 15. Build results

- Prisma validate: PASS
- Migrations: 3 applied, schema up to date (no new migration)
- Backend `tsc --noEmit`: PASS
- Frontend `next build`: PASS
- DATA LOSS: NONE

## 16. Known limitations

- Simulator is the only ingest source in this demo
- No physical modem, telecom feed, or government GPS
- Jump check is a simple distance cap, not AI anomaly detection
- History is not downsampled (retention policy documented only)
- Socket owner company join is async after connect

NOT CLAIMED:

- Production-ready
- National-scale deployment
- Physical GPS hardware integration
- Real telecom/GPS device deployment
- Government-integrated live GPS
- Real BRTA integration
- Trained AI
- AI-based GPS anomaly detection
