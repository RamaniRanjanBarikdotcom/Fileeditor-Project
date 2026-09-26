import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  PlatformRole,
  ReservationStatus,
  SubscriptionPlanTier,
  SubscriptionStatus,
} from '@prisma/client';
import {
  estimateBlogCredits,
  type BlogGenerationInput,
  type BlogUsage,
  usageToCredits,
} from '@docconv/blog-engine';
import { PrismaService } from '../common/prisma.service';

export const BLOG_STUDIO_PRODUCT_SLUG = 'blog-studio-addon';

const PLAN_LIMITS: Record<SubscriptionPlanTier, { blogs: number; credits: number }> = {
  FREE: { blogs: 1, credits: 25 },
  PRO: { blogs: 5, credits: 100 },
  BUSINESS: { blogs: 15, credits: 300 },
};
const ADMIN_USAGE_LIMIT = 2_000_000_000;

@Injectable()
export class BlogUsageService {
  constructor(private readonly prisma: PrismaService) {}

  estimate(input: BlogGenerationInput) {
    return estimateBlogCredits(input);
  }

  async reserve(
    userId: string,
    organizationId: string,
    input: BlogGenerationInput,
    internalMetadata?: Record<string, unknown>,
  ) {
    const estimatedCredits = this.estimate(input);
    const reserveOnce = () =>
      this.prisma.$transaction(
        async (tx) => {
          const organization = await tx.organization.findUnique({
            where: { id: organizationId },
            include: {
              plan: true,
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: new Date() } },
                include: { plan: true },
                orderBy: { currentPeriodEnd: 'desc' },
                take: 1,
              },
            },
          });
          if (!organization)
            throw new ConflictException('The active organization no longer exists.');
          const account = await tx.user.findFirst({
            where: { id: userId, memberships: { some: { organizationId } } },
            select: { platformRole: true },
          });
          if (!account) throw new ConflictException('The active account no longer has access.');
          const isAdmin = account.platformRole === PlatformRole.ADMIN;
          const product = await tx.product.findUnique({
            where: { slug: BLOG_STUDIO_PRODUCT_SLUG },
          });
          if (!product) throw new ConflictException('Blog Studio has not been initialized.');

          const activeAddon = await tx.saasSubscription.findFirst({
            where: {
              organizationId,
              productId: product.id,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: { gt: new Date() },
            },
          });
          const limits = getBlogStudioAllowance(
            organization.subscriptions[0]?.plan.tier ||
              organization.plan?.tier ||
              SubscriptionPlanTier.FREE,
            Boolean(activeAddon),
            isAdmin,
          );
          const { start, end } = currentUtcMonth();
          const window = await tx.saasUsageWindow.upsert({
            where: {
              organizationId_productId_windowStart: {
                organizationId,
                productId: product.id,
                windowStart: start,
              },
            },
            update: { blogLimit: limits.blogs, creditLimit: limits.credits },
            create: {
              organizationId,
              productId: product.id,
              windowStart: start,
              windowEnd: end,
              blogLimit: limits.blogs,
              creditLimit: limits.credits,
            },
          });
          await tx.saasUsageReservation.updateMany({
            where: {
              usageWindowId: window.id,
              status: ReservationStatus.RESERVED,
              expiresAt: { lte: new Date() },
            },
            data: { status: ReservationStatus.RELEASED },
          });
          const reserved = await tx.saasUsageReservation.aggregate({
            where: {
              usageWindowId: window.id,
              status: ReservationStatus.RESERVED,
              expiresAt: { gt: new Date() },
            },
            _sum: { estimatedCredits: true },
            _count: { _all: true },
          });
          const remainingBlogs = window.blogLimit - window.blogsConsumed - reserved._count._all;
          const remainingCredits =
            window.creditLimit - window.creditsConsumed - (reserved._sum.estimatedCredits || 0);
          if (!isAdmin && remainingBlogs < 1)
            throw paymentRequired('Your monthly Blog Studio blog allowance is exhausted.');
          if (!isAdmin && remainingCredits < estimatedCredits) {
            throw paymentRequired('Your remaining AI credits cannot safely cover this generation.');
          }

