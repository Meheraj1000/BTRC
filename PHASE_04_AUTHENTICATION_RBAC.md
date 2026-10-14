# PHASE 04 — AUTHENTICATION & ROLE MANAGEMENT

Existing JWT + bcryptjs + code RBAC was audited and hardened. Login was **not** rewritten to cookies. Phase 02/03 GPS, migration, and permission-matrix decisions were left in place.

---

## 1. Executive Summary

Authentication is Bearer JWT (access + hashed rotating refresh) with bcryptjs password hashes. Public registration always creates a PASSENGER. Privileged roles can only be assigned by Super Admin. Inactive/suspended/deleted users cannot log in, and an existing access token is rejected on the next request because middleware re-reads `users.status`.

Ownership gaps closed: favorite delete is scoped to the caller; trip-by-id is scoped for owners and drivers; last Super Admin cannot be demoted or deactivated.

Frontend `AppShell` no longer renders role-restricted children before the allow-list check. Socket room joins use a shared allow-list function.

This is **not** production-ready, national-scale, government-integrated, hardware-GPS, or trained AI.

---

## 2. Existing Authentication Architecture

```
Register/Login → bcryptjs → JWT access + SHA-256 refresh
       → authRequired (verify JWT + ACTIVE) → ROLE_PERMISSIONS → ownership → handler
```

| Feature | Status |
| --- | --- |
| Register / login / logout / refresh / me | IMPLEMENTED |
| Password change | IMPLEMENTED (`POST /api/auth/change-password`) |
| Password reset / email verify | FUTURE / not implemented |
| httpOnly cookies | Not used (Phase 02) |
| Account status ACTIVE/INACTIVE/SUSPENDED | IMPLEMENTED |

---

## 3. Authentication Changes

- Login uses one 401 message for unknown, wrong password, deleted, and inactive (less enumeration)
- `authRequired` / `optionalAuth` load the user row and reject non-ACTIVE accounts
- Deactivate / archive revokes refresh tokens
- `POST /auth/change-password` (current password + policy; rotates tokens)
- Password policy: 8–72 chars, letter + number (bcryptjs unchanged)
- `PUT /api/users/:id/roles` for admin role assignment + audit
- User list supports `q`, `status`, `role`
- `GET /users/meta/roles` moved above `/:id`
- Last Super Admin protection
- Favorite delete ownership
- Trip `:id` owner/driver scope
- Socket `canJoinSocketRoom`
- AppShell withholds page content until role allow-list passes

---

## 4. Password Security

| Check | Result |
| --- | --- |
| Algorithm | bcryptjs cost 12 (kept) |
| Stored plaintext | No |
| Returned in APIs | No (`toPublicUser` / `publicUser`) |
| Logged | Redacted by Winston |
| Compare | `bcrypt.compare` |
| Weak new passwords | Rejected on register / admin create / change-password |

Existing `Demo@12345` hashes remain valid.

---

## 5. JWT/Session Security

- Secrets from env (`JWT_SECRET`, `JWT_REFRESH_SECRET`), min length 16  
- Access default 8h, refresh 7d, rotation on refresh and password change  
- Logout revokes all unrevoked refresh rows  
- Invalid/expired access → 401  
- Tokens not printed (logger denylist)  
- **localStorage kept** — cookie migration would break Flutter, simulator, and Socket.IO `auth.token`  

---

## 6. Registration Security

Validated email/password/name. Duplicate email → 409. Role in the body is ignored; account is PASSENGER. Tested with `role: SUPER_ADMIN`.

---

## 7. Role Matrix

| Capability | SUPER_ADMIN | GOVERNMENT | BRTA | POLICE | OWNER | DRIVER | PASSENGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| users.manage / roles.manage / settings / audit | yes | | | | | | |
| buses/drivers manage | yes | | | | yes (own company) | | |
| companies.manage / gps.manage | yes | | | | | | |
| routes.manage | yes | | | | yes (own company) | | |
| buses/drivers/routes read | yes | yes | yes | yes* | yes | yes | yes |
| gps.ingest | yes | | | | | yes | |
| trips.own / trips.manage | yes | | | | manage | own | |
| analytics / reports | yes | yes | yes | yes | yes | | |
| sos.create | yes | | | | | yes | yes |
| sos.read / sos.manage | yes | yes | | yes | | | |
| complaints.create | yes | | | | | | yes |
| complaints.read | yes | yes | yes | yes | yes | | own |
| alerts.manage | yes | | | yes | | | |

\* Police: buses/drivers/routes read, no companies.read.

---

## 8. Permission Architecture

Unchanged source of truth: `ROLE_PERMISSIONS`. Database table still not consulted at request time. No second permission system added.

---

## 9. Backend Authorization

