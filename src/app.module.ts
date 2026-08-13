import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { MovementsModule } from './movements/movements.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BusinessAccessModule } from './business/business-access/business-access.module';
import { ReportsModule } from './reports/reports.module';
import { BusinessInvitesModule } from './business/business-invites/business-invites.module';
import { BusinessEmployeesModule } from './business/business-employees/business-employees.module';
import { BusinessModule } from './business/business.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    BusinessAccessModule,
    MovementsModule,
    SuppliersModule,
    ScheduleModule.forRoot(),
    ReportsModule,
    BusinessInvitesModule,
    BusinessEmployeesModule,
    BusinessModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
