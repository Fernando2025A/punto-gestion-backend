import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getResume(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getResume(id, businessId);
  }

  @Get('low-stock')
  getLowStock(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getLowStock(id, businessId);
  }

  @Get('out-stock')
  getStockOut(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getOutOfStock(id, businessId);
  }

  @Get('categories')
  getCategories(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getCategories(id, businessId);
  }
}
