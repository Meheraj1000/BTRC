-- AlterTable
ALTER TABLE "buses" ADD COLUMN "qrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "buses_qrToken_key" ON "buses"("qrToken");
