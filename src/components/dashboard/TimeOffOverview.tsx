import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { EmptyState, ErrorState } from "@/components/common/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardService } from "@/services/dashboard/dashboardService";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--chart-3)",
  APPROVED: "var(--chart-5)",
  REJECTED: "var(--chart-4)",
  CANCELLED: "var(--muted-foreground)",
};

/** Leave request status mix and most-used leave types for the current year. */
export function TimeOffOverview() {
  const overview = useQuery({
    queryKey: ["dashboard", "time-off-overview"],
    queryFn: () => dashboardService.timeOffOverview(),
    staleTime: 60_000,
  });

  const data = overview.data;
  const slices = (data?.statuses ?? []).filter((slice) => slice.value > 0);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Time off overview</CardTitle>
        <CardDescription>
          {data ? `${data.totalRequests} request(s) in ${data.year}` : "Leave requests this year."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : overview.isError ? (
          <ErrorState
            title="Time off overview unavailable"
            description="We could not load leave counts right now."
            onRetry={() => void overview.refetch()}
          />
        ) : slices.length === 0 ? (
          <EmptyState
            title="No leave requests yet"
            description="Requests submitted by employees will be summarised here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.key} fill={STATUS_COLORS[slice.key] ?? "var(--chart-1)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Most used leave types
              </h3>
              <ul className="space-y-2">
                {(data?.byType ?? []).map((type) => (
                  <li
                    key={type.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{type.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {type.requests} req · {type.days} approved day(s)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
