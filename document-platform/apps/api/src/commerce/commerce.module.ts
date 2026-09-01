import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { CartController } from './cart.controller';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../common/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [CartController, OrdersController],
  providers: [CartService, OrdersService],
  exports: [CartService, OrdersService],
})
export class CommerceModule {}
