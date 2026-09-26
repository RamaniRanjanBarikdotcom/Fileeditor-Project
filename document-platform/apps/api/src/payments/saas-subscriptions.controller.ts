import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { CurrencyCode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireFeatures } from '../feature-flags/require-features.decorator';
import { SaasSubscriptionsService } from './saas-subscriptions.service';

class BlogStudioCheckoutDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsString()
  @MaxLength(2_000)
  successUrl!: string;

  @IsString()
  @MaxLength(2_000)
  cancelUrl!: string;
}

@Controller('blog-studio/subscription')
@UseGuards(JwtAuthGuard)
export class SaasSubscriptionsController {
  constructor(private readonly subscriptions: SaasSubscriptionsService) {}

  @Post('checkout')
  @RequireFeatures('blogStudio', 'blogStudioCheckout')
  async checkout(@Request() req: any, @Body() dto: BlogStudioCheckoutDto) {
    return {
      success: true,
      data: await this.subscriptions.createBlogStudioCheckout(req.user.userId, req.user.orgId, dto),
    };
  }

  @Get()
  @RequireFeatures('blogStudio')
  async current(@Request() req: any) {
    return {
      success: true,
      data: await this.subscriptions.getBlogStudioSubscription(req.user.userId, req.user.orgId),
    };
  }
}
