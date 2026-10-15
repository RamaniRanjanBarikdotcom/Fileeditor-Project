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

    // Never fall back to the success URL: that would show "paid" without a payment.
    if (!session.url) throw new BadRequestException('Stripe did not return a checkout page.');
    return { sessionId: session.id, checkoutUrl: session.url };
  }

  async createSubscriptionCheckout(params: {
    organizationId: string;
    productId: string;
    userEmail: string;
    providerPriceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; checkoutUrl: string }> {
    if (!this.stripe) throw new BadRequestException('Stripe checkout is not configured.');
    const metadata = {
      organizationId: params.organizationId,
      productId: params.productId,
      productSlug: 'blog-studio-addon',
    };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.userEmail,
      metadata,
      subscription_data: { metadata },
      line_items: [{ price: params.providerPriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) throw new BadRequestException('Stripe did not return a checkout page.');
    return { sessionId: session.id, checkoutUrl: session.url };
  }

  /**
   * Subscription checkout for a generic SaaS plan. The recurring price is
   * inline (price_data), so no Stripe dashboard setup is needed per plan.
   */
  async createPlanSubscriptionCheckout(params: {
    organizationId: string;
    productId: string;
    productSlug: string;
    planId: string;
    userEmail: string;
    name: string;
    currency: 'USD' | 'INR';
    amountMinorUnits: number;
    interval: 'MONTH' | 'YEAR';
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; checkoutUrl: string }> {
    if (!this.stripe) throw new BadRequestException('Stripe checkout is not configured.');
    const metadata = {
      organizationId: params.organizationId,
      productId: params.productId,
      productSlug: params.productSlug,
      planId: params.planId,
    };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.userEmail,
      metadata,
      subscription_data: { metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amountMinorUnits,
            recurring: { interval: params.interval === 'YEAR' ? 'year' : 'month' },
            product_data: { name: params.name },
          },
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) throw new BadRequestException('Stripe did not return a checkout page.');
    return { sessionId: session.id, checkoutUrl: session.url };
  }

  async retrieveSubscription(id: string) {
    if (!this.stripe) throw new BadRequestException('Stripe checkout is not configured.');
    return this.stripe.subscriptions.retrieve(id);
  }

  /** Cancel (or undo cancelling) at the end of the paid period; never mid-period. */
  async setCancelAtPeriodEnd(id: string, cancel: boolean) {
    if (!this.stripe) throw new BadRequestException('Stripe checkout is not configured.');
    return this.stripe.subscriptions.update(id, { cancel_at_period_end: cancel });
  }

  /** Stripe-hosted page for invoices, payment methods and plan changes. */
  async createBillingPortalSession(subscriptionId: string, returnUrl: string) {
    if (!this.stripe) throw new BadRequestException('Stripe checkout is not configured.');
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const customer =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const session = await this.stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl,
    });
    return { url: session.url };
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
