import { SetMetadata } from '@nestjs/common';
import type { FeatureFlags } from './feature-flags.service';

export const REQUIRED_FEATURES_KEY = 'requiredFeatures';

export const RequireFeatures = (...flags: Array<keyof FeatureFlags>) =>
  SetMetadata(REQUIRED_FEATURES_KEY, flags);
