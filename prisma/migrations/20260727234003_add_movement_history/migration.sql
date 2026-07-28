-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('CREATE_PRODUCT', 'UPDATE_PRODUCT', 'STOCK_ENTRY', 'STOCK_EXIT', 'DELETE_PRODUCT');

-- CreateTable
CREATE TABLE "MovementHistory" (
    "id" SERIAL NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER,
    "previousStock" INTEGER,
    "newStock" INTEGER,
    "reason" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryId" INTEGER NOT NULL,
    "productId" INTEGER,
    "userId" TEXT,

    CONSTRAINT "MovementHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MovementHistory" ADD CONSTRAINT "MovementHistory_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementHistory" ADD CONSTRAINT "MovementHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementHistory" ADD CONSTRAINT "MovementHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
