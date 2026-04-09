export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function withIdempotencyKey(config: Record<string, any> = {}): Record<string, any> {
  return {
    ...config,
    headers: {
      ...config.headers,
      'X-Idempotency-Key': generateIdempotencyKey(),
    },
  };
}
