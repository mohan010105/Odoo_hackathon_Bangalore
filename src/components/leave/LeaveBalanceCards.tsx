import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDays, formatLeaveDate } from "@/lib/leave/rules";
import type { LeaveBalanceRow } from "@/services/leave/leaveService";

/**
 * Leave balance per allocation. Only allocations that HR has actually created
 * are shown — no invented allowances.
 */
export function LeaveBalanceCards({
  balances,
  isLoading,
}: {
  balances: LeaveBalanceRow[] | undefined;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const allocated = (balances ?? []).filter((row) => row.allocation_id);

  if (allocated.length === 0) {
    return (
      <EmptyState
        title="No leave allocated yet"
        description="Your balances appear here once HR sets up your leave policy. Until then you cannot submit a leave request."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/employee/leave">Open my leave section</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/employee/help">Contact HR</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {allocated.map((row) => {
        const total = Number(row.allocated_days) || 0;
        const used = Number(row.used_days) || 0;
        const pending = Number(row.pending_days) || 0;
        const percent = total > 0 ? Math.min(Math.round(((used + pending) / total) * 100), 100) : 0;
        const remaining = Number(row.remaining_days) || 0;

        return (
          <Card key={row.allocation_id ?? row.leave_type_id} className="border-border/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {row.name}
                </CardTitle>
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  {percent}% used
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 p-4 pt-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                  {formatDays(remaining)}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {formatDays(total)} days left
                </span>
              </div>
              <Progress value={percent} className="h-1.5" aria-label={`${row.name} usage`} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatDays(used)} used</span>
                {pending > 0 ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {formatDays(pending)} pending
                  </span>
                ) : null}
              </div>
              {row.valid_from && row.valid_to ? (
                <p className="border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground/80">
                  Valid: {formatLeaveDate(row.valid_from)} → {formatLeaveDate(row.valid_to)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
