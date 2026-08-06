import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FindMovementsDto } from './dto/find-movements.dto';
import { FindStockDto } from './dto/find-stock.dto';

@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  getMovements(
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindMovementsDto,
  ) {
    return this.movementsService.getMovements(userId, paginationDto);
  }

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

  @Get('stock-entry')
  getStockEntry(
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindStockDto,
  ) {
    return this.movementsService.getStockEntry(userId, paginationDto);
  }

  @Get('stock-exit')
  getStockExit(
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindStockDto,
  ) {
    return this.movementsService.getStockExit(userId, paginationDto);
  }
}
