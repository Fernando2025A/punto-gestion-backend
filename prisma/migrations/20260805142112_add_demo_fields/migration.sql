-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isTemporaly" BOOLEAN NOT NULL DEFAULT false;
