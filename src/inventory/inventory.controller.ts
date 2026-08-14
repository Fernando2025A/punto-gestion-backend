import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';

@UseGuards(PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Permissions(Permission.VIEW_DASHBOARD)
  @Get()
  getResume(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getResume(id, businessId);
  }

  @Permissions(Permission.VIEW_CATEGORIES)
  @Get('categories')
  getCategories(
    @CurrentUser('id') id: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.inventoryService.getCategories(id, businessId);
  }
}