Protected APIs go through `authRequired` then permission middleware. Public GPS/routes remain intentional. `GET /trips` still requires `trips.own` \| `trips.manage` \| `analytics.read` (Phase 03).

---

## 10. Resource Ownership

| Case | Enforcement |
| --- | --- |
| Owner A vs Owner B bus/driver | `assertOwnerScope` |
| Owner A vs Owner B trip | `GET /trips/:id` company check (Phase 04) |
| Driver A vs Driver B trip | driverId vs authenticated driver |
| Passenger A vs B complaint | existing Phase 02/03 check |
| Passenger A vs B favorite | delete now requires `userId = req.user.id` |
| User A vs B account | `users.manage` only |

---

## 11. Frontend Route Protection

`AppShell` redirects unauthenticated users to `/login` and wrong-role users to their home. Children are not rendered until the allow-list matches. Backend remains authoritative. Next.js middleware cannot see `localStorage` tokens.

---

## 12. Socket.IO Authorization

Anonymous → `public:buses` only. Invalid token treated as anonymous (maps still work). `subscribe` cannot join another user’s room or an ungranted role room. Unit-tested via `canJoinSocketRoom`.

---

## 13. Account Status

Existing enum: ACTIVE / INACTIVE / SUSPENDED. Non-ACTIVE cannot login (401) and cannot use an old access token. Soft `deletedAt` treated the same as unknown for login.

---

## 14. User Management

Super Admin can list (search/filter), create (explicit role), update name/phone/status, assign roles, archive. Admin users page remains a read-only table (UI PARTIAL). Role-assignment API is the administrative mechanism.

---

## 15. Privilege Escalation Prevention

Public register cannot become admin. Passengers cannot call role APIs. Only `users.manage` assigns roles. Last active Super Admin cannot be stripped, inactivated, or archived.

---

## 16. Security Findings

| ID | Finding | Action |
| --- | --- | --- |
| P0 | Deactivated JWT still worked | FIXED (status check) |
| P0 | Favorite delete had no owner check | FIXED |
| P1 | Inactive login returned 403 (enumeration) | FIXED (401) |
| P1 | No admin role-assignment API | FIXED |
| P1 | Trip-by-id unscoped for owner/driver | FIXED |
| P1 | AppShell rendered forbidden children | FIXED |
| P2 | Password change missing | ADDED API (no reset email) |
| P2 | JWT in localStorage | Documented, not rewritten |
| P3 | No password-reset | FUTURE |

---

## 17. Files Modified

**Created:** `backend/src/utils/password.ts`, `socketRooms.ts`, `superAdminGuard.ts`, `tests/auth-rbac.test.ts`, `tests/socket-rooms.test.ts`, `docs/authentication-rbac.md`, `PHASE_04_AUTHENTICATION_RBAC.md`

**Updated:** `auth.ts`, `auth.service.ts`, `auth.routes.ts`, `users.routes.ts`, `trip.routes.ts`, `platform.routes.ts`, `socket.ts`, `frontend/src/components/AppShell.tsx`

---

## 18. Tests

47/47 backend tests PASS (was 31/31).

Covered: valid login, invalid password, unknown user, expired token, invalid token, logout/refresh revoke, no token, all seven roles’ allow/deny paths (existing + new), passenger denied admin/trips, driver denied admin, owner denied foreign bus, passenger denied others’ complaint, role injection ignored, passenger cannot self-assign SUPER_ADMIN, last-admin 409, inactive login + token denied, socket room allow/deny.

Frontend `tsc` + `next build` PASS. Backend `tsc` + `npm run build` PASS.

---

## 19. Remaining Risks

1. localStorage XSS  
2. Access JWT not denylisted (ACTIVE check mitigates deactivation)  
3. No password-reset  
4. Frontend guard is client-side only  
5. Admin role UI still a table  
6. Shared demo password  
7. Rate limits are in-memory per process  

---

## 20. Future Recommendations

Web-only httpOnly cookies; password reset; shorter access TTL; admin user editor UI; Next middleware after cookies.

Do not start Phase 05 until asked.

---

PHASE 04 STATUS: COMPLETED

AUTHENTICATION: IMPROVED

PASSWORD SECURITY: IMPROVED

JWT/SESSION: IMPROVED

RBAC: IMPROVED

RESOURCE OWNERSHIP: IMPROVED

FRONTEND PROTECTION: IMPROVED

BACKEND PROTECTION: IMPROVED

SOCKET AUTHORIZATION: VERIFIED

PRIVILEGE ESCALATION: PREVENTED

TESTS: 47/47 PASS

BACKEND BUILD: PASS

FRONTEND BUILD: PASS

DATA LOSS: NONE

READY FOR PHASE 05: YES

NOT CLAIMED:
- Production-ready
- National-scale
- Government-integrated
- Hardware GPS
- Trained AI
