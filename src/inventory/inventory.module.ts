import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsModule } from 'src/products/products.module';
import { MovementsModule } from 'src/movements/movements.module';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  imports: [ProductsModule, MovementsModule],
  exports: [InventoryService],
})
export class InventoryModule {}
