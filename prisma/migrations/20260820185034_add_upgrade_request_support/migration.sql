-- CreateEnum
CREATE TYPE "PlanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PlanUpgradeRequest" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "comment" TEXT,
    "status" "PlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_businessId_status_idx" ON "PlanUpgradeRequest"("businessId", "status");

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
