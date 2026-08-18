-- CreateEnum
CREATE TYPE "LimitType" AS ENUM ('PRODUCTS', 'EMPLOYEES', 'MOVEMENTS', 'IMAGES', 'SUPPLIERS', 'SALES', 'PURCHASES', 'EXPENSES', 'INVITATIONS');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('MOVEMENTS', 'IMAGES', 'SALES', 'PURCHASES', 'EXPENSES', 'INVITATIONS');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "planId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "expireAlertAt" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "activeBusinessId" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlanLimit" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "type" "LimitType" NOT NULL,
    "value" INTEGER,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPermission" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "PlanPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUsage" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "type" "UsageType" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimit_planId_type_key" ON "PlanLimit"("planId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPermission_planId_permission_key" ON "PlanPermission"("planId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "BusinessUsage_businessId_idx" ON "BusinessUsage"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUsage_businessId_type_periodStart_key" ON "BusinessUsage"("businessId", "type", "periodStart");

-- AddForeignKey
ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPermission" ADD CONSTRAINT "PlanPermission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUsage" ADD CONSTRAINT "BusinessUsage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
