ALTER TABLE "gps_devices" ADD COLUMN "apiKeyHash" TEXT;
ALTER TABLE "gps_devices" ADD COLUMN "apiKeyHint" TEXT;
ALTER TABLE "gps_devices" ADD COLUMN "connectedAt" TIMESTAMP(3);
ALTER TABLE "gps_devices" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "gps_devices_apiKeyHash_key" ON "gps_devices"("apiKeyHash");
