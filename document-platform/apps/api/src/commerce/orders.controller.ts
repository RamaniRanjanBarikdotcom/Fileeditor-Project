import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OrdersService, CheckoutDto, VerifyRazorpayPaymentDto } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrencyCode } from '@prisma/client';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsEnum(CurrencyCode)
  @IsNotEmpty()
  currency!: CurrencyCode;

  @IsString()
  @IsNotEmpty()
  successUrl!: string;

  @IsString()
  @IsNotEmpty()
  cancelUrl!: string;
}

export class ClientVerifyRazorpayDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async createCheckout(@Req() req: any, @Body() dto: CreateCheckoutSessionDto) {
    const data = await this.ordersService.createCheckoutSession(req.user.userId, dto);
    return { success: true, data };
  }

  @Post('verify-razorpay')
  async verifyRazorpayPayment(@Req() req: any, @Body() dto: ClientVerifyRazorpayDto) {
    const data = await this.ordersService.verifyClientRazorpayPayment(req.user.userId, dto);
    return { success: true, data };
  }

  @Get()
  async getMyOrders(@Req() req: any) {
    const data = await this.ordersService.getUserOrders(req.user.userId);
    return { success: true, data };
  }

  @Get(':id')
  async getOrder(@Req() req: any, @Param('id') id: string) {
    const data = await this.ordersService.getOrderById(req.user.userId, id);
    return { success: true, data };
  }
}
