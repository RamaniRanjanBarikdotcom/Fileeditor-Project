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

class BillingPortalDto {
  @IsString()
  @MaxLength(2_000)
  returnUrl!: string;
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

  @Post('cancel')
  @RequireFeatures('blogStudio', 'blogStudioCheckout')
  async cancel(@Request() req: any) {
    return {
      success: true,
      data: await this.subscriptions.setCancelAtPeriodEnd(req.user.userId, req.user.orgId, true),
    };
  }

  @Post('resume')
  @RequireFeatures('blogStudio', 'blogStudioCheckout')
  async resume(@Request() req: any) {
    return {
      success: true,
      data: await this.subscriptions.setCancelAtPeriodEnd(req.user.userId, req.user.orgId, false),
    };
  }

  @Post('portal')
  @RequireFeatures('blogStudio', 'blogStudioCheckout')
  async portal(@Request() req: any, @Body() dto: BillingPortalDto) {
    return {
      success: true,
      data: await this.subscriptions.createBillingPortal(req.user.userId, req.user.orgId, dto.returnUrl),
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
