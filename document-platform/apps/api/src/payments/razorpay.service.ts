import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly razorpay: Razorpay | null = null;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(RazorpayService.name);

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID', '');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET', '');
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');

    if (this.keyId && this.keySecret) {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
      this.logger.log('Razorpay client initialized successfully.');
    } else {
      this.logger.warn('RAZORPAY_KEY_ID / SECRET not set. Razorpay checkout is disabled.');
    }
  }

  get isConfigured(): boolean {
    return this.razorpay !== null;
  }

  get publicClientKey(): string {
    return this.keyId;
  }

  /**
   * Creates a Razorpay Order in INR paise.
   */
  async createOrder(params: {
    orderId: string;
    amountMinorUnits: number;
    userId: string;
  }): Promise<{
    razorpayOrderId: string;
    keyId: string;
    amount: number;
    currency: string;
  }> {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay checkout is not configured.');
    }

    const order = await this.razorpay.orders.create({
      amount: params.amountMinorUnits, // in paise
      currency: 'INR',
      receipt: params.orderId,
      notes: {
        orderId: params.orderId,
        userId: params.userId,
      },
    });

    return {
      razorpayOrderId: order.id,
      keyId: this.keyId,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  /**
   * Verifies client-side Razorpay payment signature.
   */
  verifyPaymentSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    if (!this.keySecret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(params.razorpaySignature),
    );
  }

  /**
   * Verifies Razorpay webhook event signature from raw body.
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;

    const bodyString = typeof payload === 'string' ? payload : payload.toString('utf8');
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyString)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
