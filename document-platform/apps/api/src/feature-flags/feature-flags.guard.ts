import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService, type FeatureFlags } from './feature-flags.service';
import { REQUIRED_FEATURES_KEY } from './require-features.decorator';

@Injectable()
export class FeatureFlagsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndMerge<Array<keyof FeatureFlags>>(
      REQUIRED_FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const disabled = required.find((flag) => !this.flags.isEnabled(flag));
    if (disabled) {
      throw new NotFoundException('This platform feature is not currently available.');
    }
    return true;
  }
}
