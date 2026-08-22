import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/common/states";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, periodLabel } from "@/lib/payroll/rules";
import { dashboardService } from "@/services/dashboard/dashboardService";

/** The signed-in employee's newest payslip, straight from their own records. */
export function LatestPayslipCard() {
  const latest = useQuery({
    queryKey: ["dashboard", "my-latest-payslip"],
    queryFn: () => dashboardService.myLatestPayslip(),
    staleTime: 60_000,
  });

  const record = latest.data;

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Latest payslip</CardTitle>
        <CardDescription>
          {record
            ? periodLabel({ year: record.period_year, month: record.period_month })
            : "Your most recent salary payment."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : latest.isError ? (
          <ErrorState
            title="Payslip unavailable"
            description="We could not load your latest payslip right now."
            onRetry={() => void latest.refetch()}
          />
        ) : !record ? (
          <EmptyState
            title="No payslips available"
            description="Your payslip appears here as soon as HR generates payroll for a period."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Net salary</p>
                <p className="font-display text-2xl font-semibold text-foreground">
                  {formatMoney(Number(record.net_salary), record.currency)}
                </p>
              </div>
              <PayrollStatusBadge status={record.status} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Gross</dt>
                <dd className="font-medium">
                  {formatMoney(Number(record.gross_earnings), record.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deductions</dt>
                <dd className="font-medium">
                  {formatMoney(Number(record.total_deductions), record.currency)}
                </dd>
              </div>
            </dl>
            <Button asChild size="sm" variant="outline">
              <Link to="/payslips/$payslipId" params={{ payslipId: record.id }}>
                <Wallet aria-hidden="true" className="mr-2 size-4" />
                View payslip
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
