import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CalendarCheck, CalendarClock, ChevronRight, Sparkles, UserRound, Wallet } from "lucide-react";
import { useMemo } from "react";

import { AttendanceSummaryCards } from "@/components/attendance/AttendanceSummaryCards";
import { LeaveBalanceCards } from "@/components/leave/LeaveBalanceCards";
import { TodayAttendanceCard } from "@/components/attendance/TodayAttendanceCard";
import { DashboardGrid, type DashboardSectionProps } from "@/components/common/DashboardSection";
import { PageHeader } from "@/components/common/PageHeader";
import { QuickActions, type QuickAction } from "@/components/common/QuickActions";
import { EntitlementHistoryView } from "@/components/employee/EntitlementHistoryView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { businessDate, businessMonthStart, summarise } from "@/lib/attendance/rules";
import { EmptyState } from "@/components/common/states";
import { attendanceService } from "@/services/attendance/attendanceService";
import { leaveService } from "@/services/leave/leaveService";
import { payrollService } from "@/services/payroll/payrollService";
import { profileService } from "@/services/profile/profileService";

const sections: DashboardSectionProps[] = [
  {
    title: "My profile",
    description: "Picture, contact details and job information.",
    icon: UserRound,
    to: "/employee/profile",
    ctaLabel: "Open my profile",
  },
  {
    title: "Attendance",
    description: "Check in, check out and review your work hours.",
    icon: CalendarCheck,
    to: "/employee/attendance",
    ctaLabel: "Open attendance",
  },
  {
    title: "Leave requests",
    description: "Balances, requests and approval status.",
    icon: CalendarClock,
    to: "/employee/leave",
    ctaLabel: "Open leave",
  },
  {
    title: "Payroll",
    description: "Salary structure and payslip visibility.",
    icon: Wallet,
    to: "/employee/payroll",
    ctaLabel: "Open payroll",
  },
];

const quickActions: readonly QuickAction[] = [
  { label: "Attendance", to: "/employee/attendance", icon: CalendarCheck, primary: true },
  { label: "My profile", to: "/employee/profile", icon: UserRound },
  { label: "Leave", to: "/employee/leave", icon: CalendarClock },
];

export function EmployeeDashboardPage() {
  const { user } = useAuth();

  const range = useMemo(() => ({ from: businessMonthStart(), to: businessDate() }), []);
  const history = useQuery({
    queryKey: ["attendance", "mine", range.from, range.to],
    queryFn: () => attendanceService.listMine(range),
  });

  const summary = useMemo(() => summarise(history.data ?? []), [history.data]);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => profileService.getMyProfile(),
  });

  const balances = useQuery({
    queryKey: ["leave-balance", "mine"],
    queryFn: () => leaveService.myBalance(),
  });

  const myRequests = useQuery({
    queryKey: ["leave-requests", "mine"],
    queryFn: () => leaveService.listMine(),
  });

  const salary = useQuery({
    queryKey: ["my-salary-structure"],
    queryFn: () => payrollService.mySalaryStructure(),
  });

  const missingStructure = !salary.isPending && !salary.isError && !salary.data?.structure;
  const missingLeaveAllocation =
    !balances.isPending && !balances.isError && (balances.data ?? []).length === 0;
  const missingProfileData =
    !profile.isPending &&
    !profile.isError &&
    Boolean(profile.data && (!profile.data.phone || !profile.data.location || !profile.data.avatarPath));

  const pendingRequests = (myRequests.data ?? []).filter(
    (request) => request.status === "PENDING",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My workspace"
        description={
          user
            ? `Signed in as ${user.email} · Employee ID ${user.employeeId}`
            : "Your day at a glance."
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/employee/attendance">Attendance history</Link>
          </Button>
        }
      />

      <QuickActions actions={quickActions} />

      {/* Contextual Action Cards / Missing Data Deep Links */}
      {missingProfileData || missingLeaveAllocation || missingStructure ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Recommended Actions</CardTitle>
            </div>
            <CardDescription>
              Complete missing information to get the full benefit of your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingProfileData ? (
              <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <UserRound className="size-3.5" />
                    <span>Incomplete Profile</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add phone, location or picture to complete your employee record.
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost" className="mt-3 justify-between p-0 h-auto text-xs font-medium text-primary hover:text-primary">
                  <Link to="/employee/profile">
                    Complete profile <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ) : null}

            {missingLeaveAllocation ? (
              <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
                    <AlertCircle className="size-3.5" />
                    <span>No Leave Quota</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No leave allocations assigned yet for this year.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Button asChild size="sm" variant="ghost" className="p-0 h-auto text-xs font-medium text-primary hover:text-primary">
                    <Link to="/employee/help">
                      Contact HR <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {missingStructure ? (
              <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Wallet className="size-3.5" />
                    <span>Salary Structure</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Salary structure is pending HR assignment.
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost" className="mt-3 justify-between p-0 h-auto text-xs font-medium text-primary hover:text-primary">
                  <Link to="/employee/help">
                    Contact HR <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <TodayAttendanceCard />

      <section className="space-y-3" aria-label="This month's attendance">
        <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          This month
        </h2>
        <AttendanceSummaryCards summary={summary} />
      </section>

      <section className="space-y-3" aria-label="Leave balance">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Leave balance
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/employee/leave">
              {pendingRequests > 0
                ? `${pendingRequests} pending request${pendingRequests === 1 ? "" : "s"}`
                : "No pending requests"}
            </Link>
          </Button>
        </div>
        <LeaveBalanceCards balances={balances.data} isLoading={balances.isLoading} />
      </section>

      {missingStructure ? (
        <section className="space-y-3" aria-label="Salary structure">
          <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Salary
          </h2>
          <EmptyState
            title="No salary structure assigned"
            description="Your payslips stay empty until HR assigns a salary structure to your record. Once assigned, your salary breakdown and payslips appear automatically."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/employee/payroll">Open my payroll</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/employee/help">Contact HR</Link>
                </Button>
              </div>
            }
          />
        </section>
      ) : null}

      {/* Entitlement History Overview */}
      <section className="space-y-3" aria-label="Entitlement history">
        <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Entitlements & Compensation
        </h2>
        <EntitlementHistoryView
          title="Recent entitlement changes"
          description="Recent adjustments to your leave quotas and salary structure."
          limit={4}
        />
      </section>

      <section className="space-y-3" aria-label="Your sections">
        <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Your workspace
        </h2>
        <DashboardGrid sections={sections} />
      </section>
    </div>
  );
}
