-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CameraSource" AS ENUM ('SIMULATED', 'HLS');

-- CreateTable
CREATE TABLE "street_cameras" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'ONLINE',
    "source" "CameraSource" NOT NULL DEFAULT 'SIMULATED',
    "streamUrl" TEXT,
    "facing" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "street_cameras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "street_cameras_code_key" ON "street_cameras"("code");

-- CreateIndex
CREATE INDEX "street_cameras_city_idx" ON "street_cameras"("city");
