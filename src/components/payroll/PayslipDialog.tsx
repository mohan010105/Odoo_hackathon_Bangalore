import { Printer } from "lucide-react";

import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { SalaryBreakdownTable } from "@/components/payroll/SalaryBreakdownTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attendanceContext,
  componentLines,
  formatHours,
  formatMoney,
  leaveContext,
  periodLabel,
  periodRangeLabel,
} from "@/lib/payroll/rules";
import type { PayrollRecordRow } from "@/services/payroll/payrollService";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Read-only payslip. Shared by the admin register and the employee portal. */
export function PayslipDialog({
  record,
  companyName,
  onClose,
}: {
  record: PayrollRecordRow | null;
  companyName?: string;
  onClose: () => void;
}) {
  if (!record) return null;

  const period = { year: record.period_year, month: record.period_month };
  const attendance = attendanceContext(record.attendance_summary);
  const leave = leaveContext(record.leave_summary);
  const employeeName = record.employees
    ? `${record.employees.first_name} ${record.employees.last_name}`
    : "Employee";

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip — {periodLabel(period)}</DialogTitle>
          <DialogDescription>
            {companyName ? `${companyName} · ` : ""}
            {periodRangeLabel(period)}
          </DialogDescription>
        </DialogHeader>

        <div id="payslip-print-area" className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
            <Detail label="Employee" value={employeeName} />
            <Detail label="Login ID" value={record.employees?.login_id ?? "—"} />
            <Detail label="Department" value={record.employees?.department ?? "—"} />
            <Detail label="Designation" value={record.employees?.job_position ?? "—"} />
            <Detail label="Working days" value={String(attendance.working_days ?? 0)} />
            <Detail label="Present days" value={String(attendance.present_days ?? 0)} />
            <Detail label="Paid leave" value={String(leave.paid_days ?? 0)} />
            <Detail label="Extra hours" value={formatHours(attendance.extra_hours ?? 0)} />
          </dl>

          <SalaryBreakdownTable
            basicSalary={Number(record.basic_salary)}
            earnings={componentLines(record.earnings)}
            deductions={componentLines(record.deductions)}
            grossEarnings={Number(record.gross_earnings)}
            totalDeductions={Number(record.total_deductions)}
            netSalary={Number(record.net_salary)}
            currency={record.currency}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net pay</p>
              <p className="font-display text-2xl font-semibold text-foreground">
                {formatMoney(Number(record.net_salary), record.currency)}
              </p>
            </div>
            <PayrollStatusBadge status={record.status} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" aria-hidden="true" />
            Print / save as PDF
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
