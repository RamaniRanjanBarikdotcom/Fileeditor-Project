import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { PaymentsService } from './payments.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../common/prisma.module';
import { LicensesModule } from '../licenses/licenses.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, LicensesModule, ConfigModule],
  controllers: [WebhooksController],
  providers: [StripeService, RazorpayService, PaymentsService],
  exports: [StripeService, RazorpayService, PaymentsService],
})
export class PaymentsModule {}
