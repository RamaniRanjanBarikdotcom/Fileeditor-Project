import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FeatureFlags {
  publicTools: boolean;
  storeCheckout: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  subscriptionsEnabled: boolean;
  adminPortalEnabled: boolean;
  anonymousUsageEnabled: boolean;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly config: ConfigService) {}

  getFlags(): FeatureFlags {
    return {
      publicTools: this.parseFlag('FEATURE_PUBLIC_TOOLS', true),
      storeCheckout: this.parseFlag('FEATURE_STORE_CHECKOUT', true),
      stripeEnabled: this.parseFlag(
        'FEATURE_STRIPE',
        Boolean(this.config.get<string>('STRIPE_SECRET_KEY')),
      ),
      razorpayEnabled: this.parseFlag(
        'FEATURE_RAZORPAY',
        Boolean(this.config.get<string>('RAZORPAY_KEY_ID')) &&
          Boolean(this.config.get<string>('RAZORPAY_KEY_SECRET')),
      ),
      subscriptionsEnabled: this.parseFlag('FEATURE_SUBSCRIPTIONS', true),
      adminPortalEnabled: this.parseFlag('FEATURE_ADMIN_PORTAL', true),
      anonymousUsageEnabled: this.parseFlag('FEATURE_ANONYMOUS_USAGE', true),
    };
  }

  isEnabled(flagName: keyof FeatureFlags): boolean {
    return this.getFlags()[flagName];
  }

  private parseFlag(envVar: string, defaultValue: boolean): boolean {
    const val = this.config.get<string>(envVar);
    if (val === undefined || val === null || val === '') {
      return defaultValue;
    }
    return val === 'true' || val === '1' || val === 'yes';
  }
}
