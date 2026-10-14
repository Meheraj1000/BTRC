# PHASE 06 — DRIVER MANAGEMENT & VERIFICATION

## 1. Existing driver functionality

The project already had a `Driver` Prisma model linked to `User` (auth identity) and optional `TransportCompany`. APIs existed at `/api/drivers` (GET/POST/GET:id/PUT). Owners were scoped on list/get, but:

- Create trusted client `companyId` and `licenseStatus`
- PUT accepted raw `req.body` (mass assignment)
- List loaded every driver with no pagination/search
- No verification, status, or assignment endpoints
- Frontend pages were read-only tables
- Vehicle assignment in Phase 05 only checked company, not license/status

## 2. Changes made

Improved the existing `/api/drivers` module. No second driver stack. No schema migration.

- Session-derived owner company on create
- New drivers start `licenseStatus=PENDING` (manual / simulated)
- Role-safe DTOs; `nidReference` and password hashes never returned
- Paginated list with search and filters
- PATCH status / verification / assignment
- Soft archive (no hard delete)
- License eligibility used by assignment and trip start
- Admin / owner / BRTA `DriverDesk` UI

## 3. Driver data model

Existing fields only:

| Field | Use |
| --- | --- |
| `userId` | Auth identity (email/phone/password live on `User`) |
| `companyId` | Operator / owner |
| `licenseNumber` | Unique license |
| `licenseStatus` | PENDING / VALID / EXPIRED / SUSPENDED — used as verification |
| `licenseExpiry` | Date used for eligibility, not as a government API |
| `experienceYears` | Profile |
| `status` | ACTIVE / INACTIVE / SUSPENDED (`UserStatus`) |
| `deletedAt` | Archive |

No new columns. No license class, DOB, or address added. `nidReference` remains stored on demo rows but is not exposed.

## 4. Validation rules

- License: normalized uppercase, `[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]`, unique
- Phone: Bangladesh `01[3-9]XXXXXXXX` when provided
- Email + password required when creating a new user (password policy 8–72, letter + number)
- `userId` link cannot attach privileged roles or an existing driver profile
- Invalid dates rejected
- Duplicate license / email → 409

## 5. Verification workflow

**MANUAL / SIMULATED.** Existing `licenseStatus` is the verification field (no second enum).

`PATCH /api/drivers/:id/verification` requires `drivers.verify` (`SUPER_ADMIN`, `BRTA`).

Owners cannot set `licenseStatus` via PUT or PATCH. Dates never auto-mark a driver as government-verified.

## 6. Status management

- ACTIVE / INACTIVE: owner or admin
- SUSPENDED: admin only
- Archive: `deletedAt` + INACTIVE; blocked while a trip is in progress
- No RETIRED enum; INACTIVE / archive covers leaving service

## 7. Ownership rules

Transport owners see and mutate only their company’s drivers. Owner A cannot read, update, archive, verify, or assign Owner B’s drivers. Super Admin may change `companyId` (audited as `driver.ownership`).

## 8. Vehicle assignment rules

`PATCH /api/drivers/:id/assignment` `{ busId }` or `{ busId: null }`.

Before assign:

1. Driver exists and is in-scope
2. Same operator as the vehicle
3. Driver `status=ACTIVE`
4. License VALID (or expiring soon) and not past expiry
5. Vehicle exists, not archived, not OFFLINE, registration not SUSPENDED

History is written to `DriverAssignment`. Phase 05 bus `driverId` updates use the same eligibility helper.

## 9. API changes

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/drivers` | `drivers.read` — paginated |
| POST | `/drivers` | `drivers.manage` |
| GET | `/drivers/:id` | `drivers.read` + ownership |
| PUT | `/drivers/:id` | `drivers.manage` + ownership |
| PATCH | `/drivers/:id/status` | `drivers.manage` |
| PATCH | `/drivers/:id/verification` | `drivers.verify` |
| PATCH | `/drivers/:id/assignment` | `drivers.manage` |
| DELETE | `/drivers/:id` | `drivers.manage` — archive only |

## 10. Frontend changes

`DriverDesk` on admin, owner, BRTA drivers, and BRTA licenses. Register / edit / status / assign / archive for managers. Verification panel for admin/BRTA. Government `/government/drivers` remains the existing analytics table (not a management surface).

## 11. Security improvements

IDOR on foreign driver ids returns 403. Client `companyId` cannot reassign ownership. Privileged fields stripped for owners. Police projection omits email/phone. Trip start rejects ineligible drivers. Previous Phase 04/05 controls unchanged.

## 12. Database changes

None. No new migration. `prisma migrate reset` was not used.

**DATA LOSS: NONE**

## 13. Tests

**73/73 PASS** (previous baseline 61/61, plus 12 new driver tests).

Coverage: create/read/update/list, ownership IDOR, unauthorized verification, BRTA verify, invalid/duplicate license, invalid phone, pending/expired/suspended assignment blocks, same-operator assign, cross-owner assign deny.

## 14. Build results

- Prisma validate: PASS
- Migrations: 3 applied, schema up to date (no new migration)
- Backend `tsc --noEmit`: PASS
- Frontend `next build`: PASS
- DATA LOSS: NONE

## 15. Known limitations

- Verification is staff-entered, not a live BRTA API
- No driver document vault / NID workflow
- No license class / category field
- Soft-archived drivers have no recovery UI
- Detailed trip management remains a later phase

NOT CLAIMED:

- Production-ready
- National-scale deployment
- Real BRTA integration
- Real government verification API
- Hardware GPS integration
- Trained AI system
