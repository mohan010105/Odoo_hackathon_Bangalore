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
  Plus,
} from "lucide-react";

import { DashboardGrid, type DashboardSectionProps } from "@/components/common/DashboardSection";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { QuickActions, type QuickAction } from "@/components/common/QuickActions";
import { AdminTodayStats } from "@/components/attendance/AttendanceSummaryCards";
import { Button } from "@/components/ui/button";
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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const sections: DashboardSectionProps[] = [
  {
    title: "Employees",
    description: "Directory, onboarding, departments and employee records.",
    icon: Users,
    to: "/admin/employees",
    ctaLabel: "Open directory",
  },
  {
    title: "Attendance",
    description: "Monitor check-ins, daily presence and manual corrections.",
    icon: CalendarCheck,
    to: "/admin/attendance",
    ctaLabel: "Open attendance",
  },
  {
    title: "Leave approvals",
    description: "Pending time-off requests, balances and allocations.",
    icon: ClipboardCheck,
    to: "/admin/leave",
    ctaLabel: "Open approvals",
  },
  {
    title: "Payroll",
    description: "Salary structures, period batches and payslips.",
    icon: BadgeDollarSign,
    to: "/admin/payroll",
    ctaLabel: "Open payroll",
  },
  {
    title: "Activity log",
    description: "Audit trail of every HR operation across the workspace.",
    icon: Activity,
    to: "/admin/audit",
    ctaLabel: "Open activity log",
  },
  {
    title: "Odoo integration",
    description: "ERP connection health, synchronization matrix and logs.",
    icon: PlugZap,
    to: "/admin/integrations",
    ctaLabel: "Open integration",
  },
  {
    title: "Company settings",
    description: "Company name, logo and workspace branding.",
    icon: Building2,
    to: "/admin/settings",
    ctaLabel: "Open settings",
  },
];

const quickActions: readonly QuickAction[] = [
  { label: "Directory", to: "/admin/employees", icon: Users, primary: true },
  { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck },
  { label: "Leave queue", to: "/admin/leave", icon: ClipboardCheck },
  { label: "Payroll", to: "/admin/payroll", icon: BadgeDollarSign },
  { label: "Odoo Sync", to: "/admin/integrations", icon: PlugZap },
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
  const isConnected = status === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Operations"
        description="Real-time workspace overview: workforce, daily attendance, leave approvals, and ERP sync."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isConnected ? "success" : "neutral"} className="gap-1.5 py-1 px-2.5">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  isConnected ? "bg-emerald-600 animate-pulse" : "bg-muted-foreground"
                }`}
              />
              Odoo: {status ?? "Checking…"}
            </Badge>
            <Button asChild size="sm">
              <Link to="/admin/employees/new">
                <Plus aria-hidden="true" className="mr-1 size-3.5" /> Add employee
              </Link>
            </Button>
          </div>
        }
      />

      {/* Four headline KPIs, all sourced from live records. */}
      <section aria-label="Key metrics" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
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
          value={isConnected ? "Connected" : (status ?? "—")}
          icon={PlugZap}
          tone={isConnected ? "success" : "neutral"}
          context={
            <span className="flex flex-wrap items-center gap-1.5">
              <span>
                {odooOverview.data?.lastSuccessfulSyncAt
                  ? `Synced ${relativeTime(odooOverview.data.lastSuccessfulSyncAt)}`
                  : "Not synced yet"}
              </span>
              {odooOverview.data && odooOverview.data.errorCount > 0 ? (
                <Link
                  to="/admin/integrations"
                  search={{ status: "FAILED" }}
                  className="font-semibold text-destructive hover:underline"
                >
                  · {odooOverview.data.errorCount} failed
                </Link>
              ) : null}
            </span>
          }
          loading={odooStatus.isLoading}
        />
      </section>

      <QuickActions actions={quickActions} />

      <section className="space-y-3" aria-label="Today's attendance">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Today's attendance breakdown
        </h2>
        {summary.isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : summary.data ? (
          <AdminTodayStats summary={summary.data} />
        ) : (
          <p className="text-xs text-muted-foreground">
            We could not load today's attendance summary.
          </p>
        )}
      </section>

      <section className="space-y-3" aria-label="HR sections">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Management modules
        </h2>
        <DashboardGrid sections={sections} />
      </section>
    </div>
  );
}
