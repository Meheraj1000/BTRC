# Architecture

Canonical map: [system-architecture.md](./system-architecture.md).

Nirapad Transit is a multi-role intelligent transportation platform for Bangladesh.

```
Passenger app (web + Flutter)
Driver app (web + Flutter)
        │
        ▼
REST API + Socket.IO
        │
        ▼
Express / TypeScript services
  Auth & RBAC
  Fleet / routes / trips
  GPS ingest + rule engine
  SOS / complaints / alerts
  Analytics / reports
        │
        ▼
PostgreSQL (Prisma)
```

## Data honesty

| Source | Label | Where |
| --- | --- | --- |
| GPS simulator | SIMULATION / SIMULATED | `gps-simulator/`, `gps_locations.source` |
| Physical device (only if configured) | DEVICE / REAL | `GPS_SOURCE_MODE=DEVICE` |
| Seed / UI records | DEMO | company and route names |
| ML dataset | SYNTHETIC | `ml/data` |
| OpenStreetMap tiles | PUBLIC | Leaflet tile layer |

No government API is integrated. Do not describe this deployment as a live BRTA or police system.

## Real-time path

1. Simulator or device `POST /api/gps/location`
2. Latest location upserted (`gps_latest_locations`)
3. History row inserted (`gps_locations`) — clients never query full history by default
4. Overspeed and route-deviation rules run
5. Socket.IO emits `bus:location` (public DTO) and `bus:location:ops` (operational roles), plus `alert:new`

## AI

- Backend ETA: rule-based prototype
- `ml/`: experimental model comparison on synthetic data
- Accident prediction and traffic forecasting are future work
