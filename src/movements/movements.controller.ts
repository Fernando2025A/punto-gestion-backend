import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MovementsService } from './movements.service';
import { FindMovementsDto } from './dto/find-movements.dto';
import { FindStockDto } from './dto/find-stock.dto';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';

@UseGuards(PermissionsGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Permissions(Permission.VIEW_DASHBOARD)
  @Get('last7days')
  getLast7DaysMov(@Query('businessId', ParseIntPipe) businessId: number) {
    return this.movementsService.getLast7DaysMovementsSummary(businessId);
  }

  @Permissions(Permission.VIEW_MOVEMENTS)
  @Get('stock-entry/:businessId')
  getStockEntry(
    @Query() paginationDto: FindStockDto,
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.movementsService.getStockEntry(businessId, paginationDto);
  }

  @Permissions(Permission.VIEW_MOVEMENTS)
  @Get('stock-exit/:businessId')
  getStockExit(
    @Query() paginationDto: FindStockDto,
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.movementsService.getStockExit(businessId, paginationDto);
  }

  @Permissions(Permission.VIEW_MOVEMENTS)
  @Get(':businessId')
  getMovements(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() paginationDto: FindMovementsDto,
  ) {
    return this.movementsService.getMovements(businessId, paginationDto);
  }
}
