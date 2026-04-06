/*
  Warnings:

  - You are about to drop the column `isCancelled` on the `appointments` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "isCancelled",
ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
ALTER COLUMN "duration" SET DEFAULT 60;

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
