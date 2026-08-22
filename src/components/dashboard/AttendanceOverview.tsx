import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState, ErrorState } from "@/components/common/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardService } from "@/services/dashboard/dashboardService";

/**
 * Fourteen-day attendance mix. Every value comes from the attendance table via
 * an admin-only server function; there is no sample or placeholder series.
 */
export function AttendanceOverview() {
  const overview = useQuery({
    queryKey: ["dashboard", "attendance-overview"],
    queryFn: () => dashboardService.attendanceOverview(),
    staleTime: 60_000,
  });

  const totals = overview.data?.totals;
  const hasRecords =
    totals !== undefined &&
    totals.present + totals.absent + totals.halfDay + totals.leave > 0;

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Attendance overview</CardTitle>
        <CardDescription>
          {hasRecords
            ? `Last 14 days · ${totals.present} present, ${totals.leave} on leave, ${totals.hours} work hours logged`
            : "Daily attendance mix across the last 14 days."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : overview.isError ? (
          <ErrorState
            title="Attendance overview unavailable"
            description="We could not load attendance counts right now."
            onRetry={() => void overview.refetch()}
          />
        ) : !hasRecords ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Once employees start checking in, their daily attendance appears here."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.data!.series} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "0.8rem",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                <Bar dataKey="present" name="Present" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="halfDay" name="Half day" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="leave" name="Leave" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
