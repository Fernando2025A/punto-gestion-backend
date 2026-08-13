import { Module } from '@nestjs/common';
import { BusinessInvitesService } from './business-invites.service';
import { BusinessInvitesController } from './business-invites.controller';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';

@Module({
  controllers: [BusinessInvitesController],
  providers: [BusinessInvitesService],
  imports: [BusinessAccessModule],
})
export class BusinessInvitesModule {}
