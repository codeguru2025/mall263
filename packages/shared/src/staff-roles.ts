/**
 * Ops / back-office roles: no marketplace shopping wallet flows, no consumer fees
 * in demand/POS (see backend + app usage). Aligned with subscription billing exempt set.
 */
export const STAFF_ADMIN_ROLE_SLUGS = [
  'SUPER_ADMIN',
  'ADMIN_OPS',
  'FINANCE_ADMIN',
  'SUPPORT_ADMIN',
  'MALL_MANAGER',
] as const;

export type StaffAdminRole = (typeof STAFF_ADMIN_ROLE_SLUGS)[number];

export function isStaffAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (STAFF_ADMIN_ROLE_SLUGS as readonly string[]).includes(role);
}

/**
 * First screen after sign-in for staff (mobile / web). Mall managers are scoped to mall tools.
 */
export function getStaffHomePath(role: string | null | undefined): string | null {
  if (!isStaffAdminRole(role)) return null;
  if (role === 'MALL_MANAGER') return '/admin/malls';
  if (role === 'SUPPORT_ADMIN') return '/admin/support';
  return '/admin';
}

/**
 * Main admin dashboard + platform reports: super / ops / finance only
 * (support → support inbox; mall manager → mall tools — see getStaffHomePath).
 */
export const ADMIN_CONSOLE_DASHBOARD_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'] as const;

export function isAdminConsoleDashboardRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ADMIN_CONSOLE_DASHBOARD_ROLES as readonly string[]).includes(role);
}
