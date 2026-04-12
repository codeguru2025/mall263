/** Stall logo overrides merchant logo for receipts and product cards. */
export function resolveStoreLogo(
  stall: { logoUrl?: string | null },
  merchant: { logoUrl?: string | null },
): string | null {
  return stall.logoUrl || merchant.logoUrl || null;
}
