import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrencyCode } from '@prisma/client';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsEnum(CurrencyCode)
  @IsOptional()
  currency?: CurrencyCode;
}

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: any, @Query('currency') currency?: CurrencyCode) {
    const data = await this.cartService.getOrCreateCart(
      req.user.userId,
      currency || CurrencyCode.USD,
    );
    return { success: true, data };
  }

  @Post('items')
  async addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    const data = await this.cartService.addItem(
      req.user.userId,
      dto.productId,
      dto.currency || CurrencyCode.USD,
    );
    return { success: true, data };
  }

  @Delete('items/:id')
  async removeItem(@Req() req: any, @Param('id') id: string) {
    const data = await this.cartService.removeItem(req.user.userId, id);
    return { success: true, data };
  }

  @Delete()
  async clearCart(@Req() req: any) {
    const data = await this.cartService.clearCart(req.user.userId);
    return { success: true, data };
  }
}
