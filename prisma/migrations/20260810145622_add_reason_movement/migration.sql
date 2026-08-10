/*
  Warnings:

  - The `reason` column on the `MovementHistory` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('SALE', 'WASTE', 'DAMAGED', 'LOSS', 'INTERNAL_USE', 'PURCHASE', 'RETURN', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "MovementHistory" ADD COLUMN     "notes" TEXT,
DROP COLUMN "reason",
ADD COLUMN     "reason" "MovementReason" NOT NULL DEFAULT 'SALE';

-- CreateIndex
CREATE INDEX "MovementHistory_reason_idx" ON "MovementHistory"("reason");
