-- Safe for existing databases that were created with prisma db push
-- before migration history existed. No-op on a fresh migrate deploy.
CREATE INDEX IF NOT EXISTS "gps_latest_locations_latitude_longitude_idx" ON "gps_latest_locations"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "gps_latest_locations_timestamp_idx" ON "gps_latest_locations"("timestamp");
