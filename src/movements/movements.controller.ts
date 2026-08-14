import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FindMovementsDto } from './dto/find-movements.dto';
import { FindStockDto } from './dto/find-stock.dto';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';

@Controller('movements')
@UseGuards(PermissionsGuard)
@Permissions(Permission.VIEW_MOVEMENTS)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get('last7days')
  getLast7DaysMov(
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.movementsService.getLast7DaysMovementsSummary(
      userId,
      businessId,
    );
  }

  @Get('stock-entry/:businessId')
  getStockEntry(
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindStockDto,
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.movementsService.getStockEntry(
      userId,
      businessId,
      paginationDto,
    );
  }

  @Get('stock-exit/:businessId')
  getStockExit(
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindStockDto,
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.movementsService.getStockExit(
      userId,
      businessId,
      paginationDto,
    );
  }

  @Get(':businessId')
  getMovements(
    @CurrentUser('id') userId: string,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() paginationDto: FindMovementsDto,
  ) {
    return this.movementsService.getMovements(
      userId,
      businessId,
      paginationDto,
    );
  }
}
