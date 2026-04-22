import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAGS_KEY = 'featureFlags';
export const FeatureFlags = (...flags: string[]) => SetMetadata(FEATURE_FLAGS_KEY, flags);

export enum FeatureFlag {
  VIRTUAL_STORE_WALK = 'FEATURE_VIRTUAL_STORE_WALK',
  MARKETPLACE_TOGGLE = 'FEATURE_MARKETPLACE_TOGGLE',
  CITY_MALL_MANAGER = 'FEATURE_CITY_MALL_MANAGER',
}
