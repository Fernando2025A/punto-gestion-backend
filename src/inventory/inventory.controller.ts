import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { type JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getResume(@CurrentUser() user: JwtPayload) {
    return this.inventoryService.getResume(user);
  }
}
