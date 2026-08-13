import {
  Controller,
  Post,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessInvitesService } from './business-invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Permission } from 'generated/prisma/enums';

@Controller('invites')
export class BusinessInvitesController {
  constructor(private readonly invitesService: BusinessInvitesService) {}

  // POST /invites?businessId=1 (Requiere permisos de invitación)
  @Post()
  @Permissions(Permission.CREATE_INVITATIONS)
  @UseGuards(PermissionsGuard)
  createInvite(
    @Query('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(businessId, userId, dto);
  }

  // POST /invites/join (Cualquier usuario autenticado puede enviar el código)
  @Post('join')
  joinBusiness(@CurrentUser('id') userId: string, @Body('code') code: string) {
    return this.invitesService.joinBusinessByCode(userId, code);
  }
}
