export const CacheKeys = {
  jwtUser: (userId: string) => `jwt:user:${userId}`,
} as const;

export const CacheTTL = {
  JWT_USER: 60, // seconds — short enough to propagate bans within 1 min
} as const;
