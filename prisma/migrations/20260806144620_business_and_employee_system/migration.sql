/*
  Warnings:

  - You are about to drop the column `userId` on the `Inventory` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `purchasePrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[businessId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `businessId` to the `Inventory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('OWNER', 'ADMIN', 'CASHIER', 'STOCKER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_PRODUCT', 'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT', 'REGISTER_STOCK_ENTRY', 'REGISTER_STOCK_EXIT', 'ADJUST_STOCK', 'VIEW_MOVEMENTS', 'VIEW_CATEGORIES', 'CREATE_CATEGORIES', 'UPDATE_CATEGORIES', 'DELETE_CATEGORIES', 'VIEW_SUPPLIERS', 'CREATE_SUPPLIERS', 'UPDATE_SUPPLIERS', 'DELETE_SUPPLIERS', 'VIEW_REPORTS', 'EXPORT_REPORTS_PDF', 'EXPORT_REPORTS_EXCEL', 'VIEW_DASHBOARD', 'VIEW_FINANCIAL_SUMMARY', 'VIEW_EMPLOYEES', 'CREATE_EMPLOYEES', 'UPDATE_EMPLOYEES', 'DELETE_EMPLOYEES', 'MANAGE_EMPLOYEE_PERMISSIONS', 'MANAGE_EMPLOYEE_ROLES', 'CREATE_INVITATIONS', 'DELETE_INVITATIONS', 'VIEW_INVITATIONS', 'VIEW_SETTINGS', 'UPDATE_SETTINGS', 'UPDATE_BUSINESS', 'DELETE_BUSINESS', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'MANAGE_SUBSCRIPTION');

-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_userId_fkey";

-- DropIndex
DROP INDEX "Inventory_userId_key";

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "userId",
ADD COLUMN     "businessId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "purchasePrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "UserToken" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Business" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessInvite" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL DEFAULT 'EMPLOYEE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEmployee" (
    "id" SERIAL NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "permissions" "Permission"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInvite_code_key" ON "BusinessInvite"("code");

-- CreateIndex
CREATE INDEX "BusinessInvite_code_idx" ON "BusinessInvite"("code");

-- CreateIndex
CREATE INDEX "BusinessEmployee_businessId_idx" ON "BusinessEmployee"("businessId");

-- CreateIndex
CREATE INDEX "BusinessEmployee_userId_idx" ON "BusinessEmployee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessEmployee_userId_businessId_key" ON "BusinessEmployee"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_businessId_key" ON "Inventory"("businessId");

-- CreateIndex
CREATE INDEX "MovementHistory_createdAt_idx" ON "MovementHistory"("createdAt");

-- CreateIndex
CREATE INDEX "MovementHistory_inventoryId_createdAt_idx" ON "MovementHistory"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_inventoryId_idx" ON "Product"("inventoryId");

-- CreateIndex
CREATE INDEX "Supplier_inventoryId_idx" ON "Supplier"("inventoryId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessInvite" ADD CONSTRAINT "BusinessInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessInvite" ADD CONSTRAINT "BusinessInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEmployee" ADD CONSTRAINT "BusinessEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEmployee" ADD CONSTRAINT "BusinessEmployee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
