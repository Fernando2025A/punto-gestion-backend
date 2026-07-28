import { Controller, Get } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { type JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  getMovements(@CurrentUser() user: JwtPayload) {
    return this.movementsService.getMovements(user);
  }

  @Get('today')
  getTodayMovements(@CurrentUser() user: JwtPayload) {
    return this.movementsService.getTodayMovements(user.id);
  }
}
