# GPS retention strategy

Status: **documented only**. Phase 02 does not delete or downsample existing
`gps_locations` rows.

## Problem

The simulator (and any future device) inserts a history row on every ingest.
At 16 buses × 1 sample / 2 seconds that is about 690,000 rows/day. A national
fleet at the same rate would be tens to hundreds of millions of rows per day.

`gps_latest_locations` stays one row per bus and is the live-map source.

## Tiers

| Tier | Window | Store | Use |
| --- | --- | --- | --- |
| Hot | last 7 days | `gps_locations` at ingest resolution | replay, SOS investigation, rule debug |
| Warm | 8–90 days | downsampled (e.g. 1 point / 30–60 s or stop/start only) | route analytics, owner reviews |
| Cold | 90 days–7 years | daily aggregates (`analytics` / new archive table) or object storage | audit, government reporting |
| Latest | current | `gps_latest_locations` | live map, nearby, ETA |

## Why not delete now

- No retention policy was previously configured
- History may be needed for demo audits and FYDP evidence
- Automatic purge without a reviewed window risks destroying academic/demo data

## Suggested later implementation (Phase 03+)

1. Nightly job: copy samples older than 7 days into a downsample table, then
   delete (or partition-drop) hot rows past the window
2. Keep `source`, `busId`, and timestamps so SIMULATION vs DEVICE remains honest
3. Never downsample `gps_latest_locations`
4. Partition `gps_locations` by month before national-scale ingest
5. Do not introduce PostGIS unless nearby queries outgrow bbox + haversine

## Auditability

Alerts, SOS, complaints, and audit_logs already store their own timestamps and
coordinates. GPS history retention must not be the only evidence trail for an
incident.
