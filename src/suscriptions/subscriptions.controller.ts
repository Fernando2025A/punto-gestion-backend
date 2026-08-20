import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanRequestDto } from './dto/create-plan-request.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('upgrade-request/:businessId')
  requestUpgrade(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePlanRequestDto,
  ) {
    return this.subscriptionsService.requestPlanUpgrade(
      userId,
      businessId,
      dto,
    );
  }
}
