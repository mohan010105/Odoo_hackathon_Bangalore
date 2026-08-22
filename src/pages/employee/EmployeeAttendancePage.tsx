import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AttendanceExportButton } from "@/components/attendance/AttendanceExportButton";
import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { AttendanceSummaryCards } from "@/components/attendance/AttendanceSummaryCards";
import { TodayAttendanceCard } from "@/components/attendance/TodayAttendanceCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  businessDate,
  businessMonthStart,
  monthEnd,
  shiftMonth,
  summarise,
} from "@/lib/attendance/rules";
import { attendanceService } from "@/services/attendance/attendanceService";

type Period = "CURRENT" | "PREVIOUS" | "CUSTOM";

const PAGE_SIZE = 10;

export function EmployeeAttendancePage() {
  const [period, setPeriod] = useState<Period>("CURRENT");
  const [customFrom, setCustomFrom] = useState(businessMonthStart());
  const [customTo, setCustomTo] = useState(businessDate());
  const [page, setPage] = useState(0);

  const range = useMemo(() => {
    if (period === "CURRENT") return { from: businessMonthStart(), to: businessDate() };
    if (period === "PREVIOUS") {
      const start = shiftMonth(businessMonthStart(), -1);
      return { from: start, to: monthEnd(start) };
    }
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);

  // Month aggregate for the summary cards and CSV export.
  const monthly = useQuery({
    queryKey: ["attendance", "mine", range.from, range.to],
    queryFn: () => attendanceService.listMine(range),
    enabled: rangeValid,
  });

  // Paged history for the table: the database returns one page at a time.
  const history = useQuery({
    queryKey: ["attendance", "mine", "page", range.from, range.to, page],
    queryFn: () =>
      attendanceService.listMinePage({ ...range, page, pageSize: PAGE_SIZE }),
    enabled: rangeValid,
  });

  const rows = history.data?.rows ?? [];
  const total = history.data?.total ?? 0;
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const summary = useMemo(() => summarise(monthly.data ?? []), [monthly.data]);

  function changePeriod(next: Period) {
    setPeriod(next);
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My attendance"
        description="Check in, check out and review your hours worked."
        actions={
          <AttendanceExportButton
            rows={monthly.data ?? []}
            filename={`my-attendance-${range.from}-to-${range.to}`}
          />
        }
      />

      <TodayAttendanceCard />

      <AttendanceSummaryCards summary={summary} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="attendance-period">Period</Label>
          <Select value={period} onValueChange={(value) => changePeriod(value as Period)}>
            <SelectTrigger id="attendance-period" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CURRENT">This month</SelectItem>
              <SelectItem value="PREVIOUS">Previous month</SelectItem>
              <SelectItem value="CUSTOM">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === "CUSTOM" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="attendance-from">From</Label>
              <Input
                id="attendance-from"
                type="date"
                value={customFrom}
                onChange={(event) => {
                  setCustomFrom(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attendance-to">To</Label>
              <Input
                id="attendance-to"
                type="date"
                value={customTo}
                onChange={(event) => {
                  setCustomTo(event.target.value);
                  setPage(0);
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      {history.isLoading ? <LoadingState label="Loading attendance…" /> : null}

      {history.isError ? (
        <ErrorState
          description="We could not load your attendance history."
          onRetry={() => void history.refetch()}
        />
      ) : null}

      {history.data && rows.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="No attendance records found for this period."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-4">
          <AttendanceHistoryTable rows={rows} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {pageCount} · {total} record{total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || history.isFetching}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pageCount || history.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
