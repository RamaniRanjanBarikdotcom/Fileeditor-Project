import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LicensesService } from '../licenses/licenses.service';
import { OrderStatus, PaymentProvider, EntitlementType } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly licensesService: LicensesService,
  ) {}

  /**
   * Authoritatively fulfill an order after payment verification.
   * Idempotent: Can be called multiple times without duplicate fulfillment.
   */
  async fulfillOrder(params: {
    orderId: string;
    provider: PaymentProvider;
    providerPaymentId: string;
    providerOrderId?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      this.logger.error(`Order '${params.orderId}' not found during fulfillment.`);
      throw new NotFoundException(`Order '${params.orderId}' not found.`);
    }

    if (order.status === OrderStatus.PAID) {
      this.logger.log(`Order '${order.id}' is already fulfilled. Skipping.`);
      return { success: true, alreadyFulfilled: true, orderId: order.id };
    }

    // Execute fulfillment transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark Order as PAID
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          providerPaymentId: params.providerPaymentId,
          providerOrderId: params.providerOrderId || order.providerOrderId,
        },
      });

      // 2. Grant Entitlements and generate License Keys
      for (const item of order.items) {
        // Create Lifetime Download Entitlement
        await tx.entitlement.upsert({
          where: {
            userId_productId_type: {
              userId: order.userId,
              productId: item.productId,
              type: EntitlementType.LIFETIME_DOWNLOAD,
            },
          },
          update: { isActive: true },
          create: {
            userId: order.userId,
            productId: item.productId,
            orderId: order.id,
            type: EntitlementType.LIFETIME_DOWNLOAD,
            isActive: true,
          },
        });

        // Issue License Key if product requires it
        const requiresLicense = (item.product.metadataJson as any)?.requiresLicense !== false;

        if (requiresLicense) {
          await this.licensesService.issueLicenseKey({
            userId: order.userId,
            productId: item.productId,
            orderId: order.id,
            maxActivations: 3,
          });
        }
      }
    });

    this.logger.log(`Order '${order.id}' successfully fulfilled with entitlements and licenses.`);
    return { success: true, orderId: order.id };
  }
}
