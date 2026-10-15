import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
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

  /**
   * Cancel at period end (or resume a pending cancellation). Access continues
   * until the paid period ends; the provider webhook confirms the change.
   */
  async setCancelAtPeriodEnd(
    userId: string,
    organizationId: string,
    cancel: boolean,
    productSlug = BLOG_STUDIO_ADDON_SLUG,
  ) {
    await this.assertBillingManager(userId, organizationId);
    const subscription = await this.activeSubscription(organizationId, productSlug);
    if (subscription.provider === PaymentProvider.STRIPE) {
      await this.stripe.setCancelAtPeriodEnd(subscription.providerSubId, cancel);
    } else if (cancel) {
      await this.razorpay.cancelSubscriptionAtCycleEnd(subscription.providerSubId);
    } else {
      // Razorpay cannot undo a scheduled cancellation; the customer re-subscribes.
      throw new ConflictException(
        'This Razorpay subscription cannot be resumed. Subscribe again after the current period ends.',
      );
    }
    const updated = await this.prisma.saasSubscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: cancel },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: cancel ? 'SAAS_SUBSCRIPTION_CANCEL_REQUESTED' : 'SAAS_SUBSCRIPTION_RESUMED',
        resourceType: 'SaasSubscription',
        resourceId: subscription.id,
      },
    });
    return updated;
  }

  async createBillingPortal(
    userId: string,
    organizationId: string,
    returnUrl: string,
    productSlug = BLOG_STUDIO_ADDON_SLUG,
  ) {
    await this.assertBillingManager(userId, organizationId);
    const subscription = await this.activeSubscription(organizationId, productSlug);
    if (subscription.provider !== PaymentProvider.STRIPE) {
      throw new ConflictException('Razorpay subscriptions are managed from the Razorpay payment link.');
    }
    return this.stripe.createBillingPortalSession(
      subscription.providerSubId,
      this.validateReturnUrl(returnUrl),
    );
  }

  private async activeSubscription(organizationId: string, productSlug: string) {
    const subscription = await this.prisma.saasSubscription.findFirst({
      where: {
        organizationId,
        product: { slug: productSlug },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      },
    });
    if (!subscription) throw new NotFoundException('This workspace has no active subscription for this product.');
    return subscription;
  }

  /**
   * Checkout for a plan of any SaaS product (generic plans). Stripe uses an
   * inline recurring price; Razorpay needs a plan object, created once per
   * price and remembered.
   */
  async createPlanCheckout(
    userId: string,
    organizationId: string,
    input: {
      productSlug: string;
      planKey: string;
      interval: BillingInterval;
      currency: CurrencyCode;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    await this.assertBillingManager(userId, organizationId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User was not found.');
    const plan = await this.prisma.saasPlan.findFirst({
      where: { key: input.planKey, isPublic: true, product: { slug: input.productSlug, isPublished: true } },
      include: {
        product: true,
        prices: { where: { currency: input.currency, interval: input.interval, isActive: true } },
      },
    });
    if (!plan || plan.isFree) throw new NotFoundException('This plan is not available for purchase.');
    const price = plan.prices[0];
    if (!price) {
      throw new ConflictException(`This plan is not sold in ${input.currency} per ${input.interval.toLowerCase()}.`);
    }
    const existing = await this.prisma.saasSubscription.findUnique({
      where: { organizationId_productId: { organizationId, productId: plan.productId } },
    });
    if (existing?.status === SubscriptionStatus.ACTIVE && existing.currentPeriodEnd > new Date()) {
      throw new ConflictException(
        existing.planId === plan.id
          ? 'This workspace is already on this plan.'
          : 'This workspace already has an active plan. Change plans from the billing portal, or cancel first.',
      );
    }

    const successUrl = this.validateReturnUrl(input.successUrl);
    const cancelUrl = this.validateReturnUrl(input.cancelUrl);
    const provider = subscriptionProviderForCurrency(input.currency);
    const placeholderEnd = new Date(Date.now() + 10 * 60_000);
    const name = `${plan.product.name} ${plan.name}`;
    if (provider === PaymentProvider.STRIPE) {
      const checkout = await this.stripe.createPlanSubscriptionCheckout({
        organizationId,
        productId: plan.productId,
        productSlug: plan.product.slug,
        planId: plan.id,
        userEmail: user.email,
        name,
        currency: input.currency,
        amountMinorUnits: price.amountMinorUnits,
        interval: input.interval,
        successUrl,
        cancelUrl,
      });
      await this.storeIncomplete(organizationId, plan.productId, provider, checkout.sessionId, input.currency, placeholderEnd, userId, plan.id);
      return { provider, checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId };
    }

    let providerPlanId = price.providerPriceId;
    if (!providerPlanId) {
      providerPlanId = await this.razorpay.createPlan({
        name,
        amountMinorUnits: price.amountMinorUnits,
        interval: input.interval,
      });
      await this.prisma.saasPlanPrice.update({ where: { id: price.id }, data: { providerPriceId: providerPlanId } });
    }
    const checkout = await this.razorpay.createSubscription({
      organizationId,
      productId: plan.productId,
      productSlug: plan.product.slug,
      planId: plan.id,
      providerPlanId,
    });
    await this.storeIncomplete(organizationId, plan.productId, provider, checkout.subscriptionId, input.currency, placeholderEnd, userId, plan.id);
    return { provider, ...checkout };
  }

  /** Current subscription (with plan) of any SaaS product, for billing pages. */
  async getSubscription(userId: string, organizationId: string, productSlug: string) {
    await this.assertMembership(userId, organizationId);
    return this.prisma.saasSubscription.findFirst({
      where: { organizationId, product: { slug: productSlug } },
      include: {
        product: { select: { name: true, slug: true } },
        plan: { select: { key: true, name: true } },
      },
    });
  }

  private async assertBillingManager(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('The requested workspace was not found.');
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only workspace owners and admins can manage billing.');
    }
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
    /** Generic plan id from provider metadata; absent for legacy add-ons. */
    planId?: string;
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        // Providers do not guarantee webhook ordering. Ignore events that
        // would move a record backwards:
        //  - a canceled provider subscription is terminal and is never
        //    reactivated by a late "updated"/"activated" event;
        //  - an event for a superseded provider subscription must not
        //    overwrite the organization's current one unless it activates.
        const existing = await tx.saasSubscription.findUnique({
          where: {
            organizationId_productId: {
              organizationId: input.organizationId,
              productId: input.productId,
            },
          },
        });
        const sameProviderSubscription = existing?.providerSubId === input.providerSubId;
        const staleEvent =
          !!existing &&
          ((sameProviderSubscription &&
            existing.status === SubscriptionStatus.CANCELED &&
            input.status !== SubscriptionStatus.CANCELED) ||
            (!sameProviderSubscription &&
              !!existing.providerSubId &&
              existing.status === SubscriptionStatus.ACTIVE &&
              input.status !== SubscriptionStatus.ACTIVE));
        if (staleEvent) {
          await tx.auditLog.create({
            data: {
              organizationId: input.organizationId,
              action: 'SAAS_SUBSCRIPTION_STALE_EVENT_IGNORED',
              resourceType: 'SaasSubscription',
              resourceId: existing!.id,
              metadataJson: {
                provider: input.provider,
                eventType: input.eventType,
                incomingStatus: input.status,
                currentStatus: existing!.status,
              },
            },
          });
          return existing!;
        }

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
            ...(input.planId ? { planId: input.planId } : {}),
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
            planId: input.planId,
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
    planId?: string,
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
          ...(planId ? { planId } : {}),
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
          planId,
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
