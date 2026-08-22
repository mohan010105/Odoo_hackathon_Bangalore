import type { Role, User } from "@/types";

export const PERMISSIONS = [
  // Employee scope
  "view_own_profile",
  "edit_limited_profile",
  "view_own_attendance",
  "check_in",
  "check_out",
  "create_leave_request",
  "view_own_leave",
  "view_own_payroll",
  // Admin / HR scope
  "view_employees",
  "manage_employees",
  "view_all_attendance",
  "manage_leave",
  "approve_leave",
  "reject_leave",
  "view_all_payroll",
  "manage_salary",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "view_own_profile",
  "edit_limited_profile",
  "view_own_attendance",
  "check_in",
  "check_out",
  "create_leave_request",
  "view_own_leave",
  "view_own_payroll",
];

const ADMIN_PERMISSIONS: Permission[] = [
  "view_employees",
  "manage_employees",
  "view_all_attendance",
  "manage_leave",
  "approve_leave",
  "reject_leave",
  "view_all_payroll",
  "manage_salary",
];

/** Single source of truth for role → permission mapping. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
};

export function hasRole(user: User | null | undefined, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}

export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/** Route prefixes owned by each role. Keep in sync with src/config/navigation.ts. */
const ROLE_ROUTE_PREFIX: Record<Role, string> = {
  EMPLOYEE: "/employee",
  ADMIN: "/admin",
};

export function homeRouteForRole(role: Role): string {
  return `${ROLE_ROUTE_PREFIX[role]}/dashboard`;
}

const PUBLIC_ROUTES = ["/", "/login", "/setup", "/change-password"];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * UX-level route authorization. Real authorization must be enforced
 * server-side / in Odoo — this only decides what the UI renders.
 */
export function canAccessRoute(user: User | null | undefined, pathname: string): boolean {
  if (isPublicRoute(pathname)) return true;
  if (!user) return false;
  return pathname.startsWith(ROLE_ROUTE_PREFIX[user.role]);
}
