import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AttendanceExportButton } from "@/components/attendance/AttendanceExportButton";
import { AdminTodayStats } from "@/components/attendance/AttendanceSummaryCards";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTENDANCE_STATUS_LABELS,
  businessDate,
  businessMonthStart,
  formatAttendanceDate,
  formatHours,
  formatTime,
  shiftMonth,
  type AttendanceRecordRow,
  type AttendanceStatus,
} from "@/lib/attendance/rules";
import { AttendanceCorrectionDialog } from "@/pages/admin/AttendanceCorrectionDialog";
import { attendanceService } from "@/services/attendance/attendanceService";
import { employeeService } from "@/services/employee/employeeService";

const ALL = "ALL";
const PAGE_SIZE = 25;

type DatePreset = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function presetRange(preset: DatePreset, customFrom: string, customTo: string) {
  const today = businessDate();
  if (preset === "TODAY") return { from: today, to: today };
  if (preset === "MONTH") return { from: businessMonthStart(), to: today };
  if (preset === "WEEK") {
    const date = new Date(`${today}T00:00:00Z`);
    const day = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
    return { from: monday.toISOString().slice(0, 10), to: today };
  }
  return { from: customFrom, to: customTo };
}

export function AdminAttendancePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [department, setDepartment] = useState<string>(ALL);
  const [preset, setPreset] = useState<DatePreset>("TODAY");
  const [customFrom, setCustomFrom] = useState(shiftMonth(businessMonthStart(), 0));
  const [customTo, setCustomTo] = useState(businessDate());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AttendanceRecordRow | null>(null);

  const range = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const summary = useQuery({
    queryKey: ["attendance", "today-summary"],
    queryFn: () => attendanceService.todaySummary(),
  });

  const attendance = useQuery({
    queryKey: ["attendance", "admin", search, status, department, range.from, range.to, page],
    queryFn: () =>
      attendanceService.listAll({
        page,
        pageSize: PAGE_SIZE,
        from: range.from,
        to: range.to,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status !== ALL ? { status: status as AttendanceStatus } : {}),
        ...(department !== ALL ? { department } : {}),
      }),
  });

  const directory = useQuery({
    queryKey: ["employees", "filter-options"],
    queryFn: () => employeeService.listEmployees(),
  });

  const departments = useMemo(() => {
    const values = (directory.data ?? [])
      .map((row) => row.department)
      .filter((value): value is string => !!value);
    return Array.from(new Set(values)).sort();
  }, [directory.data]);

  // Realtime keeps the monitoring view current; a single subscription, cleaned up on unmount.
  useEffect(() => {
    const channel = supabase
      .channel("admin-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const rows = attendance.data?.rows ?? [];
  const total = attendance.data?.total ?? 0;
  const hasFilters =
    search.trim() !== "" || status !== ALL || department !== ALL || preset !== "TODAY";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance monitoring"
        description="Today's attendance across the organisation, with history and corrections."
        actions={
          <AttendanceExportButton
            rows={rows}
            includeEmployee
            filename={`dayflow-attendance-${businessDate()}`}
          />
        }
      />

      {summary.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : summary.data ? (
        <AdminTodayStats summary={summary.data} />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="attendance-search">Search</Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-8 left-3 size-4 text-muted-foreground"
          />
          <Input
            id="attendance-search"
            className="pl-9"
            placeholder="Employee name, Login ID or department"
            value={search}
            onChange={(event) => {
              setPage(0);
              setSearch(event.target.value);
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="attendance-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(0);
              setStatus(value);
            }}
          >
            <SelectTrigger id="attendance-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="attendance-department">Department</Label>
          <Select
            value={department}
            onValueChange={(value) => {
              setPage(0);
              setDepartment(value);
            }}
          >
            <SelectTrigger id="attendance-department" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="attendance-range">Date</Label>
          <Select
            value={preset}
            onValueChange={(value) => {
              setPage(0);
              setPreset(value as DatePreset);
            }}
          >
            <SelectTrigger id="attendance-range" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAY">Today</SelectItem>
              <SelectItem value="WEEK">This week</SelectItem>
              <SelectItem value="MONTH">This month</SelectItem>
              <SelectItem value="CUSTOM">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preset === "CUSTOM" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="attendance-from">From</Label>
              <Input
                id="attendance-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attendance-to">To</Label>
              <Input
                id="attendance-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setStatus(ALL);
              setDepartment(ALL);
              setPreset("TODAY");
              setPage(0);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {attendance.isLoading ? <LoadingState label="Loading attendance…" /> : null}

      {attendance.isError ? (
        <ErrorState
          description="We could not load attendance records."
          onRetry={() => void attendance.refetch()}
        />
      ) : null}

      {attendance.data && rows.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="No attendance records match the selected filters."
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Login ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Work hours</TableHead>
                  <TableHead>Extra hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.employees
                        ? `${row.employees.first_name} ${row.employees.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.employees?.login_id ?? "—"}
                    </TableCell>
                    <TableCell>{row.employees?.department ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAttendanceDate(row.attendance_date)}
                    </TableCell>
                    <TableCell>{formatTime(row.check_in)}</TableCell>
                    <TableCell>{formatTime(row.check_out)}</TableCell>
                    <TableCell>{formatHours(row.work_hours)}</TableCell>
                    <TableCell>{formatHours(row.extra_hours)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "PRESENT"
                            ? "default"
                            : row.status === "ABSENT"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {ATTENDANCE_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      {row.employees ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to="/admin/employees/$employeeId/attendance"
                            params={{ employeeId: row.employees.id }}
                          >
                            View
                          </Link>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                        <Pencil aria-hidden="true" className="size-3.5" /> Correct
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" role="status">
              Showing {rows.length} of {total} record{total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || attendance.isFetching}
                onClick={() => setPage((value) => Math.max(value - 1, 0))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total || attendance.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <AttendanceCorrectionDialog record={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
