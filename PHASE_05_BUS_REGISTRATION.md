# PHASE 05 — BUS REGISTRATION & VEHICLE MANAGEMENT

## 1. Executive Summary

Phase 05 completed the existing bus/vehicle module instead of adding a second `/vehicles` stack. Registration, ownership, manual/simulated verification, operational status, list filters, role-safe DTOs, trip-start blocks, and owner/admin/BRTA UI now sit on the Phase 01–04 `Bus` model and `/api/buses` API.

No Prisma schema change was required. The database was not reset. Historical GPS and trips remain intact.

**Not claimed:** production-ready, national-scale, government-integrated, hardware GPS, or trained AI.

## 2. Existing Vehicle Module

| Area | Before | After |
| --- | --- | --- |
| Prisma `Bus` | Present with Bangladesh-oriented status enums | Unchanged (reused) |
| APIs | GET/POST/PUT/DELETE `/buses` | Same paths + PATCH status + PATCH verification |
| Ownership | Owner create checked `companyId` but PUT trusted `req.body` | Session company forced; privileged fields blocked |
| Verification | Fields existed; any manager could set them on PUT | `buses.verify` for SUPER_ADMIN + BRTA only |
| List | Pagination only | Search, filters, sort, DB pagination, DTOs |
| UI | Read-only tables | Functional admin/owner desk; BRTA verification desk |
| Trips | No status/verification gate | Suspended / offline / unverified cannot start |

## 3. Vehicle Data Model

Existing fields only: `registrationNo`, `vehicleType`, manufacturer/model/year, `capacity`, `companyId`, `routeId`, `driverId`, `fitnessStatus`, `registrationStatus`, `insuranceStatus`, `operationalStatus`, timestamps, `deletedAt`.

No new columns. `OFFLINE` is the retired/out-of-service operational state.

## 4. Registration Workflow

Authorized: `SUPER_ADMIN`, `TRANSPORT_OWNER` (`buses.manage`).

Create validates registration number, type, and capacity (8–80). New rows are PENDING / NONE / INACTIVE. Owner company is taken from the authenticated owner account.

## 5. Ownership Model

Owner A cannot read, update, archive, or reassign Owner B's vehicles. Super Admin may change `companyId`; that write is audited as `bus.ownership`. Drivers see assigned vehicles only.

## 6. Verification Workflow

**MANUAL / SIMULATED VERIFICATION.** `PATCH /api/buses/:id/verification` requires `buses.verify`. Owners who send verification fields on PUT receive 403. No live BRTA API.

## 7. Vehicle Status

Operational: ACTIVE, INACTIVE, MAINTENANCE, OFFLINE.

`POST /api/trips/start` requires ACTIVE + registration ACTIVE + fitness FIT and no `deletedAt`. Historical trips/GPS are not deleted on status change or archive.

## 8. API Changes

- Hardened GET/POST/PUT/DELETE `/api/buses` and `/api/buses/:id`
- Added `PATCH /api/buses/:id/status`
- Added `PATCH /api/buses/:id/verification`
- List query: `q`, status/type filters, `sortBy`/`sortDir`, `page`/`pageSize`
- Role-specific response DTOs

## 9. Backend Changes

- `backend/src/services/bus.service.ts` — create/list/update/status/verify/archive
- `backend/src/utils/busDto.ts` — registration rules, trip eligibility, projections
- `backend/src/routes/fleet.routes.ts` — validation + permission wiring
- `backend/src/routes/trip.routes.ts` — eligibility gate
- `backend/src/utils/permissions.ts` — `buses.verify`
- `backend/src/middlewares/audit.ts` — `res.locals.entityId` for creates
- `backend/prisma/seed.ts` — permission catalogue entry (runtime matrix is still in code)

## 10. Frontend Changes

- `VehicleDesk` for admin, owner, BRTA, and government (readonly)
- Register / edit / status / archive for managers
- Verification panel labeled manual/simulated for admin/BRTA
- Search, filters, pagination, empty/loading/error/success states
- Passenger and driver pages remain table views; driver list is assignment-scoped by the API

## 11. Security & RBAC

Unauthenticated, passenger, and driver create attempts are denied. Direct API access is enforced independently of the UI. Frontend hiding is not the control plane.

## 12. Resource Ownership

`ownerCompanyId` / `assertCanViewBus` apply to list, get, update, status, and archive. Driver GET is limited to `driverId`. Passenger responses omit private verification/device/owner internals.

## 13. Database Changes

None. No new migration. `prisma migrate reset` was not used. PostgreSQL volumes were not deleted.

**DATA LOSS: NONE**

## 14. Audit Logging

Existing `auditAction` middleware:

- `bus.create`, `bus.update`, `bus.status`, `bus.verify`, `bus.delete` (archive)
- Extra `bus.ownership` row when an admin changes `companyId`

No passwords, tokens, or secrets are logged.

## 15. Tests

**61/61 PASS** (previous baseline 47/47, plus 14 new vehicle tests).

Coverage added for create/read/update/list/filter/search, status, verification, ownership, unauthorized access, invalid/duplicate registration, invalid capacity, and trip start blocks.

- Prisma validate: PASS
- Migrations: 3 applied, schema up to date (no new migration)
- Backend `tsc --noEmit`: PASS
- Frontend `next build`: PASS

## 16. Performance

List uses SQL `skip`/`take`, filtered `where`, and `count` in parallel. Route polylines and GPS devices are no longer loaded on every list row. No new index: `registrationNo` is unique and `operationalStatus` / `companyId` are already indexed.

## 17. Files Modified

- `backend/src/utils/permissions.ts`
- `backend/src/utils/busDto.ts` (new)
- `backend/src/services/bus.service.ts` (new)
- `backend/src/routes/fleet.routes.ts`
- `backend/src/routes/trip.routes.ts`
- `backend/src/middlewares/audit.ts`
- `backend/prisma/seed.ts`
- `backend/tests/buses.test.ts` (new)
- `backend/tests/bus-rules.test.ts` (new)
- `backend/tests/permissions.test.ts`
- `frontend/src/components/pages/VehicleDesk.tsx` (new)
- `frontend/src/app/admin/buses/page.tsx`
- `frontend/src/app/owner/buses/page.tsx`
- `frontend/src/app/brta/vehicles/page.tsx`
- `frontend/src/app/brta/fitness/page.tsx`
- `frontend/src/app/government/buses/page.tsx`
- `docs/bus-registration.md` (new)
- `PHASE_05_BUS_REGISTRATION.md` (this file)

## 18. Remaining Issues

- Demo BRTA role is not a live government connection
- No vehicle document uploads
- Driver verification remains Phase 06
- Route compliance remains Phase 08
- Soft-archived vehicles are hidden from lists; recovery UI is not built
- Frontend browser click-through depends on a running local stack

## 19. Future Improvements

- Official BRTA registration/fitness/tax APIs (**FUTURE**)
- Dedicated RETIRED enum if operations need it
- Vehicle document vault
- Richer assignment history UI (without replacing Phase 06/08)
