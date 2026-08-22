import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarClock, UserRound, Wallet } from "lucide-react";
import { useMemo } from "react";

import { AttendanceSummaryCards } from "@/components/attendance/AttendanceSummaryCards";
import { LeaveBalanceCards } from "@/components/leave/LeaveBalanceCards";
import { TodayAttendanceCard } from "@/components/attendance/TodayAttendanceCard";
import { DashboardGrid, type DashboardSectionProps } from "@/components/common/DashboardSection";
import { PageHeader } from "@/components/common/PageHeader";
import { QuickActions, type QuickAction } from "@/components/common/QuickActions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { businessDate, businessMonthStart, summarise } from "@/lib/attendance/rules";
import { EmptyState } from "@/components/common/states";
import { attendanceService } from "@/services/attendance/attendanceService";
import { leaveService } from "@/services/leave/leaveService";
import { payrollService } from "@/services/payroll/payrollService";

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

      <section className="space-y-3" aria-label="Your sections">
        <h2 className="font-display text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Your workspace
        </h2>
        <DashboardGrid sections={sections} />
      </section>
    </div>
  );
}
