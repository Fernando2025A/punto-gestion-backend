import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { IsAdmin } from './is-admin.decorator';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

@UseGuards(AdminGuard)
@IsAdmin()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getData() {
    return { status: 'ok' };
  }

  @UseGuards(AdminGuard)
  @IsAdmin()
  @Post('upgrade')
  upgradePlan(@Body() dto: UpgradePlanDto) {
    return this.adminService.updateBusinessPlan(dto.businessId, dto.planId);
  }
}
