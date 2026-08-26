import { Module } from '@nestjs/common';
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
import { MailModule } from './mail/mail.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AlertsModule } from './alerts/alerts.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SuscriptionsModule } from './suscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { UserCleanupCronService } from './auth/user-cleanup.cron';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Límite global por defecto (1 minuto)
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot(),
    AlertsModule,
    PrismaModule,
    CloudinaryModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    BusinessAccessModule,
    MovementsModule,
    SuppliersModule,
    ScheduleModule.forRoot(),
    ReportsModule,
    MailModule,
    BusinessInvitesModule,
    BusinessEmployeesModule,
    BusinessModule,
    SuscriptionsModule,
    AdminModule,
  ],
  providers: [
    UserCleanupCronService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
