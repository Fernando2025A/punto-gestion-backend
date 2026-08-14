import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
  imports: [BusinessAccessModule],
})
export class SuppliersModule {}
