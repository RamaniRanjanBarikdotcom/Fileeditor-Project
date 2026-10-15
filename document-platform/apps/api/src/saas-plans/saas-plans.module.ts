import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SaasEntitlementsService } from './saas-entitlements.service';
import { SaasPlansController } from './saas-plans.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [SaasPlansController],
  providers: [SaasEntitlementsService],
  exports: [SaasEntitlementsService],
})
export class SaasPlansModule {}
