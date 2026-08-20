import { Global, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { MailModule } from 'src/mail/mail.module';

@Global()
@Module({
  imports: [MailModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SuscriptionsModule {}
