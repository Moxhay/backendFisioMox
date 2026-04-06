/*
  Warnings:

  - You are about to drop the column `isRefunded` on the `payments` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "isRefunded",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'eur',
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "physio_services" (
    "id" TEXT NOT NULL,
    "physioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physio_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physio_services_physioId_idx" ON "physio_services"("physioId");

-- CreateIndex
CREATE INDEX "physio_services_physioId_isActive_idx" ON "physio_services"("physioId", "isActive");

-- CreateIndex
CREATE INDEX "appointments_serviceId_idx" ON "appointments"("serviceId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "physio_services" ADD CONSTRAINT "physio_services_physioId_fkey" FOREIGN KEY ("physioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "physio_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
