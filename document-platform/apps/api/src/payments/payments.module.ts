import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { PaymentsService } from './payments.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../common/prisma.module';
import { LicensesModule } from '../licenses/licenses.module';
import { ConfigModule } from '@nestjs/config';
import { SaasSubscriptionsController } from './saas-subscriptions.controller';
import { SaasSubscriptionsService } from './saas-subscriptions.service';

@Module({
  imports: [PrismaModule, LicensesModule, ConfigModule],
  controllers: [WebhooksController, SaasSubscriptionsController],
  providers: [StripeService, RazorpayService, PaymentsService, SaasSubscriptionsService],
  exports: [StripeService, RazorpayService, PaymentsService, SaasSubscriptionsService],
})
export class PaymentsModule {}
