import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { BillingInterval, CurrencyCode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { SaasSubscriptionsService } from '../payments/saas-subscriptions.service';
import { SaasEntitlementsService } from './saas-entitlements.service';
import { GENERIC_SAAS_PRODUCTS } from './saas-products';

export class PlanCheckoutDto {
  @IsString()
  @Matches(/^[a-z0-9-]{1,40}$/)
  planKey!: string;

  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsString()
  @MaxLength(2_000)
  successUrl!: string;

  @IsString()
  @MaxLength(2_000)
  cancelUrl!: string;
}

export class PlanPortalDto {
  @IsString()
  @MaxLength(2_000)
  returnUrl!: string;
}

/** Plans, subscription and entitlements for any generic SaaS product. */
@Controller('saas/:productSlug')
export class SaasPlansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly subscriptions: SaasSubscriptionsService,
    private readonly entitlements: SaasEntitlementsService,
  ) {}

  private product(slug: string, checkout = false) {
    const product = GENERIC_SAAS_PRODUCTS[slug];
    if (!product || !this.flags.isEnabled(product.featureFlag)) {
      throw new NotFoundException('This product is not available.');
    }
    if (checkout && !this.flags.isEnabled(product.checkoutFlag)) {
      throw new NotFoundException('Checkout for this product is not available yet.');
    }
    return slug;
  }

  /** Public: plans with prices, for pricing pages. */
  @Get('plans')
  async plans(@Param('productSlug') productSlug: string) {
    const slug = this.product(productSlug);
    const plans = await this.prisma.saasPlan.findMany({
      where: { isPublic: true, product: { slug, isPublished: true } },
      orderBy: { sortOrder: 'asc' },
      include: { prices: { where: { isActive: true } } },
    });
    return {
      success: true,
      data: plans.map((plan) => ({
        key: plan.key,
        name: plan.name,
        description: plan.description,
        isFree: plan.isFree,
        limits: plan.limitsJson,
        features: plan.featuresJson,
        prices: plan.prices.map((price) => ({
          currency: price.currency,
          interval: price.interval,
          amountMinorUnits: price.amountMinorUnits,
        })),
      })),
    };
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async subscription(@Request() req: any, @Param('productSlug') productSlug: string) {
    const slug = this.product(productSlug);
    const [subscription, entitlements] = await Promise.all([
      this.subscriptions.getSubscription(req.user.userId, req.user.orgId, slug),
      this.entitlements.summary(req.user.orgId, slug),
    ]);
    return { success: true, data: { subscription, entitlements } };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Request() req: any, @Param('productSlug') productSlug: string, @Body() dto: PlanCheckoutDto) {
    const slug = this.product(productSlug, true);
    return {
      success: true,
      data: await this.subscriptions.createPlanCheckout(req.user.userId, req.user.orgId, {
        productSlug: slug,
        ...dto,
      }),
    };
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Request() req: any, @Param('productSlug') productSlug: string) {
    const slug = this.product(productSlug, true);
    return {
      success: true,
      data: await this.subscriptions.setCancelAtPeriodEnd(req.user.userId, req.user.orgId, true, slug),
    };
  }

  @Post('resume')
  @UseGuards(JwtAuthGuard)
  async resume(@Request() req: any, @Param('productSlug') productSlug: string) {
    const slug = this.product(productSlug, true);
    return {
      success: true,
      data: await this.subscriptions.setCancelAtPeriodEnd(req.user.userId, req.user.orgId, false, slug),
    };
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async portal(@Request() req: any, @Param('productSlug') productSlug: string, @Body() dto: PlanPortalDto) {
    const slug = this.product(productSlug, true);
    return {
      success: true,
      data: await this.subscriptions.createBillingPortal(req.user.userId, req.user.orgId, dto.returnUrl, slug),
    };
  }
}
