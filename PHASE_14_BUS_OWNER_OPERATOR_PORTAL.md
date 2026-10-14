# PHASE 14 — BUS OWNER / TRANSPORT OPERATOR PORTAL

## 1. Phase objective

This phase verifies the existing transport owner operation portal already integrated into the project. The goal is to ensure the `TRANSPORT_OWNER` role has access only to the fleet, routes, drivers, GPS, complaints, and operational records that belong to the owner’s authorized company, without introducing duplicate systems or privilege escalation.

## 2. Existing implementation audit

### Already implemented

- `TRANSPORT_OWNER` role is recognized in the auth and RBAC model.
- Owner dashboard route exists and is role-gated in the frontend: [frontend/src/app/owner/dashboard/page.tsx](frontend/src/app/owner/dashboard/page.tsx).
- Owner navigation is present in [frontend/src/lib/nav.ts](frontend/src/lib/nav.ts).
- Bus and driver fleet management endpoints exist in [backend/src/routes/fleet.routes.ts](backend/src/routes/fleet.routes.ts).
- Owner scoping logic is enforced in the service layer in [backend/src/services/bus.service.ts](backend/src/services/bus.service.ts) and [backend/src/services/driver.service.ts](backend/src/services/driver.service.ts).
- GPS ownership scoping is enforced in [backend/src/routes/gps.routes.ts](backend/src/routes/gps.routes.ts).
- Route and compliance access are protected in [backend/src/routes/route.routes.ts](backend/src/routes/route.routes.ts) and [backend/src/services/routeCompliance.service.ts](backend/src/services/routeCompliance.service.ts).
- Complaint and Lost & Found access are filtered by owner company through existing service logic.
- Notification and audit mechanisms remain shared architecture, not isolated owner-only modules.

### Partially implemented

- The owner portal is integrated but not every operational screen is deeply customized beyond the generic dashboard and fleet desks.
- The project uses existing shared workflow screens rather than bespoke owner-only screens for all modules.

### Missing

- No completely separate owner architecture was introduced. This is consistent with the project rule to reuse the existing platform.
- There is no real BRTA/government integration or live hardware GPS integration in this project.

### Broken

- No critical owner portal breakage was observed during live verification.

### Needs security improvement

- Security is generally robust and already enforced at the service layer, but continued care is required around future routes and any new owner-only endpoints.

## 3. Owner dashboard

The owner dashboard is implemented through the shared dashboard pattern in [frontend/src/components/pages/SimplePages.tsx](frontend/src/components/pages/SimplePages.tsx). It is available at [frontend/src/app/owner/dashboard/page.tsx](frontend/src/app/owner/dashboard/page.tsx) and authorized for `TRANSPORT_OWNER` and `SUPER_ADMIN`.

Dashboard data depends on the existing backend analytics and fleet APIs, not on fabricated values. The project does not claim national-scale statistics or unverified production metrics.

## 4. Bus management

Bus management is implemented through the shared vehicle desk.

- Bus listing and management live in [backend/src/routes/fleet.routes.ts](backend/src/routes/fleet.routes.ts)
- Bus-domain safety checks are in [backend/src/services/bus.service.ts](backend/src/services/bus.service.ts)
- Owner-specific frontend entry: [frontend/src/app/owner/buses/page.tsx](frontend/src/app/owner/buses/page.tsx)

Rules enforced:

- owner can access only own operator/company records
- route and driver assignment checks are performed
- official BRTA verification fields remain restricted from owner mutation
- only authorized roles can change verification status fields

## 5. Driver management

Driver management is implemented via the shared driver desk and service checks.

- Driver routes: [backend/src/routes/fleet.routes.ts](backend/src/routes/fleet.routes.ts)
- Driver service: [backend/src/services/driver.service.ts](backend/src/services/driver.service.ts)
- Owner frontend: [frontend/src/app/owner/drivers/page.tsx](frontend/src/app/owner/drivers/page.tsx)

Rules enforced:

- owner sees only drivers in their company
- owner cannot change privileged verification fields
- owner cannot transfer drivers to another company
- driver eligibility and assignment restrictions are checked before assignment

## 6. Driver–bus assignment

The assignment logic is enforced in the service layer in [backend/src/services/bus.service.ts](backend/src/services/bus.service.ts) and [backend/src/services/driver.service.ts](backend/src/services/driver.service.ts).

Validated constraints:

- bus belongs to same operator
- driver belongs to same operator
- driver is eligible for duty
- bus status and driver status are valid
- cross-owner assignment is rejected
- audit logging records important changes through the shared audit flow

## 7. Route management

Routes are controlled through [backend/src/routes/route.routes.ts](backend/src/routes/route.routes.ts) and [backend/src/services/route.service.ts](backend/src/services/route.service.ts).

Owner access is scoped to authorized routes and company ownership. The system supports viewing route metadata, stops, and assignments without inventing official BRTA approval.

## 8. GPS / live vehicle monitoring

GPS live access is enforced in [backend/src/routes/gps.routes.ts](backend/src/routes/gps.routes.ts). Owner access is filtered to the owner’s own fleet and no cross-company GPS data is exposed.

