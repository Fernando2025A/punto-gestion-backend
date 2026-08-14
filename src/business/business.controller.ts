import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';

@Controller('business')
@UseGuards(PermissionsGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  // GET /business/my-access -> Lista de negocios para el selector global
  @Get('my-access')
  findAllForUser(@CurrentUser('id') userId: string) {
    return this.businessService.findAllForUser(userId);
  }

  // GET /business/active/1 -> Contexto y permisos del negocio seleccionado
  @Get('active/:id')
  getActiveBusinessContext(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) businessId: number,
  ) {
    return this.businessService.getActiveBusinessContext(userId, businessId);
  }

  // PATCH /business/1 -> Actualizar nombre / descripción
  @Permissions(Permission.UPDATE_BUSINESS)
  @Patch(':businessId')
  updateBusiness(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.updateBusiness(businessId, userId, dto);
  }
}
