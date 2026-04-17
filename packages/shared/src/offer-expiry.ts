/**
 * Seller offer validity window (createdAt → expiresAt).
 * Used for urgency UI: bar width = remaining fraction, anchored to the right.
 */

export function offerValidityRemainingFraction(
  createdAt: string | Date,
  expiresAt: string | Date,
  nowMs: number = Date.now(),
): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (nowMs >= end) return 0;
  if (nowMs <= start) return 1;
  return (end - nowMs) / (end - start);
}

export function offerRemainingMs(expiresAt: string | Date, nowMs: number = Date.now()): number {
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - nowMs);
}

/** Human-readable time left on an offer (compact). */
export function formatOfferTimeLeft(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Visual urgency tier from remaining fraction (1 = full window left). */
export function offerExpiryUrgencyTier(fraction: number): 'critical' | 'high' | 'ok' {
  if (fraction <= 0.08) return 'critical';
  if (fraction <= 0.25) return 'high';
  return 'ok';
}
