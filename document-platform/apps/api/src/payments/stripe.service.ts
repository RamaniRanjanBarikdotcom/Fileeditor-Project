import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-02-24.acacia' as any,
      });
      this.logger.log('Stripe client initialized successfully.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set. Stripe checkout is disabled.');
    }
  }

  get isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Creates a Stripe Checkout Session for an Order.
   */
  async createCheckoutSession(params: {
    orderId: string;
    userId: string;
    userEmail: string;
    lineItems: {
      name: string;
      description?: string;
      amountMinorUnits: number;
      quantity: number;
    }[];
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; checkoutUrl: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe checkout is not configured.');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: params.userEmail,
      client_reference_id: params.orderId,
      metadata: {
        orderId: params.orderId,
        userId: params.userId,
      },
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: item.amountMinorUnits,
        },
        quantity: item.quantity,
      })),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url || params.successUrl,
    };
  }

  /**
   * Constructs and verifies Stripe webhook events from raw payload buffer.
   */
  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new BadRequestException('Stripe webhook verification is not configured.');
    }

    if (!this.webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured.');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
