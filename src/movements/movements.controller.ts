import { Controller, Get } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  getMovements(@CurrentUser('id') userId: string) {
    return this.movementsService.getMovements(userId);
  }

  @Get('last7days')
  getLast7DaysMov(@CurrentUser('id') userId: string) {
    return this.movementsService.getLast7DaysMovementsSummary(userId);
  }

  @Get('stock-entry')
  getStockEntry(@CurrentUser('id') userId: string) {
    return this.movementsService.getStockEntry(userId);
  }

  @Get('stock-exit')
  getStockExit(@CurrentUser('id') userId: string) {
    return this.movementsService.getStockExit(userId);
  }
}
