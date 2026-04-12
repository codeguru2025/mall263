/** Stall logo wins over merchant fallback (same rule as receipts). */
export function resolveStoreLogo(
  stall?: { logoUrl?: string | null } | null,
  merchant?: { logoUrl?: string | null } | null,
): string | null {
  if (!stall && !merchant) return null;
  return stall?.logoUrl || merchant?.logoUrl || null;
}
