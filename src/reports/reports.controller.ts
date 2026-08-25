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
import { InventoryService } from 'src/inventory/inventory.service';
import { PeriodDto } from './dto/period.dto';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { type Response } from 'express';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';
import { PaginationDto } from 'src/business/business-employees/dto/pagination.dto';

@UseGuards(PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly inventoryService: InventoryService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('low-stock/:businessId')
  getLowStock(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationDto,
  ) {
    return this.inventoryService.getLowStock(businessId, dto);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('out-stock/:businessId')
  getStockOut(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationDto,
  ) {
    return this.inventoryService.getOutOfStock(businessId, dto);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('low-rotation/:businessId')
  getLowRotation(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationDto,
  ) {
    return this.reportsService.getLowRotationProducts(businessId, 60, dto);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('month')
  getCurrentMonthProfits(
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.reportsService.getCurrentMonthProfits(businessId);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('expiring-soon/:businessId')
  getExpiringSoonProducts(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationDto,
  ) {
    return this.reportsService.getExpiringSoonProducts(businessId, 30, dto);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('resume')
  getResume(@Query('businessId', ParseIntPipe) businessId: number) {
    return this.reportsService.getKPIOverview(businessId);
  }

  @Permissions(Permission.VIEW_REPORTS)
  @Get('business-resume/:businessId')
  getBusinessResume(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() periodDto: PeriodDto,
  ) {
    return this.reportsService.getBusinessResume(businessId, periodDto);
  }

  @Permissions(Permission.EXPORT_REPORTS_EXCEL)
  @Get('excel/:businessId')
  async exportResumeExcel(
    @Query() dto: PeriodDto,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Res() res: Response,
  ) {
    await this.subscriptionsService.validatePermission(businessId, [
      Permission.EXPORT_REPORTS_EXCEL,
    ]);
    const buffer = await this.reportsService.generateBusinessReportExcel(
      businessId,
      dto,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=resumen.xlsx');
    res.send(buffer);
  }

  @Permissions(Permission.EXPORT_REPORTS_PDF)
  @Get('pdf/:businessId')
  async descargarPdf(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PeriodDto,
  ): Promise<StreamableFile> {
    await this.subscriptionsService.validatePermission(businessId, [
      Permission.EXPORT_REPORTS_PDF,
    ]);

    const stream = await this.reportsService.generateBusinessReportPdf(
      businessId,
      dto,
    );

    return new StreamableFile(stream, {
      type: 'application/pdf',
    });
  }
}
