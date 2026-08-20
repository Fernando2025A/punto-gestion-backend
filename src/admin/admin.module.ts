import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ConfigModule } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { MailModule } from 'src/mail/mail.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  imports: [ConfigModule, MailModule],
})
export class AdminModule {}
