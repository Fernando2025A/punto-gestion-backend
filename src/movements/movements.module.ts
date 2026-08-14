import { Module } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';

@Module({
  exports: [MovementsService],
  controllers: [MovementsController],
  providers: [MovementsService],
  imports: [BusinessAccessModule],
})
export class MovementsModule {}
