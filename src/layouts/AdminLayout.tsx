import { Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { ADMIN_NAV_GROUPS } from "@/config/navigation";

export function AdminLayout() {
  return (
    <RoleGuard allow="ADMIN">
      <AppShell groups={ADMIN_NAV_GROUPS} workspaceLabel="HR & Admin workspace">
        <Outlet />
      </AppShell>
    </RoleGuard>
  );
}
