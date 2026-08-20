import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { InventoryService } from 'src/inventory/inventory.service';
import { PeriodDto } from './dto/period.dto';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { ReportsExportService } from './reports-export.service';
import { type Response } from 'express';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';

@Permissions(Permission.VIEW_REPORTS)
@UseGuards(PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly inventoryService: InventoryService,
    private readonly exportService: ReportsExportService,
    private readonly subscriptionsService: SubscriptionsService,
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

  @Get('resume')
  getResume(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.reportsService.getKPIOverview(businessId, id);
  }

  @Get('business-resume/:businessId')
  getBusinessResume(
    @CurrentUser('id') id: string,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() periodDto: PeriodDto,
  ) {
    return this.reportsService.getBusinessResume(id, businessId, periodDto);
  }

  @Get('excel/:businessId')
  async exportResumeExcel(
    @Query() dto: PeriodDto,
    @CurrentUser('id') userId: string,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Res() res: Response,
  ) {
    await this.subscriptionsService.validatePermission(businessId, [
      Permission.EXPORT_REPORTS_EXCEL,
    ]);
    const buffer = await this.reportsService.generateBusinessReportExcel(
      businessId,
      userId,
      dto,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=resumen.xlsx');
    res.send(buffer);
  }

  @Get('pdf/:businessId')
  async descargarPdf(
    @CurrentUser('id') userId: string,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PeriodDto,
  ): Promise<StreamableFile> {
    await this.subscriptionsService.validatePermission(businessId, [
      Permission.EXPORT_REPORTS_PDF,
    ]);

    const stream = await this.reportsService.generateBusinessReportPdf(
      businessId,
      userId,
      dto,
    );

    return new StreamableFile(stream, {
      type: 'application/pdf',
    });
  }
}
