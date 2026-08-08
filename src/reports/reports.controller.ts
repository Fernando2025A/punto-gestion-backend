import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { InventoryService } from 'src/inventory/inventory.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly inventoryService: InventoryService,
  ) {}

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

  @Get('low-rotation')
  getLowRotation(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.reportsService.getLowRotationProducts(businessId, id);
  }

  @Get('month')
  getCurrentMonthProfits(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.reportsService.getCurrentMonthProfits(businessId, id);
  }

  @Get('expiring-soon')
  getExpiringSoonProducts(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.reportsService.getExpiringSoonProducts(businessId, id);
  }
}
