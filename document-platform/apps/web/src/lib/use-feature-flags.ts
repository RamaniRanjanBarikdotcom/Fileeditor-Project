'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from './api';

export type PublicFeatureFlags = {
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
};

const SAFE_DEFAULTS: PublicFeatureFlags = {
  publicTools: true,
  storeCheckout: false,
  stripeEnabled: false,
  razorpayEnabled: false,
  subscriptionsEnabled: false,
  adminPortalEnabled: false,
  anonymousUsageEnabled: true,
  teamsEnabled: false,
  apiKeysEnabled: false,
  blogStudio: false,
  blogStudioCheckout: false,
  blogStudioImages: false,
  blogDesktopSales: false,
  blogStudioFullSuite: false,
  blogStudioPublishing: false,
  blogStudioScheduler: false,
  blogStudioScraping: false,
  blogStudioByok: false,
  blogStudioSync: false,
  blogStudioAnalytics: false,
};

export function useFeatureFlags(): PublicFeatureFlags {
  const [flags, setFlags] = useState<PublicFeatureFlags>(SAFE_DEFAULTS);
  useEffect(() => {
    let active = true;
    void fetchApi<PublicFeatureFlags>('/feature-flags').then((response) => {
      if (active && response.success && response.data) setFlags(response.data);
    });
    return () => {
      active = false;
    };
  }, []);
  return flags;
}

