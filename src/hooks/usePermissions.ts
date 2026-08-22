import { useMemo } from "react";

import { useAuth } from "./useAuth";
import {
  canAccessRoute,
  hasAnyPermission,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();

  return useMemo(
    () => ({
      permissions: user ? ROLE_PERMISSIONS[user.role] : [],
      can: (permission: Permission) => hasAnyPermission(user, [permission]),
      canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
      canAccess: (pathname: string) => canAccessRoute(user, pathname),
    }),
    [user],
  );
}
