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
          <Skeleton key={key} className="h-32 w-full" />
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
              <Link to="/employee/help">How to request an allocation</Link>
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

        return (
          <Card key={row.allocation_id ?? row.leave_type_id}>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm font-semibold text-muted-foreground">
                {row.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-display text-2xl leading-none">
                {formatDays(row.remaining_days)}
                <span className="ml-1 text-sm text-muted-foreground">
                  / {formatDays(total)} days
                </span>
              </p>
              <Progress value={percent} aria-label={`${row.name} usage`} />
              <p className="text-xs text-muted-foreground">
                {formatDays(used)} used · {formatDays(pending)} pending
              </p>
              {row.valid_from && row.valid_to ? (
                <p className="text-xs text-muted-foreground">
                  Valid {formatLeaveDate(row.valid_from)} – {formatLeaveDate(row.valid_to)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