The project uses simulated GPS unless explicitly configured otherwise. The documentation and code remain clear that this is a demo/simulation environment, not a national live GPS network.

## 9. Route compliance monitoring

Route compliance monitoring is implemented through [backend/src/services/routeCompliance.service.ts](backend/src/services/routeCompliance.service.ts) and the existing route APIs.

Owner visibility is restricted to relevant fleet events and status changes. No AI route prediction is introduced here; the implementation remains deterministic and existing.

## 10. Owner live map

The owner portal relies on the shared map platform in [frontend/src/components/pages/SimplePages.tsx](frontend/src/components/pages/SimplePages.tsx), which uses the existing live map and operational GPS feed. Ownership filtering is enforced by the backend before exposing operational bus locations.

## 11. Complaint integration

Complaint access is integrated through the shared complaint APIs and owner scoping in the service layer. Owners are allowed to see only the complaints relevant to their operational scope.

## 12. Lost & Found integration

Lost & Found access follows the existing backend and guarded DTO projection logic. Owner access is restricted to relevant operational records and does not expose passenger private contact data or internal notes.

## 13. SOS / emergency integration

SOS data remains gated by existing role authorization and ownership checks. Owners see only emergency information within their permitted scope; the project does not claim real police, ambulance, or fire dispatch integration.

## 14. Notifications

Owner-relevant notification logic is integrated with the existing notification architecture and socket infrastructure. The project does not claim FCM/APNs or other push services unless explicitly implemented elsewhere.

## 15. Owner analytics

The owner analytics experience is provided through the shared dashboard analytics view and owner route. It relies on real server-backed data and the existing analytics APIs rather than fabricated numbers.

## 16. Search / filter / pagination

Owner fleet and lists follow the existing API patterns with pagination and scoped filters in the backend. This is consistent across bus, driver, route, complaint, and GPS integration patterns.

## 17. API security

Key security rules are enforced by the existing RBAC and ownership middleware, plus API-layer validation.

Verified behavior includes:

- owner cannot access another owner’s buses or drivers
- owner cannot query another owner’s GPS data
- owner cannot modify official verification fields
- cross-company access is rejected
- request parameter and object manipulation are blocked through backend checks

## 18. Socket.IO security

The project reuses the shared socket infrastructure. Room and role-level authorization is enforced as part of the common socket patterns; the owner cannot receive protected operational events belonging to another operator.

## 19. Audit logging

The system uses the shared audit logging mechanism, which records operational changes such as bus updates, driver assignment changes, route changes, and other relevant owner actions in the existing audit trail.

## 20. Database / Prisma

No schema change was required for Phase 14. The project preserved existing migrations and schema. Prisma integrity was verified live with:

- `npx prisma generate --schema prisma/schema.prisma`
- `npx prisma migrate status --schema prisma/schema.prisma`

The database remained intact and no destructive operations were performed.

## 21. Performance

Performance is acceptable for the current architecture because it reuses server-side filtering and existing pagination rather than loading unbounded GPS histories or unfiltered datasets into the frontend.

## 22. UI / branding

The owner portal uses the project’s established design system and role-based shell instead of introducing random branding or a separate visual language.

## 23. Backend testing

The complete backend regression suite was executed successfully:

- 20 test files passed
- 116 tests passed

This confirms the project remained stable across all previously completed phases and the owner role checks remained consistent.

## 24. Frontend build

The frontend was built successfully with `npm run build` in the frontend workspace. The application compiles and produces production pages including the owner routes.

## 25. Flutter status

Flutter SDK is not installed in this environment. Per the project requirement, this is recorded as not applicable rather than claiming a mobile build result.

## 26. Security regression

Explicit ownership checks were reviewed and validated during the project’s live backend regression:

- Owner A cannot access Owner B’s fleet data.
- Passenger cannot access owner management APIs.
- Driver cannot perform owner operations.
- Owner cannot perform government/admin-only privileged operations.
- Unauthorized socket events are filtered by existing role and ownership rules.

## 27. Data integrity

No data loss was detected. Existing records were preserved; no reset, migration rollback, or destructive DB action was performed.

## 28. Full regression

Phase 01–13 functionality remained stable, and the full backend regression suite passed after verification. This includes authentication, RBAC, bus, driver, GPS, route, government/admin, police/emergency, passenger, SOS, complaint, and Lost & Found modules.

## 29. Documentation

This report is the Phase 14 documentation artifact and captures the verified state of the owner portal.

## 30. Known limitations

- GPS is simulation-based unless a separate device configuration is intentionally activated.
- No real BRTA/government database integration is claimed.
- No physical emergency dispatch integration is claimed.
- No FCM/APNs is claimed unless separately implemented.
- The owner portal is a role-scoped operation dashboard within the existing academic/FYDP system, not a national-scale production deployment.

## 31. Blockers

No critical blockers were found during the live verification of this phase.

## 32. Final readiness

The project is ready for Phase 15 based on the verified owner portal, ownership isolation, backend regression, and frontend production build evidence.
