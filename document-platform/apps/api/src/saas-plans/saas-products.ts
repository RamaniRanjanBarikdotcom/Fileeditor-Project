import type { FeatureFlags } from '../feature-flags/feature-flags.service';

export const INVOICE_STUDIO_SLUG = 'invoice-studio';

/**
 * SaaS products sold through generic plans. Each is gated by its own feature
 * flags; products not listed here cannot be reached through /saas/:slug.
 */
export const GENERIC_SAAS_PRODUCTS: Record<
  string,
  { featureFlag: keyof FeatureFlags; checkoutFlag: keyof FeatureFlags }
> = {
  [INVOICE_STUDIO_SLUG]: { featureFlag: 'invoicing', checkoutFlag: 'invoicingCheckout' },
};
