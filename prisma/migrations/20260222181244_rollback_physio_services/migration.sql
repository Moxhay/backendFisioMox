/*
  Warnings:

  - You are about to drop the column `serviceId` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `receiptUrl` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `refundedAt` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the `physio_services` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "physio_services" DROP CONSTRAINT "physio_services_physioId_fkey";

-- DropIndex
DROP INDEX "appointments_serviceId_idx";

-- DropIndex
DROP INDEX "payments_status_idx";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "serviceId";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "currency",
DROP COLUMN "paymentMethod",
DROP COLUMN "receiptUrl",
DROP COLUMN "refundedAt",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "isRefunded" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "physio_services";

-- DropEnum
DROP TYPE "PaymentStatus";
