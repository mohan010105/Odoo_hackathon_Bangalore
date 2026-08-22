import { Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { EMPLOYEE_NAV_GROUPS } from "@/config/navigation";

export function EmployeeLayout() {
  return (
    <RoleGuard allow="EMPLOYEE">
      <AppShell groups={EMPLOYEE_NAV_GROUPS} workspaceLabel="Employee workspace">
        <Outlet />
      </AppShell>
    </RoleGuard>
  );
}
