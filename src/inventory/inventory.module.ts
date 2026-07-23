import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsModule } from 'src/products/products.module';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  imports: [ProductsModule],
})
export class InventoryModule {}
