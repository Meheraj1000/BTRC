-- CreateTable
CREATE TABLE "police_areas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "police_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "police_areas_userId_idx" ON "police_areas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "police_areas_userId_city_key" ON "police_areas"("userId", "city");

-- AddForeignKey
ALTER TABLE "police_areas" ADD CONSTRAINT "police_areas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
