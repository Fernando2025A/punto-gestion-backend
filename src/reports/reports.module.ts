import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [BusinessAccessModule, InventoryModule],
})
export class ReportsModule {}
