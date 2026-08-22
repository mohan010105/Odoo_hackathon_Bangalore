import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { PayslipDialog } from "@/components/payroll/PayslipDialog";
import { SalaryBreakdownTable } from "@/components/payroll/SalaryBreakdownTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { componentLines, formatMoney, periodLabel } from "@/lib/payroll/rules";
import { payrollService, type PayrollRecordRow } from "@/services/payroll/payrollService";

/** Employee self-service payroll: own salary structure and own payslips only. */
export function EmployeePayrollPage() {
  const [payslip, setPayslip] = useState<PayrollRecordRow | null>(null);
  // Payroll notifications deep-link to ?year=&month=, so the alert opens the
  // matching payslip straight away.
  const search = useSearch({ from: "/employee/payroll" });
  const opened = useRef(false);

  const salary = useQuery({
    queryKey: ["my-salary-structure"],
    queryFn: () => payrollService.mySalaryStructure(),
  });

  const records = useQuery({
    queryKey: ["my-payroll-records"],
    queryFn: () => payrollService.listMine(),
  });

  const structure = salary.data?.structure ?? null;
  const breakdown = salary.data?.breakdown ?? null;
  const rows = records.data ?? [];
  const latest = rows[0];
  const highlighted =
    search.year && search.month
      ? rows.find(
          (row) => row.period_year === search.year && row.period_month === search.month,
        )
      : undefined;

  useEffect(() => {
    if (opened.current || !highlighted) return;
    opened.current = true;
    setPayslip(highlighted);
  }, [highlighted]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My payroll"
        description="Your salary structure and payslip history."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly net salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold text-foreground">
              {breakdown ? formatMoney(breakdown.net_salary, structure?.currency) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold text-foreground">
              {breakdown ? formatMoney(breakdown.gross_earnings, structure?.currency) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest payslip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold text-foreground">
              {latest
                ? periodLabel({ year: latest.period_year, month: latest.period_month })
                : "—"}
            </p>
            {latest ? (
              <div className="mt-2">
                <PayrollStatusBadge status={latest.status} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary structure</CardTitle>
        </CardHeader>
        <CardContent>
          {salary.isPending ? (
            <LoadingState label="Loading your salary structure…" />
          ) : salary.isError ? (
            <ErrorState
              title="Salary structure unavailable"
              description={salary.error instanceof Error ? salary.error.message : "Please try again."}
              onRetry={() => void salary.refetch()}
            />
          ) : !structure || !breakdown ? (
            <EmptyState
              title="No salary structure yet"
              description="HR has not assigned a salary structure to you, so payslips cannot be generated yet. Ask your HR administrator to assign one."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/employee/help">Contact HR</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Effective from {structure.effective_from}. Percentage components are calculated on
                your basic salary.
              </p>
              <SalaryBreakdownTable
                basicSalary={Number(breakdown.basic_salary)}
                earnings={componentLines(breakdown.earnings)}
                deductions={componentLines(breakdown.deductions)}
                grossEarnings={Number(breakdown.gross_earnings)}
                totalDeductions={Number(breakdown.total_deductions)}
                netSalary={Number(breakdown.net_salary)}
                currency={structure.currency}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {records.isPending ? (
            <LoadingState label="Loading your payslips…" />
          ) : records.isError ? (
            <ErrorState
              title="Payslips unavailable"
              description={
                records.error instanceof Error ? records.error.message : "Please try again."
              }
              onRetry={() => void records.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payslips yet"
              description="Your payslips appear here as soon as HR processes payroll."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.id === highlighted?.id ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="font-medium">
                        {periodLabel({ year: row.period_year, month: row.period_month })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(row.gross_earnings), row.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(row.total_deductions), row.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(Number(row.net_salary), row.currency)}
                      </TableCell>
                      <TableCell>
                        <PayrollStatusBadge status={row.status} />
                      </TableCell>
                       <TableCell className="text-right whitespace-nowrap">
                         <Button size="sm" variant="outline" onClick={() => setPayslip(row)}>
                           View
                         </Button>
                         <Button asChild size="sm" variant="ghost">
                           <Link to="/payslips/$payslipId" params={{ payslipId: row.id }}>
                             Print
                           </Link>
                         </Button>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PayslipDialog record={payslip} onClose={() => setPayslip(null)} />
    </div>
  );
}
