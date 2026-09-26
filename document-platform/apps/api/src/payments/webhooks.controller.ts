import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../common/prisma.service';
import { CurrencyCode, PaymentProvider, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { RequireFeatures } from '../feature-flags/require-features.decorator';
import { SaasSubscriptionsService } from './saas-subscriptions.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SaasSubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stripe Webhook Endpoint (Raw Body Signature Verified).
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @RequireFeatures('stripeEnabled')
  async handleStripeWebhook(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    const rawBody = (req as any).rawBody || req.body;
    if (!rawBody) {
      throw new BadRequestException('Missing webhook payload');
    }

    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature || '');
    } catch (err: any) {
      this.logger.error(`Stripe webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Check idempotency in WebhookEvent table
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: {
        eventId: event.id,
      },
    });

    if (existingEvent?.processedAt) {
      this.logger.log(`Stripe event ${event.id} already processed.`);
      return { received: true };
    }

    // Save event record
    const webhookRecord = await this.prisma.webhookEvent.upsert({
      where: {
        eventId: event.id,
      },
      update: { payloadJson: event as any },
      create: {
        provider: PaymentProvider.STRIPE,
        eventId: event.id,
        eventType: event.type,
        payloadJson: event as any,
      },
    });

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const providerSubId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription: any = await this.stripeService.retrieveSubscription(providerSubId);
        await this.syncStripeSubscription(subscription, event.type, session.metadata);
      } else {
        const orderId = session.client_reference_id || session.metadata?.orderId;
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || session.id;

        if (orderId) {
          await this.paymentsService.fulfillOrder({
            orderId,
            provider: PaymentProvider.STRIPE,
            providerPaymentId: paymentIntentId,
            providerOrderId: session.id,
          });
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      await this.syncStripeSubscription(event.data.object, event.type);
    }

    // Mark event processed
    await this.prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }

  /**
   * Razorpay Webhook Endpoint (HMAC Signature Verified).
   */
  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @RequireFeatures('razorpayEnabled')
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const body = typeof req.body === 'object' ? req.body : JSON.parse(rawBody.toString('utf8'));

    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature || '');
    if (!isValid) {
      this.logger.error('Razorpay webhook signature verification failed.');
      throw new BadRequestException('Invalid signature');
    }

    const eventId =
      body.event_id || `rzp_${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
    const eventType = body.event;

    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });
    if (existingEvent?.processedAt) {
      this.logger.log(`Razorpay event ${eventId} already processed.`);
      return { received: true };
    }

    const webhookRecord = await this.prisma.webhookEvent.upsert({
      where: {
        eventId: eventId,
      },
      update: { payloadJson: body as any },
      create: {
        provider: PaymentProvider.RAZORPAY,
        eventId: eventId,
        eventType: eventType || 'payment.captured',
        payloadJson: body as any,
      },
    });

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = body.payload?.payment?.entity;
      const orderId = paymentEntity?.notes?.orderId;
      const paymentId = paymentEntity?.id;
      const rzpOrderId = paymentEntity?.order_id;

      if (orderId && paymentId) {
        await this.paymentsService.fulfillOrder({
          orderId,
          provider: PaymentProvider.RAZORPAY,
          providerPaymentId: paymentId,
          providerOrderId: rzpOrderId,
        });
      }
    }

    if (typeof eventType === 'string' && eventType.startsWith('subscription.')) {
      const subscription = body.payload?.subscription?.entity;
      const organizationId = subscription?.notes?.organizationId;
      const productId = subscription?.notes?.productId;
      if (subscription?.id && organizationId && productId) {
        await this.subscriptionsService.syncProviderSubscription({
          organizationId,
          productId,
          provider: PaymentProvider.RAZORPAY,
          providerSubId: subscription.id,
          currency: CurrencyCode.INR,
          status: razorpaySubscriptionStatus(subscription.status, eventType),
          currentPeriodStart: fromUnix(subscription.current_start) || new Date(),
          currentPeriodEnd:
            fromUnix(subscription.current_end) || new Date(Date.now() + 31 * 86_400_000),
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_cycle_end),
          eventType,
        });
      }
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }

  private async syncStripeSubscription(
    subscription: any,
    eventType: string,
    fallbackMetadata?: any,
  ) {
    const metadata = { ...fallbackMetadata, ...subscription?.metadata };
    if (!subscription?.id || !metadata.organizationId || !metadata.productId) return;
    await this.subscriptionsService.syncProviderSubscription({
      organizationId: metadata.organizationId,
      productId: metadata.productId,
      provider: PaymentProvider.STRIPE,
      providerSubId: subscription.id,
      currency:
        subscription.currency?.toUpperCase() === 'INR' ? CurrencyCode.INR : CurrencyCode.USD,
      status: stripeSubscriptionStatus(subscription.status),
      currentPeriodStart: fromUnix(subscription.current_period_start) || new Date(),
      currentPeriodEnd:
        fromUnix(subscription.current_period_end) || new Date(Date.now() + 31 * 86_400_000),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      eventType,
    });
  }
}

function fromUnix(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1_000) : null;
}

function stripeSubscriptionStatus(value: string): SubscriptionStatus {
  if (value === 'active' || value === 'trialing') return SubscriptionStatus.ACTIVE;
  if (value === 'past_due') return SubscriptionStatus.PAST_DUE;
  if (value === 'unpaid') return SubscriptionStatus.UNPAID;
  if (value === 'canceled') return SubscriptionStatus.CANCELED;
  return SubscriptionStatus.INCOMPLETE;
}

function razorpaySubscriptionStatus(value: string, eventType: string): SubscriptionStatus {
  if (
    value === 'active' ||
    value === 'authenticated' ||
    eventType === 'subscription.activated' ||
    eventType === 'subscription.charged'
  )
    return SubscriptionStatus.ACTIVE;
  if (value === 'halted' || value === 'paused') return SubscriptionStatus.PAST_DUE;
  if (
    value === 'cancelled' ||
    value === 'completed' ||
    eventType === 'subscription.cancelled' ||
    eventType === 'subscription.completed'
  )
    return SubscriptionStatus.CANCELED;
  return SubscriptionStatus.INCOMPLETE;
}
