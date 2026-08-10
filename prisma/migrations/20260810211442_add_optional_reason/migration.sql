-- AlterTable
ALTER TABLE "MovementHistory" ALTER COLUMN "reason" DROP NOT NULL,
ALTER COLUMN "reason" DROP DEFAULT;
