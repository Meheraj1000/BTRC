-- Complaint backfill and Lost & Found schema for Phase 13

CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "LostFoundItemKind" AS ENUM ('LOST', 'FOUND');
CREATE TYPE "LostFoundStatus" AS ENUM ('LOST', 'FOUND', 'MATCHED', 'CLAIM_PENDING', 'RETURNED', 'CLOSED', 'CANCELLED');
CREATE TYPE "LostFoundClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOST_FOUND';

ALTER TABLE "complaints"
  ADD COLUMN IF NOT EXISTS "reference" TEXT,
  ADD COLUMN IF NOT EXISTS "subject" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "routeId" TEXT,
  ADD COLUMN IF NOT EXISTS "tripId" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNote" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY "createdAt", id) AS rn
  FROM "complaints"
)
UPDATE "complaints" AS c
SET
  "reference" = COALESCE(c."reference", 'CMP-' || lpad(numbered.rn::text, 6, '0')),
  "subject" = COALESCE(c."subject", c."category"::text)
FROM numbered
WHERE c.id = numbered.id;

ALTER TABLE "complaints"
  ALTER COLUMN "reference" SET NOT NULL,
  ALTER COLUMN "subject" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "complaints_reference_key" ON "complaints"("reference");
CREATE INDEX IF NOT EXISTS "complaints_priority_createdAt_idx" ON "complaints"("priority", "createdAt");
CREATE INDEX IF NOT EXISTS "complaints_routeId_idx" ON "complaints"("routeId");

ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "complaints_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "complaints_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "lost_found_items" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "LostFoundItemKind" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'LOST',
    "claimStatus" "LostFoundClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reporterId" TEXT NOT NULL,
    "reporterRole" TEXT NOT NULL,
    "busId" TEXT,
    "routeId" TEXT,
    "driverId" TEXT,
    "tripId" TEXT,
    "lostAt" TIMESTAMP(3),
    "foundAt" TIMESTAMP(3),
    "locationText" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "internalNote" TEXT,
    "claimNote" TEXT,
    "claimEvidence" TEXT,
    "matchedItemId" TEXT,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lost_found_items_reference_key" ON "lost_found_items"("reference");
CREATE INDEX IF NOT EXISTS "lost_found_items_kind_status_createdAt_idx" ON "lost_found_items"("kind", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "lost_found_items_reporterId_createdAt_idx" ON "lost_found_items"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "lost_found_items_busId_idx" ON "lost_found_items"("busId");
CREATE INDEX IF NOT EXISTS "lost_found_items_routeId_idx" ON "lost_found_items"("routeId");
CREATE INDEX IF NOT EXISTS "lost_found_items_driverId_idx" ON "lost_found_items"("driverId");
CREATE INDEX IF NOT EXISTS "lost_found_items_tripId_idx" ON "lost_found_items"("tripId");

ALTER TABLE "lost_found_items"
  ADD CONSTRAINT "lost_found_items_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_busId_fkey"
    FOREIGN KEY ("busId") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_claimedById_fkey"
    FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "lost_found_items_matchedItemId_fkey"
    FOREIGN KEY ("matchedItemId") REFERENCES "lost_found_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;