import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsModule } from 'src/products/products.module';
import { MovementsModule } from 'src/movements/movements.module';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  imports: [ProductsModule, MovementsModule, BusinessAccessModule],
  exports: [InventoryService],
})
export class InventoryModule {}
