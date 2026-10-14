# Database

Canonical reference: [database-architecture.md](./database-architecture.md).

PostgreSQL with Prisma. Schema: `backend/prisma/schema.prisma`.

## Tables

users, roles, permissions, user_roles, role_permissions, refresh_tokens,
passengers, passenger_favorites, drivers, driver_documents,
transport_companies, buses, gps_devices, routes, route_stops,
bus_assignments, driver_assignments, trips, gps_locations,
gps_latest_locations, alerts, sos_requests, complaints, accidents,
violations, notifications, analytics, audit_logs, system_settings.

## Relationships

- User → roles (M:N)
- User → Passenger / Driver / TransportCompany owner (1:1)
- Company → buses, drivers
- Bus → route, driver, GPS device
- Trip → bus, driver, route, GPS samples
- Latest location is denormalized per bus for live maps
- Complaints and SOS resolve to users and (optionally) buses

## Migrations

History lives in `backend/prisma/migrations/`. Existing demo databases that
were created with `db push` were baselined with `migrate resolve --applied`
(no reset, no volume delete). Fresh environments should use
`npx prisma migrate deploy` then seed. Do not run `prisma migrate reset`
against a database that contains data you need.

## Indexes

Live queries use `gps_latest_locations.busId` (PK),
`gps_latest_locations (latitude, longitude)`,
`gps_latest_locations (timestamp)`,
`gps_locations (busId, timestamp)`, `alerts (type, status)`,
`trips (status)`, plus SOS/complaint/notification/audit indexes in the schema.

## Soft delete

`deletedAt` on users, passengers, drivers, companies, buses, devices, routes.

## Timezone

Application time is Asia/Dhaka. Timestamps are stored in UTC by PostgreSQL
and displayed in Dhaka time in the UI.
