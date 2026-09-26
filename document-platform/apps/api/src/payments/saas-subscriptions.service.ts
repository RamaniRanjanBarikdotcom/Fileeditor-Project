import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingType,
  CurrencyCode,
  PaymentProvider,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';

export const BLOG_STUDIO_ADDON_SLUG = 'blog-studio-addon';

@Injectable()
export class SaasSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
  ) {}

  async createBlogStudioCheckout(
    userId: string,
    organizationId: string,
    input: { currency: CurrencyCode; successUrl: string; cancelUrl: string },
  ) {
    await this.assertMembership(userId, organizationId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User was not found.');
    const product = await this.prisma.product.findUnique({
      where: { slug: BLOG_STUDIO_ADDON_SLUG },
      include: {
        prices: {
          where: { currency: input.currency, billingType: BillingType.RECURRING, isActive: true },
          take: 1,
        },
      },
    });
    if (!product || !product.isPublished)
      throw new NotFoundException('Blog Studio add-on is unavailable.');
    const price = product.prices[0];
    if (!price?.providerPriceId) {
      throw new ConflictException(
        `The ${input.currency} recurring provider price has not been configured.`,
      );
    }
    const existing = await this.prisma.saasSubscription.findUnique({
      where: { organizationId_productId: { organizationId, productId: product.id } },
    });
    if (existing?.status === SubscriptionStatus.ACTIVE && existing.currentPeriodEnd > new Date()) {
      throw new ConflictException('This workspace already has an active Blog Studio add-on.');
    }

    const successUrl = this.validateReturnUrl(input.successUrl);
    const cancelUrl = this.validateReturnUrl(input.cancelUrl);
    const provider = subscriptionProviderForCurrency(input.currency);
    const placeholderEnd = new Date(Date.now() + 10 * 60_000);
    if (provider === PaymentProvider.STRIPE) {
      const checkout = await this.stripe.createSubscriptionCheckout({
        organizationId,
        productId: product.id,
        userEmail: user.email,
        providerPriceId: price.providerPriceId,
        successUrl,
        cancelUrl,
      });
      await this.storeIncomplete(
        organizationId,
        product.id,
        provider,
        checkout.sessionId,
        input.currency,
        placeholderEnd,
        userId,
      );
      return { provider, checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId };
    }

    const checkout = await this.razorpay.createSubscription({
      organizationId,
      productId: product.id,
      providerPlanId: price.providerPriceId,
    });
    await this.storeIncomplete(
      organizationId,
      product.id,
      provider,
      checkout.subscriptionId,
      input.currency,
      placeholderEnd,
      userId,
    );
    return { provider, ...checkout };
  }

  async getBlogStudioSubscription(userId: string, organizationId: string) {
    await this.assertMembership(userId, organizationId);
    return this.prisma.saasSubscription.findFirst({
      where: { organizationId, product: { slug: BLOG_STUDIO_ADDON_SLUG } },
      include: { product: { select: { name: true, slug: true } } },
    });
  }

  async syncProviderSubscription(input: {
    organizationId: string;
    productId: string;
    provider: PaymentProvider;
    providerSubId: string;
    currency: CurrencyCode;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd?: boolean;
    eventType: string;
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        const subscription = await tx.saasSubscription.upsert({
          where: {
            organizationId_productId: {
              organizationId: input.organizationId,
              productId: input.productId,
            },
          },
          update: {
            provider: input.provider,
            providerSubId: input.providerSubId,
            currency: input.currency,
            status: input.status,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
          },
          create: {
            organizationId: input.organizationId,
            productId: input.productId,
            provider: input.provider,
            providerSubId: input.providerSubId,
            currency: input.currency,
            status: input.status,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            action: 'SAAS_SUBSCRIPTION_SYNCED',
            resourceType: 'SaasSubscription',
            resourceId: subscription.id,
            metadataJson: {
              provider: input.provider,
              eventType: input.eventType,
              status: input.status,
            },
          },
        });
        return subscription;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async storeIncomplete(
    organizationId: string,
    productId: string,
    provider: PaymentProvider,
    providerSubId: string,
    currency: CurrencyCode,
    currentPeriodEnd: Date,
    userId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.saasSubscription.upsert({
        where: { organizationId_productId: { organizationId, productId } },
        update: {
          provider,
          providerSubId,
          currency,
          status: SubscriptionStatus.INCOMPLETE,
          currentPeriodStart: new Date(),
          currentPeriodEnd,
        },
        create: {
          organizationId,
          productId,
          provider,
          providerSubId,
          currency,
          status: SubscriptionStatus.INCOMPLETE,
          currentPeriodStart: new Date(),
          currentPeriodEnd,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'SAAS_CHECKOUT_CREATED',
          resourceType: 'SaasSubscription',
          resourceId: subscription.id,
          metadataJson: { provider, currency },
        },
      });
    });
  }

  private async assertMembership(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('The requested workspace was not found.');
  }

  private validateReturnUrl(raw: string) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Checkout return URL is invalid.');
    }
    const allowed = new Set(
      [
        this.config.get<string>('PUBLIC_WEB_URL'),
        this.config.get<string>('CORS_ORIGIN'),
        'http://localhost:5173',
        'http://localhost:3000',
        'https://apptoolkitlab.com',
      ]
        .flatMap((value) => (value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch {
            return '';
          }
        }),
    );
    if (!allowed.has(parsed.origin))
      throw new BadRequestException('Checkout return URL origin is not allowed.');
    return parsed.toString();
  }
}

export function subscriptionProviderForCurrency(currency: CurrencyCode): PaymentProvider {
  return currency === CurrencyCode.INR ? PaymentProvider.RAZORPAY : PaymentProvider.STRIPE;
}
