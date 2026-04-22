import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAGS_KEY } from '../decorators/feature-flags.decorator';

@Injectable()
export class FeatureFlagsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFlags = this.reflector.getAllAndOverride<string[]>(FEATURE_FLAGS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFlags || requiredFlags.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const enabledFlags = this.getEnabledFlags();

    return requiredFlags.every(flag => enabledFlags.includes(flag));
  }

  private getEnabledFlags(): string[] {
    // For now, read from environment variables
    // In production, this could be from a feature flag service
    const flags = [];
    
    if (process.env.FEATURE_VIRTUAL_STORE_WALK === 'true') {
      flags.push('FEATURE_VIRTUAL_STORE_WALK');
    }
    if (process.env.FEATURE_MARKETPLACE_TOGGLE === 'true') {
      flags.push('FEATURE_MARKETPLACE_TOGGLE');
    }
    if (process.env.FEATURE_CITY_MALL_MANAGER === 'true') {
      flags.push('FEATURE_CITY_MALL_MANAGER');
    }
    
    return flags;
  }
}
