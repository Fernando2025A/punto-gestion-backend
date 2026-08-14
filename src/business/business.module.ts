import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { BusinessAccessModule } from './business-access/business-access.module';

@Module({
  controllers: [BusinessController],
  providers: [BusinessService],
  imports: [BusinessAccessModule],
})
export class BusinessModule {}
