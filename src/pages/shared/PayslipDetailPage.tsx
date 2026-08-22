import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/states";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { SalaryBreakdownTable } from "@/components/payroll/SalaryBreakdownTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  attendanceContext,
  componentLines,
  formatHours,
  leaveContext,
  periodLabel,
  periodRangeLabel,
} from "@/lib/payroll/rules";
import { payrollService } from "@/services/payroll/payrollService";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Printable payslip detail. The record is fetched by id through an
 * authenticated server function, so row-level security decides access: an
 * employee opening someone else's id simply gets "not available".
 */
export function PayslipDetailPage({ payslipId }: { payslipId: string }) {
  const record = useQuery({
    queryKey: ["payslip", payslipId],
    queryFn: () => payrollService.record(payslipId),
    retry: false,
  });

  if (record.isLoading) return <LoadingState label="Opening payslip…" />;

  if (record.isError || !record.data) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="Payslip not available"
          description="This payslip does not exist, or your account is not allowed to view it."
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link to="/payslips">
              <ArrowLeft aria-hidden="true" className="mr-2 size-4" /> Back to payslips
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const row = record.data;
  const period = { year: row.period_year, month: row.period_month };
  const attendance = attendanceContext(row.attendance_summary);
  const leave = leaveContext(row.leave_summary);
  const employeeName = row.employees
    ? `${row.employees.first_name} ${row.employees.last_name}`
    : "Employee";

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title={`Payslip — ${periodLabel(period)}`}
          description={periodRangeLabel(period)}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" className="mr-2 size-4" /> Print
              </Button>
              <Button onClick={() => window.print()}>
                <Download aria-hidden="true" className="mr-2 size-4" /> Download payslip
              </Button>
            </div>
          }
        />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="font-display text-xl font-semibold tracking-tight text-foreground">
                DAYFLOW
              </p>
              <p className="text-xs text-muted-foreground">Human Resource Management System</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{periodLabel(period)}</p>
              <p className="text-xs text-muted-foreground">{periodRangeLabel(period)}</p>
              <div className="mt-1 flex justify-end print:hidden">
                <PayrollStatusBadge status={row.status} />
              </div>
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
            <Detail label="Employee" value={employeeName} />
            <Detail label="Employee ID" value={row.employees?.login_id ?? "—"} />
            <Detail label="Department" value={row.employees?.department ?? "—"} />
            <Detail label="Job position" value={row.employees?.job_position ?? "—"} />
            <Detail label="Working days" value={String(attendance.working_days ?? 0)} />
            <Detail label="Present days" value={String(attendance.present_days ?? 0)} />
            <Detail label="Paid leave" value={String(leave.paid_days ?? 0)} />
            <Detail label="Extra hours" value={formatHours(attendance.extra_hours ?? 0)} />
          </dl>

          <SalaryBreakdownTable
            basicSalary={Number(row.basic_salary)}
            earnings={componentLines(row.earnings)}
            deductions={componentLines(row.deductions)}
            grossEarnings={Number(row.gross_earnings)}
            totalDeductions={Number(row.total_deductions)}
            netSalary={Number(row.net_salary)}
            currency={row.currency}
          />

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            This payslip is generated by Dayflow from recorded attendance, approved leave and the
            employee's active salary structure. Amounts are shown in {row.currency}.
          </p>
        </CardContent>
      </Card>

      <div className="print:hidden">
        <Button asChild variant="ghost">
          <Link to="/payslips">
            <ArrowLeft aria-hidden="true" className="mr-2 size-4" /> Back to payslips
          </Link>
        </Button>
      </div>
    </div>
  );
}
