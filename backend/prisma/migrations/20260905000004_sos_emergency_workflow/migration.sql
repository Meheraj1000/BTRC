-- Phase 12: extend existing SosRequest for application-level emergency workflow.
-- Backward-compatible: existing rows and enum values are preserved.

ALTER TYPE "SosStatus" ADD VALUE IF NOT EXISTS 'INVESTIGATING';
ALTER TYPE "SosStatus" ADD VALUE IF NOT EXISTS 'RESPONDING';
ALTER TYPE "SosStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "SosStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

CREATE TYPE "SosLocationSource" AS ENUM ('DEVICE', 'VEHICLE', 'PROVIDED', 'UNAVAILABLE');

ALTER TABLE "sos_requests" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "sos_requests" ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "alertId" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "locationSource" "SosLocationSource" NOT NULL DEFAULT 'UNAVAILABLE';
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "locationAt" TIMESTAMP(3);
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "sos_requests" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "sos_requests_idempotencyKey_key" ON "sos_requests"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "sos_requests_userId_status_idx" ON "sos_requests"("userId", "status");
CREATE INDEX IF NOT EXISTS "sos_requests_createdAt_idx" ON "sos_requests"("createdAt");

ALTER TABLE "sos_requests" ADD CONSTRAINT "sos_requests_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sos_requests" ADD CONSTRAINT "sos_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
