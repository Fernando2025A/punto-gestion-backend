import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @Post('upgrade')
  upgradePlan(@Body() dto: UpgradePlanDto) {
    return this.adminService.updateBusinessPlan(dto.businessId, dto.planId);
  }

  @Get('business')
  getBusiness(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('businessId', new ParseIntPipe({ optional: true }))
    businessId?: number,
  ) {
    return this.adminService.getBusinessInfo(page, limit, businessId);
  }
}
