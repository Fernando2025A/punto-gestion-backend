// src/business-access/business-access.module.ts
import { Module } from '@nestjs/common';
import { BusinessAccessService } from './business-access.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BusinessAccessService],
  exports: [BusinessAccessService],
})
export class BusinessAccessModule {}
