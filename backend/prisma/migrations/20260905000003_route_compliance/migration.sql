-- Phase 08: route lookup indexes + compliance state/events.
-- Additive only. Does not drop or rewrite existing route/GPS/vehicle rows.

CREATE TYPE "RouteComplianceStatus" AS ENUM ('UNASSIGNED', 'ON_ROUTE', 'NEAR_ROUTE', 'DEVIATING', 'OFF_ROUTE', 'STALE');

CREATE INDEX "routes_companyId_idx" ON "routes"("companyId");

CREATE INDEX "routes_deletedAt_idx" ON "routes"("deletedAt");

CREATE INDEX "bus_assignments_busId_endedAt_idx" ON "bus_assignments"("busId", "endedAt");

CREATE TABLE "route_compliance_states" (
    "busId" TEXT NOT NULL,
    "routeId" TEXT,
    "status" "RouteComplianceStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "deviationM" DECIMAL(8,2),
    "consecutiveOff" INTEGER NOT NULL DEFAULT 0,
    "consecutiveOn" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_compliance_states_pkey" PRIMARY KEY ("busId")
);

CREATE TABLE "route_compliance_events" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "routeId" TEXT,
    "fromStatus" "RouteComplianceStatus" NOT NULL,
    "toStatus" "RouteComplianceStatus" NOT NULL,
    "deviationM" DECIMAL(8,2),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_compliance_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "route_compliance_states_status_idx" ON "route_compliance_states"("status");

CREATE INDEX "route_compliance_states_routeId_idx" ON "route_compliance_states"("routeId");

CREATE INDEX "route_compliance_events_busId_createdAt_idx" ON "route_compliance_events"("busId", "createdAt");

CREATE INDEX "route_compliance_events_routeId_createdAt_idx" ON "route_compliance_events"("routeId", "createdAt");

CREATE INDEX "route_compliance_events_toStatus_createdAt_idx" ON "route_compliance_events"("toStatus", "createdAt");

ALTER TABLE "route_compliance_states" ADD CONSTRAINT "route_compliance_states_busId_fkey" FOREIGN KEY ("busId") REFERENCES "buses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_compliance_states" ADD CONSTRAINT "route_compliance_states_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "route_compliance_events" ADD CONSTRAINT "route_compliance_events_busId_fkey" FOREIGN KEY ("busId") REFERENCES "buses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_compliance_events" ADD CONSTRAINT "route_compliance_events_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
