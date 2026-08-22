import {
  PlugZap,
  Bell,
  Briefcase,
  Building2,
  CircleHelp,
  ScrollText,
  BadgeDollarSign,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Network,
  Scale,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

/** A titled cluster of navigation entries rendered as one sidebar block. */
export type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

export const EMPLOYEE_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/employee/dashboard", icon: LayoutDashboard },
      { label: "My profile", to: "/employee/profile", icon: UserRound },
    ],
  },
  {
    label: "Workday",
    items: [
      { label: "Attendance", to: "/employee/attendance", icon: CalendarCheck },
      { label: "Time off", to: "/employee/leave", icon: CalendarClock },
    ],
  },
  {
    label: "Pay",
    items: [{ label: "My salary & payslips", to: "/employee/payroll", icon: Wallet }],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", to: "/employee/notifications", icon: Bell },
      { label: "Settings", to: "/employee/settings", icon: Settings },
      { label: "Help", to: "/employee/help", icon: CircleHelp },
    ],
  },
] as const satisfies readonly NavGroup[];

export const ADMIN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { label: "Employees", to: "/admin/employees", icon: Users },
      { label: "Departments", to: "/admin/departments", icon: Network },
      { label: "Job positions", to: "/admin/positions", icon: Briefcase },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck },
      { label: "Time off", to: "/admin/leave", icon: ClipboardCheck },
      { label: "Leave allocations", to: "/admin/leave/balances", icon: Scale },
      { label: "Reports", to: "/admin/reports", icon: CalendarClock },
    ],
  },
  {
    label: "Pay",
    items: [
      { label: "Salary structures", to: "/admin/payroll/structures", icon: Wallet },
      { label: "Payroll", to: "/admin/payroll", icon: BadgeDollarSign },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Activity log", to: "/admin/audit", icon: ScrollText },
      { label: "Odoo integration", to: "/admin/integrations", icon: PlugZap },
      { label: "My profile", to: "/admin/profile", icon: UserRound },
      { label: "Company settings", to: "/admin/settings", icon: Building2 },
      { label: "Help", to: "/admin/help", icon: CircleHelp },
    ],
  },
] as const satisfies readonly NavGroup[];

function flatten(groups: readonly NavGroup[]): readonly NavItem[] {
  return groups.flatMap((group) => group.items);
}

export const EMPLOYEE_NAV = flatten(EMPLOYEE_NAV_GROUPS);
export const ADMIN_NAV = flatten(ADMIN_NAV_GROUPS);

export function navigationForRole(role: Role): readonly NavItem[] {
  return role === "ADMIN" ? ADMIN_NAV : EMPLOYEE_NAV;
}

export function navigationGroupsForRole(role: Role): readonly NavGroup[] {
  return role === "ADMIN" ? ADMIN_NAV_GROUPS : EMPLOYEE_NAV_GROUPS;
}
