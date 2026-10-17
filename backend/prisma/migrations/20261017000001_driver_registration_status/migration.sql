-- CreateEnum
CREATE TYPE "DriverRegistrationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "registrationStatus" "DriverRegistrationStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "drivers" ADD COLUMN "registrationNote" TEXT;

-- CreateIndex
CREATE INDEX "drivers_registrationStatus_idx" ON "drivers"("registrationStatus");
