# PHASE 11 — PASSENGER MOBILE / WEB

## 1. Existing passenger architecture

Passengers already used JWT + `PASSENGER` role, Next.js pages under `/passenger/*`, and a four-tab Flutter demo in `mobile/lib`. Backend already had public GPS DTOs, route catalog, complaint create/list, SOS create, and notifications.

This phase improved those surfaces. It did not add a second auth, GPS, map, or complaint system.

## 2. Features already present

- Register/login as passenger only
- Home nearby GPS + route catalog
- Shared Leaflet live map
- SOS create + complaint create
- Notification list API
- Flutter login/register/home/map/routes/safety tabs

## 3. Features improved

- Passenger dashboard with links to nearby buses and routes
- Backend route search includes stop names; paginated passenger search UI
- Route and bus detail pages (passenger-safe fields)
- Complaints: own list + submit
- Notifications: mark one / mark all read (IDOR fixed)
- Profile: name, phone, emergency fields, password
- Passenger map listens only to public `bus:location`
- Flutter: route search + detail sheet, own complaints/notifications, SOS uses device GPS when available

## 4. API changes

- `GET /routes?q=` also matches stop names
- `PATCH /auth/me` self-profile (no roles)
- `PUT /notifications/:id/read` requires the row to belong to the caller
- `GET /complaints/:id` no longer returns a raw Prisma bus
- Compliance and GPS history require an ops role (passenger-only 403)
- Complaint create notifies admin/government + the bus’s company owner only

## 5. Database changes

None. No Lost & Found table (none existed; not invented). No reset.

## 6. Authentication / RBAC

Unchanged role set. Passengers still cannot manage users, analytics, alerts, SOS lists, or compliance. `PATCH /auth/me` cannot assign roles.

## 7. GPS integration

Phase 07 public live/nearby endpoints. History blocked for passengers. Simulator data remains labeled SIMULATED.

## 8. Map integration

Existing Leaflet / OSM `LiveMap`. Passenger map does not subscribe to `bus:location:ops` or `route:status`. Flutter map still uses a snapshot of `/gps/live`.

## 9. Socket.IO

Existing server. Passengers stay on `public:buses`. Room join rules unchanged.

## 10. Notification integration

Existing `Notification` rows. UI can mark read. Callers cannot mark another user’s notification.

## 11. Complaint integration

Existing `Complaint` model and categories. Passengers list only their own rows. Cross-passenger GET remains 403.

## 12. Emergency / SOS limitations

`POST /sos` remains the passenger entry point. It records an event for police/admin monitoring. It is **not** connected to real police, ambulance, or fire dispatch. Full response is Phase 12.

## 13. Flutter changes

`mobile/lib/src/api.dart` (PATCH), `passenger_home.dart` (search, details, complaints, notifications, geolocator SOS). No Android/iOS folders were added (`flutter create .` is still required to run on a device).

## 14. Next.js changes

`PassengerViews.tsx` plus `/passenger/routes/[id]` and `/passenger/buses/[id]`. Shared `DashboardView` / police / admin pages were not replaced.

## 15. Security improvements

Notification IDOR, complaint bus leak, passenger compliance/history block, complaint notification scope, public-only map events.

## 16. Performance

Route/bus lists paginated. Dashboard uses nearby (radius) not full GPS history. Search is server-side.

## 17. Tests

`backend/tests/passenger.test.ts` plus previous suite. Previous baseline 104/104. Final: **108/108 PASS**.

## 18. Build results

- Prisma validate: PASS (no migration)
- Backend tests: 108/108 PASS
- Backend `tsc` / build: PASS
- Frontend `tsc --noEmit`: PASS
- Frontend `next build`: PASS
- Flutter SDK: not installed in this environment (source under `mobile/lib` reviewed; `flutter create .` still required for device builds)
- Database: no reset, no deleted rows

## 19. Known limitations

- No ticketing / passenger trip history (page remains an honest stub)
- No Lost & Found module
- Flutter has no live Socket.IO map updates
- No FCM / APNs push
- Platform folders for Flutter are not in the repo
- GPS remains simulated unless `GPS_SOURCE_MODE=DEVICE`

## 20. Future improvements

Phase 12 SOS lifecycle, optional favorites UI, Flutter socket map, official app-store packaging.

NOT CLAIMED:

- Production-ready national passenger deployment
- National-scale infrastructure
- Real government / BRTA / police / ambulance integration
- Physical GPS hardware
- Commercial push notifications
- AI passenger prediction
- Trained AI
- Official government transport data