          const job = await tx.blogGenerationJob.create({
            data: {
              organizationId,
              userId,
              inputJson: {
                ...(input as unknown as Record<string, unknown>),
                ...internalMetadata,
              } as Prisma.InputJsonValue,
            },
          });
          await tx.saasUsageReservation.create({
            data: {
              organizationId,
              usageWindowId: window.id,
              generationJobId: job.id,
              estimatedCredits,
              expiresAt: new Date(Date.now() + 30 * 60_000),
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              action: 'BLOG_GENERATION_QUEUED',
              resourceType: 'BlogGenerationJob',
              resourceId: job.id,
              metadataJson: { estimatedCredits },
            },
          });
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'BlogGenerationJob',
              aggregateId: job.id,
              eventType: 'BLOG_GENERATION_REQUESTED',
              payloadJson: { jobId: job.id },
            },
          });
          return {
            job,
            estimatedCredits,
            usage: serializeWindow(
              window,
              reserved._count._all,
              reserved._sum.estimatedCredits || 0,
              isAdmin,
            ),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await reserveOnce();
      } catch (error: any) {
        if (error?.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    throw new ConflictException('Usage changed concurrently. Please retry the generation.');
  }

  async settle(
    jobId: string,
    usage: BlogUsage,
    model: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const settleWith = async (tx: Prisma.TransactionClient) => {
      const reservation = await tx.saasUsageReservation.findUnique({
        where: { generationJobId: jobId },
        include: { usageWindow: true },
      });
      if (!reservation || reservation.status !== ReservationStatus.RESERVED) return;
      const price = await tx.aiModelPrice.findFirst({
        where: {
          model,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        orderBy: { version: 'desc' },
      });
      const credits = usageToCredits(usage, {
        inputPerMillionUsd: Number(price?.inputPerMillionUsd || 0.5),
        outputPerMillionUsd: Number(price?.outputPerMillionUsd || 2),
        imageUsd: Number(price?.imageUsd || 0.04),
      });
      await tx.saasUsageRecord.create({
        data: {
          organizationId: reservation.organizationId,
          usageWindowId: reservation.usageWindowId,
          generationJobId: jobId,
          usageType: 'BLOG_GENERATION',
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          imageCount: usage.imageCount,
          credits,
          completedBlogs: 1,
          model,
        },
      });
      await tx.saasUsageWindow.update({
        where: { id: reservation.usageWindowId },
        data: { blogsConsumed: { increment: 1 }, creditsConsumed: { increment: credits } },
      });
      await tx.saasUsageReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.SETTLED, settledAt: new Date() },
      });
    };
    return transaction ? settleWith(transaction) : this.prisma.$transaction(settleWith);
  }

  async release(jobId: string) {
    await this.prisma.saasUsageReservation.updateMany({
      where: { generationJobId: jobId, status: ReservationStatus.RESERVED },
      data: { status: ReservationStatus.RELEASED },
    });
  }

  async getUsage(userId: string, organizationId: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug: BLOG_STUDIO_PRODUCT_SLUG },
    });
    if (!product) throw new ConflictException('Blog Studio has not been initialized.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        plan: true,
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: new Date() } },
          include: { plan: true },
          orderBy: { currentPeriodEnd: 'desc' },
          take: 1,
        },
      },
    });
    if (!organization) throw new ConflictException('The active organization no longer exists.');
    const account = await this.prisma.user.findFirst({
      where: { id: userId, memberships: { some: { organizationId } } },
      select: { platformRole: true },
    });
    if (!account) throw new ConflictException('The active account no longer has access.');
    const isAdmin = account.platformRole === PlatformRole.ADMIN;
    const activeAddon = await this.prisma.saasSubscription.findFirst({
      where: {
        organizationId,
        productId: product.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gt: new Date() },
      },
    });
    const limits = getBlogStudioAllowance(
      organization.subscriptions[0]?.plan.tier ||
        organization.plan?.tier ||
        SubscriptionPlanTier.FREE,
      Boolean(activeAddon),
      isAdmin,
    );
    const { start, end } = currentUtcMonth();
    const window = await this.prisma.saasUsageWindow.upsert({
      where: {
        organizationId_productId_windowStart: {
          organizationId,
          productId: product.id,
          windowStart: start,
        },
      },
      update: { blogLimit: limits.blogs, creditLimit: limits.credits },
      create: {
        organizationId,
        productId: product.id,
        windowStart: start,
        windowEnd: end,
        blogLimit: limits.blogs,
        creditLimit: limits.credits,
      },
    });
    await this.prisma.saasUsageReservation.updateMany({
      where: {
        usageWindowId: window.id,
        status: ReservationStatus.RESERVED,
        expiresAt: { lte: new Date() },
      },
      data: { status: ReservationStatus.RELEASED },
    });
    const reserved = await this.prisma.saasUsageReservation.aggregate({
      where: {
        usageWindowId: window.id,
        status: ReservationStatus.RESERVED,
        expiresAt: { gt: new Date() },
      },
      _sum: { estimatedCredits: true },
      _count: { _all: true },
    });
    return serializeWindow(
      window,
      reserved._count._all,
      reserved._sum.estimatedCredits || 0,
      isAdmin,
    );
  }

  async consumeImageCredits(
    userId: string,
    organizationId: string,
    credits: number,
    model: string,
  ) {
    const usage = await this.getUsage(userId, organizationId);
    if (!usage.unlimited && usage.creditsRemaining < credits) {
      throw paymentRequired('Your remaining AI credits cannot cover this image generation.');
    }
    const product = await this.prisma.product.findUnique({
      where: { slug: BLOG_STUDIO_PRODUCT_SLUG },
    });
    if (!product) throw new ConflictException('Blog Studio has not been initialized.');
    const { start } = currentUtcMonth();
    return this.prisma.$transaction(async (tx) => {
      const window = await tx.saasUsageWindow.findUnique({
        where: {
          organizationId_productId_windowStart: {
            organizationId,
            productId: product.id,
            windowStart: start,
          },
        },
      });
      if (!window) throw new ConflictException('The usage window could not be loaded.');
      if (!usage.unlimited) {
        const update = await tx.saasUsageWindow.updateMany({
          where: {
            id: window.id,
            creditsConsumed: { lte: window.creditLimit - credits },
          },
          data: { creditsConsumed: { increment: credits } },
        });
        if (update.count !== 1) {
          throw paymentRequired('Your remaining AI credits were used by another request.');
        }
      }
      const record = await tx.saasUsageRecord.create({
        data: {
          organizationId,
          usageWindowId: window.id,
          usageType: 'BLOG_IMAGE',
          imageCount: 1,
          credits,
          model,
        },
      });
      return { record, unlimited: usage.unlimited };
    });
  }
}

function currentUtcMonth() {
  const now = new Date();
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

function serializeWindow(
  window: {
    blogLimit: number;
    creditLimit: number;
    blogsConsumed: number;
    creditsConsumed: number;
    windowStart: Date;
    windowEnd: Date;
  },
  reservedBlogs: number,
  reservedCredits: number,
  unlimited = false,
) {
  return {
    ...window,
    accessLevel: unlimited ? 'ADMIN' : 'SUBSCRIPTION',
    unlimited,
    reservedBlogs,
    reservedCredits,
    blogsRemaining: Math.max(0, window.blogLimit - window.blogsConsumed - reservedBlogs),
    creditsRemaining: Math.max(0, window.creditLimit - window.creditsConsumed - reservedCredits),
  };
}

function paymentRequired(message: string) {
  return new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
}

export function getBlogStudioAllowance(
  tier: SubscriptionPlanTier,
  hasAddon: boolean,
  isAdmin = false,
) {
  if (isAdmin) return { blogs: ADMIN_USAGE_LIMIT, credits: ADMIN_USAGE_LIMIT };
  return hasAddon ? { blogs: 40, credits: 800 } : (PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE);
}
