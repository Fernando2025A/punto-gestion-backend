import { Module } from '@nestjs/common';
import { BusinessEmployeesService } from './business-employees.service';
import { BusinessEmployeesController } from './business-employees.controller';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';

@Module({
  controllers: [BusinessEmployeesController],
  providers: [BusinessEmployeesService],
  imports: [BusinessAccessModule],
})
export class BusinessEmployeesModule {}
