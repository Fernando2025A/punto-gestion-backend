import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { BusinessAccessModule } from './business-access/business-access.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  controllers: [BusinessController],
  providers: [BusinessService],
  imports: [BusinessAccessModule, CloudinaryModule],
})
export class BusinessModule {}
