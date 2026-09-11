import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LicensesService } from '../licenses/licenses.service';
import { OrderStatus, PaymentProvider, EntitlementType, Prisma } from '@prisma/client';

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
    const performFulfillment = () => this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        this.logger.error(`Order '${params.orderId}' not found during fulfillment.`);
        throw new NotFoundException(`Order '${params.orderId}' not found.`);
      }
      if (order.paymentProvider !== params.provider) {
        throw new BadRequestException('Payment provider does not match the order.');
      }
      if (
        order.providerOrderId &&
        params.providerOrderId &&
        order.providerOrderId !== params.providerOrderId
      ) {
        throw new BadRequestException('Provider order does not match the internal order.');
      }
      if (order.status === OrderStatus.PAID) {
        return { success: true, alreadyFulfilled: true, orderId: order.id };
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(`Order cannot be fulfilled from status ${order.status}.`);
      }

      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.PAID,
          providerPaymentId: params.providerPaymentId,
          providerOrderId: params.providerOrderId || order.providerOrderId,
        },
      });
      if (claimed.count !== 1) {
        return { success: true, alreadyFulfilled: true, orderId: order.id };
      }

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
          await this.licensesService.issueLicenseKey(
            {
              userId: order.userId,
              productId: item.productId,
              orderId: order.id,
              maxActivations: 3,
            },
            tx,
          );
        }
      }

      await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });
      return { success: true, orderId: order.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    let result: Awaited<ReturnType<typeof performFulfillment>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await performFulfillment();
        break;
      } catch (error: any) {
        if (error?.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    if (!result) throw new Error('Order fulfillment could not be completed.');

    this.logger.log(`Order '${params.orderId}' fulfillment completed.`);
    return result;
  }
}
