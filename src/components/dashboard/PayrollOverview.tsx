import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeDollarSign } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, periodLabel } from "@/lib/payroll/rules";
import { dashboardService } from "@/services/dashboard/dashboardService";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** Latest payroll period headline for the admin dashboard. */
export function PayrollOverview() {
  const overview = useQuery({
    queryKey: ["dashboard", "latest-payroll"],
    queryFn: () => dashboardService.latestPayroll(),
    staleTime: 60_000,
  });

  const data = overview.data;

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Payroll status</CardTitle>
        <CardDescription>
          {data
            ? `${periodLabel({ year: data.year, month: data.month })} · ${data.employees} payslip(s)`
            : "Most recent payroll period."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : overview.isError ? (
          <ErrorState
            title="Payroll overview unavailable"
            description="We could not load payroll totals right now."
            onRetry={() => void overview.refetch()}
          />
        ) : !data ? (
          <EmptyState
            title="No payroll runs yet"
            description="Generate payroll for a period to see totals here."
            action={
              <Button asChild size="sm">
                <Link to="/admin/payroll">
                  <BadgeDollarSign aria-hidden="true" className="mr-2 size-4" />
                  Open payroll
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Gross payroll" value={formatMoney(data.totalGross, data.currency)} />
              <Metric
                label="Deductions"
                value={formatMoney(data.totalDeductions, data.currency)}
              />
              <Metric label="Net payroll" value={formatMoney(data.totalNet, data.currency)} />
              <Metric label="Average net" value={formatMoney(data.averageNet, data.currency)} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{data.generated} generated</span>
              <span aria-hidden="true">·</span>
              <span>{data.processed} processed</span>
              <span aria-hidden="true">·</span>
              <span>{data.paid} paid</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/payroll">Open payroll register</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
