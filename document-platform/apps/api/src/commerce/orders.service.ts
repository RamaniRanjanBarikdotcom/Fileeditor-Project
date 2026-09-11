import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PaymentsService } from '../payments/payments.service';
import { CartService } from './cart.service';
import { CurrencyCode, OrderStatus, PaymentProvider } from '@prisma/client';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

export interface CheckoutDto {
  productId?: string;
  currency: CurrencyCode;
  successUrl: string;
  cancelUrl: string;
}

export interface VerifyRazorpayPaymentDto {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly cartService: CartService,
    private readonly config: ConfigService,
  ) {}

  private validateReturnUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Checkout return URL is invalid.');
    }
    const configured = [
      this.config.get<string>('CHECKOUT_RETURN_ORIGINS'),
      this.config.get<string>('PUBLIC_WEB_URL'),
      this.config.get<string>('CORS_ORIGIN'),
    ]
      .filter(Boolean)
      .join(',');
    const allowed = new Set(
      (configured || 'http://localhost:3000,http://localhost:5173,https://apptoolkitlab.com')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try { return new URL(value).origin; } catch { return ''; }
        })
        .filter(Boolean),
    );
    if (!allowed.has(parsed.origin)) {
      throw new BadRequestException('Checkout return URL origin is not allowed.');
    }
    return parsed.toString();
  }

  private generateOrderNumber(): string {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${d}-${rand}`;
  }

  /**
   * Create an Order and initialize checkout session (Stripe for USD or Razorpay for INR).
   */
  async createCheckoutSession(userId: string, dto: CheckoutDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const successUrl = this.validateReturnUrl(dto.successUrl);
    const cancelUrl = this.validateReturnUrl(dto.cancelUrl);

    let orderItems: {
      productId: string;
      priceId: string;
      name: string;
      description?: string;
      unitPriceMinorUnits: number;
      quantity: number;
    }[] = [];

    if (dto.productId) {
      // Direct Single-Product Checkout
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: {
          prices: { where: { currency: dto.currency, isActive: true } },
          releases: { where: { isCurrent: true }, take: 1 },
        },
      });

      if (!product || !product.isPublished) {
        throw new NotFoundException('Product not found or unavailable.');
      }

      if (product.releases.length === 0) {
        throw new BadRequestException('This product does not have a downloadable release yet.');
      }

      const price = product.prices[0];
      if (!price) {
        throw new BadRequestException(
          `Product does not have pricing configured for currency '${dto.currency}'.`,
        );
      }

      orderItems.push({
        productId: product.id,
        priceId: price.id,
        name: product.name,
        description: product.tagline || undefined,
        unitPriceMinorUnits: price.amountMinorUnits,
        quantity: 1,
      });
    } else {
      // Cart Checkout
      const cart = await this.cartService.getOrCreateCart(userId, dto.currency);
      if (cart.items.length === 0) {
        throw new BadRequestException('Shopping cart is empty.');
      }

      for (const it of cart.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: it.productId },
          include: {
            prices: { where: { currency: dto.currency, isActive: true } },
            releases: { where: { isCurrent: true }, take: 1 },
          },
        });
        const price = product?.prices[0];
        if (price && product?.isPublished && product.releases.length > 0) {
          orderItems.push({
            productId: it.productId,
            priceId: price.id,
            name: it.productName,
            unitPriceMinorUnits: price.amountMinorUnits,
            quantity: 1,
          });
        }
      }

      if (orderItems.length === 0) {
        throw new BadRequestException(
          'The cart has no products with an available downloadable release.',
        );
      }
    }

    const totalAmountMinor = orderItems.reduce(
      (sum, item) => sum + item.unitPriceMinorUnits * item.quantity,
      0,
    );

    const paymentProvider =
      dto.currency === CurrencyCode.USD ? PaymentProvider.STRIPE : PaymentProvider.RAZORPAY;

    // Create Order Record
    const order = await this.prisma.order.create({
      data: {
        orderNumber: this.generateOrderNumber(),
        userId,
        status: OrderStatus.PENDING,
        currency: dto.currency,
        totalAmountMinor,
        paymentProvider,
        items: {
          create: orderItems.map((it) => ({
            productId: it.productId,
            priceId: it.priceId,
            amountMinorUnits: it.unitPriceMinorUnits * it.quantity,
          })),
        },
      },
    });

    // Route payment provider
    if (dto.currency === CurrencyCode.USD) {
      // Stripe Checkout
      const stripeSession = await this.stripeService.createCheckoutSession({
        orderId: order.id,
        userId: user.id,
        userEmail: user.email,
        lineItems: orderItems.map((it) => ({
          name: it.name,
          description: it.description,
          amountMinorUnits: it.unitPriceMinorUnits,
          quantity: it.quantity,
        })),
        successUrl,
        cancelUrl,
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { providerOrderId: stripeSession.sessionId },
      });

      return {
        provider: PaymentProvider.STRIPE,
        orderId: order.id,
        checkoutUrl: stripeSession.checkoutUrl,
        sessionId: stripeSession.sessionId,
      };
    } else {
      // Razorpay Checkout (INR)
      const rzpOrder = await this.razorpayService.createOrder({
        orderId: order.id,
        amountMinorUnits: totalAmountMinor,
        userId: user.id,
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { providerOrderId: rzpOrder.razorpayOrderId },
      });

      return {
        provider: PaymentProvider.RAZORPAY,
        orderId: order.id,
        razorpayOrderId: rzpOrder.razorpayOrderId,
        keyId: rzpOrder.keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        productName: orderItems[0]?.name || 'AppToolkitLab Digital Purchase',
      };
    }
  }

  /**
   * Verify Razorpay Client Signature and Fulfill Order.
   */
  async verifyClientRazorpayPayment(userId: string, dto: VerifyRazorpayPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId,
        paymentProvider: PaymentProvider.RAZORPAY,
        providerOrderId: dto.razorpayOrderId,
      },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Payment order not found.');
    const isValid = this.razorpayService.verifyPaymentSignature({
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature verification failed.');
    }

    return this.paymentsService.fulfillOrder({
      orderId: dto.orderId,
      provider: PaymentProvider.RAZORPAY,
      providerPaymentId: dto.razorpayPaymentId,
      providerOrderId: dto.razorpayOrderId,
    });
  }

  /**
   * Get user's order history.
   */
  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single order by ID.
   */
  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
