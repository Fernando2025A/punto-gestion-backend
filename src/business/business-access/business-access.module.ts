// src/business-access/business-access.module.ts
import { Module } from '@nestjs/common';
import { BusinessAccessService } from './business-access.service';

@Module({
  providers: [BusinessAccessService],
  exports: [BusinessAccessService],
})
export class BusinessAccessModule {}
