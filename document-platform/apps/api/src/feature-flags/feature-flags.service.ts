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
  teamsEnabled: boolean;
  apiKeysEnabled: boolean;
  blogStudio: boolean;
  blogStudioCheckout: boolean;
  blogStudioImages: boolean;
  blogDesktopSales: boolean;
  blogStudioFullSuite: boolean;
  blogStudioPublishing: boolean;
  blogStudioScheduler: boolean;
  blogStudioScraping: boolean;
  blogStudioByok: boolean;
  blogStudioSync: boolean;
  blogStudioAnalytics: boolean;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly config: ConfigService) {}

  getFlags(): FeatureFlags {
    const fullSuite = this.parseFlag('FEATURE_BLOG_STUDIO_FULL_SUITE', true);
    return {
      publicTools: this.parseFlag('FEATURE_PUBLIC_TOOLS', true),
      storeCheckout: this.parseFlag('FEATURE_STORE_CHECKOUT', false),
      stripeEnabled: this.parseFlag(
        'FEATURE_STRIPE',
        Boolean(this.config.get<string>('STRIPE_SECRET_KEY')),
      ),
      razorpayEnabled: this.parseFlag(
        'FEATURE_RAZORPAY',
        Boolean(this.config.get<string>('RAZORPAY_KEY_ID')) &&
          Boolean(this.config.get<string>('RAZORPAY_KEY_SECRET')),
      ),
      subscriptionsEnabled: this.parseFlag('FEATURE_SUBSCRIPTIONS', false),
      adminPortalEnabled: this.parseFlag('FEATURE_ADMIN_PORTAL', false),
      anonymousUsageEnabled: this.parseFlag('FEATURE_ANONYMOUS_USAGE', true),
      teamsEnabled: this.parseFlag('FEATURE_TEAMS', false),
      apiKeysEnabled: this.parseFlag('FEATURE_API_KEYS', false),
      blogStudio: this.parseFlag('FEATURE_BLOG_STUDIO', true),
      blogStudioCheckout: this.parseFlag('FEATURE_BLOG_STUDIO_CHECKOUT', true),
      blogStudioImages: this.parseFlag('FEATURE_BLOG_STUDIO_IMAGES', true),
      blogDesktopSales: this.parseFlag('FEATURE_BLOG_DESKTOP_SALES', true),
      blogStudioFullSuite: fullSuite,
      blogStudioPublishing: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_PUBLISHING', true),
      blogStudioScheduler: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_SCHEDULER', true),
      blogStudioScraping: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_SCRAPING', true),
      blogStudioByok: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_BYOK', true),
      blogStudioSync: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_SYNC', true),
      blogStudioAnalytics: fullSuite && this.parseFlag('FEATURE_BLOG_STUDIO_ANALYTICS', true),
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
