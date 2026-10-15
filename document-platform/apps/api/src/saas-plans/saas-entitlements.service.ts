import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

/** Plan limit value meaning "no limit". A metric missing from a plan means 0. */
export const UNLIMITED = -1;

type Db = Prisma.TransactionClient | PrismaService;

export type PlanLimits = Record<string, number>;

export interface ActivePlan {
  productId: string;
  productSlug: string;
  planId: string;
  planKey: string;
  planName: string;
  isFree: boolean;
  limits: PlanLimits;
  features: string[];
  subscriptionId: string | null;
}

export function paymentRequired(message: string) {
  return new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
}

export function currentUtcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function planLimit(plan: Pick<ActivePlan, 'limits'>, metric: string): number {
  const value = plan.limits[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Plan entitlements for any SaaS product: which plan an organization is on,
 * static limits (items, warehouses, seats…), metered monthly usage
 * (invoices per month…) and feature switches. Plans and limits are data
 * (`saas_plans`), so pricing changes never need code changes.
 */
@Injectable()
export class SaasEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async activePlan(organizationId: string, productSlug: string, db: Db = this.prisma): Promise<ActivePlan> {
    const product = await db.product.findUnique({ where: { slug: productSlug } });
    if (!product) throw new ConflictException(`${productSlug} has not been initialized.`);
    const subscription = await db.saasSubscription.findFirst({
      where: {
        organizationId,
        productId: product.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gt: new Date() },
        planId: { not: null },
      },
      include: { plan: true },
    });
    const plan =
      subscription?.plan ??
      (await db.saasPlan.findFirst({
        where: { productId: product.id, isFree: true },
        orderBy: { sortOrder: 'asc' },
      }));
    if (!plan) throw new ConflictException(`${product.name} has no free plan configured.`);
    return {
      productId: product.id,
      productSlug,
      planId: plan.id,
      planKey: plan.key,
      planName: plan.name,
      isFree: plan.isFree,
      limits: (plan.limitsJson ?? {}) as PlanLimits,
      features: Array.isArray(plan.featuresJson) ? (plan.featuresJson as string[]) : [],
      subscriptionId: subscription?.id ?? null,
    };
  }

  async hasFeature(organizationId: string, productSlug: string, feature: string, db: Db = this.prisma) {
    return (await this.activePlan(organizationId, productSlug, db)).features.includes(feature);
  }

  async assertFeature(organizationId: string, productSlug: string, feature: string, label: string, db: Db = this.prisma) {
    const plan = await this.activePlan(organizationId, productSlug, db);
    if (!plan.features.includes(feature)) {
      throw paymentRequired(`${label} is not included in the ${plan.planName} plan. Upgrade to use it.`);
    }
    return plan;
  }

  /**
   * Static limits (things that exist: items, warehouses, businesses). Pass the
   * current count; adding one more must stay within the plan.
   */
  async assertCountBelowLimit(
    organizationId: string,
    productSlug: string,
    metric: string,
    currentCount: number,
    label: string,
    db: Db = this.prisma,
  ) {
    const plan = await this.activePlan(organizationId, productSlug, db);
    const limit = planLimit(plan, metric);
    if (limit !== UNLIMITED && currentCount >= limit) {
      throw paymentRequired(
        limit === 0
          ? `${label} are not included in the ${plan.planName} plan. Upgrade to use them.`
          : `The ${plan.planName} plan allows ${limit} ${label.toLowerCase()}. Upgrade to add more.`,
      );
    }
    return plan;
  }

  /**
   * Metered monthly usage (e.g. invoices issued). Atomic: concurrent calls
   * can never push usage past the limit. Call inside the transaction that
   * performs the work so a failed action does not consume quota.
   */
  async consume(
    db: Prisma.TransactionClient,
    organizationId: string,
    productSlug: string,
    metric: string,
    label: string,
    amount = 1,
  ) {
    const plan = await this.activePlan(organizationId, productSlug, db);
    const limit = planLimit(plan, metric);
    const windowStart = currentUtcMonthStart();
    // Atomic "create if missing" (concurrent first use in a month must not race).
    await db.$executeRaw`
      INSERT INTO saas_usage_counters (id, organization_id, product_id, metric, window_start, used, updated_at)
      VALUES (${randomUUID()}, ${organizationId}, ${plan.productId}, ${metric}, ${windowStart}, 0, NOW())
      ON CONFLICT (organization_id, product_id, metric, window_start) DO NOTHING`;
    const updated = await db.saasUsageCounter.updateMany({
      where: {
        organizationId,
        productId: plan.productId,
        metric,
        windowStart,
        ...(limit === UNLIMITED ? {} : { used: { lte: limit - amount } }),
      },
      data: { used: { increment: amount } },
    });
    if (updated.count !== 1) {
      throw paymentRequired(
        `You have used all ${limit} ${label.toLowerCase()} in the ${plan.planName} plan this month. Upgrade for more.`,
      );
    }
    return plan;
  }

  /** Plan, limits and this month's metered usage, for dashboards and billing pages. */
  async summary(organizationId: string, productSlug: string) {
    const plan = await this.activePlan(organizationId, productSlug);
    const counters = await this.prisma.saasUsageCounter.findMany({
      where: { organizationId, productId: plan.productId, windowStart: currentUtcMonthStart() },
      select: { metric: true, used: true },
    });
    return {
      plan: { id: plan.planId, key: plan.planKey, name: plan.planName, isFree: plan.isFree },
      limits: plan.limits,
      features: plan.features,
      usageThisMonth: Object.fromEntries(counters.map((counter) => [counter.metric, counter.used])),
    };
  }
}
