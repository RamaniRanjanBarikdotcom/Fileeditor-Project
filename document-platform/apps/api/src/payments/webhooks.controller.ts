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
import { PaymentProvider } from '@prisma/client';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stripe Webhook Endpoint (Raw Body Signature Verified).
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
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

    const eventId = body.event_id || `rzp_${Date.now()}`;
    const eventType = body.event;

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

    await this.prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }
}
