import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  UserRound,
  BadgeDollarSign,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Users,
  PlugZap,
} from "lucide-react";

import { DashboardGrid, type DashboardSectionProps } from "@/components/common/DashboardSection";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { QuickActions, type QuickAction } from "@/components/common/QuickActions";
import { AdminTodayStats } from "@/components/attendance/AttendanceSummaryCards";
import { Skeleton } from "@/components/ui/skeleton";
import { attendanceService } from "@/services/attendance/attendanceService";
import { odooClient } from "@/services/odoo";
import { odooIntegrationService } from "@/services/odoo/integrationService";
import { leaveService } from "@/services/leave/leaveService";
import { Badge } from "@/components/ui/badge";

/** Compact "x minutes ago" label for the last successful Odoo sync. */
function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const sections: DashboardSectionProps[] = [
  {
    title: "Employees",
    description: "Directory, onboarding and employee records.",
    icon: Users,
    to: "/admin/employees",
    ctaLabel: "Open directory",
  },
  {
    title: "Attendance",
    description: "Monitor check-ins and correct records.",
    icon: CalendarCheck,
    to: "/admin/attendance",
    ctaLabel: "Open attendance",
  },
  {
    title: "Leave approvals",
    description: "Pending time-off requests awaiting review.",
    icon: ClipboardCheck,
    to: "/admin/leave",
    ctaLabel: "Open approvals",
  },
  {
    title: "Payroll",
    description: "Salary structures and payroll visibility.",
    icon: BadgeDollarSign,
    to: "/admin/payroll",
    ctaLabel: "Open payroll",
  },
  {
    title: "Activity log",
    description: "Latest HR operations across the organisation.",
    icon: Activity,
    to: "/admin/audit",
    ctaLabel: "Open activity log",
  },
  {
    title: "Odoo integration",
    description: "Connection health and data synchronisation.",
    icon: PlugZap,
    to: "/admin/integrations",
    ctaLabel: "Open integration",
  },
  {
    title: "Company settings",
    description: "Company name and logo used across Dayflow.",
    icon: Building2,
    to: "/admin/settings",
    ctaLabel: "Open settings",
  },
];

const quickActions: readonly QuickAction[] = [
  { label: "Employees", to: "/admin/employees", icon: Users, primary: true },
  { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck },
  { label: "My profile", to: "/admin/profile", icon: UserRound },
];

export function AdminDashboardPage() {
  const summary = useQuery({
    queryKey: ["attendance", "today-summary"],
    queryFn: () => attendanceService.todaySummary(),
  });

  const pendingLeave = useQuery({
    queryKey: ["leave", "pending-count"],
    queryFn: () => leaveService.pendingCount(),
  });

  const odooStatus = useQuery({
    queryKey: ["odoo-status"],
    queryFn: () => odooClient.getConnectionStatus(),
  });

  const odooOverview = useQuery({
    queryKey: ["odoo-overview", "dashboard"],
    queryFn: () => odooIntegrationService.overview(),
  });

  const status = odooStatus.data;
  const odooLabel =
    status === "not_configured" ? "Not configured" : status ? status : "Checking…";

  return (
    <div className="space-y-8">
      <PageHeader
        title="HR operations"
        description="Monitor people, attendance, approvals and payroll from one place."
        actions={
          <Badge variant="outline" className="gap-2">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                status === "connected" ? "bg-chart-5" : "bg-muted-foreground"
              }`}
            />
            Odoo: {odooLabel.toLowerCase()}
          </Badge>
        }
      />

      {/* Four headline KPIs, all sourced from live records. */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total employees"
          value={summary.data?.totalEmployees ?? "—"}
          icon={Users}
          tone="primary"
          loading={summary.isLoading}
        />
        <StatCard
          label="Present today"
          value={summary.data?.present ?? "—"}
          icon={CalendarCheck}
          tone="success"
          context={
            summary.data ? `${summary.data.notCheckedIn} not checked in` : undefined
          }
          loading={summary.isLoading}
        />
        <StatCard
          label="Pending leave approvals"
          value={pendingLeave.data ?? "—"}
          icon={ClipboardCheck}
          tone="warning"
          loading={pendingLeave.isLoading}
        />
        <StatCard
          label="Odoo integration"
          value={odooLabel}
          icon={PlugZap}
          tone={status === "connected" ? "success" : "neutral"}
          context={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {odooOverview.data?.lastSuccessfulSyncAt
                  ? `Last synced ${relativeTime(odooOverview.data.lastSuccessfulSyncAt)}`
                  : "Not synced yet"}
              </span>
              {odooOverview.data && odooOverview.data.errorCount > 0 ? (
                <Link
                  to="/admin/integrations"
                  search={{ status: "FAILED" }}
                  className="font-medium text-destructive underline-offset-4 hover:underline"
                >
                  Sync failed — view details
                </Link>
              ) : null}
            </span>
          }
          loading={odooStatus.isLoading}
        />
      </section>

      <QuickActions actions={quickActions} />

      <section className="space-y-3" aria-label="Today's attendance">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Today's attendance
        </h2>
        {summary.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : summary.data ? (
          <AdminTodayStats summary={summary.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            We could not load today's attendance summary.
          </p>
        )}
      </section>

      <section className="space-y-3" aria-label="HR sections">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Manage
        </h2>
        <DashboardGrid sections={sections} />
      </section>
    </div>
  );
}

