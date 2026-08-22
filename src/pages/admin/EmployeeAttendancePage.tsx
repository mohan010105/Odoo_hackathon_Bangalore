import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { AttendanceSummaryCards } from "@/components/attendance/AttendanceSummaryCards";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
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
  formatAttendanceDate,
  monthEnd,
  shiftMonth,
  summarise,
} from "@/lib/attendance/rules";
import { attendanceService } from "@/services/attendance/attendanceService";
import { employeeService } from "@/services/employee/employeeService";

/** Admin view of one employee's attendance, selected by employee id from the route. */
export function AdminEmployeeAttendancePage({ employeeId }: { employeeId: string }) {
  const [monthOffset, setMonthOffset] = useState("0");

  const range = useMemo(() => {
    const offset = Number(monthOffset);
    const start = shiftMonth(businessMonthStart(), offset);
    return { from: start, to: offset === 0 ? businessDate() : monthEnd(start) };
  }, [monthOffset]);

  const employee = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => employeeService.getEmployee(employeeId),
  });

  const attendance = useQuery({
    queryKey: ["attendance", "employee", employeeId, range.from, range.to],
    queryFn: () => attendanceService.listForEmployee(employeeId, range),
  });

  const rows = attendance.data ?? [];
  const summary = useMemo(() => summarise(rows), [rows]);

  const monthOptions = useMemo(
    () =>
      [0, -1, -2, -3, -4, -5].map((offset) => ({
        value: String(offset),
        label: formatAttendanceDate(shiftMonth(businessMonthStart(), offset)).slice(3),
      })),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          employee.data
            ? `${employee.data.firstName} ${employee.data.lastName} — attendance`
            : "Employee attendance"
        }
        description={
          employee.data
            ? `Login ID ${employee.data.employeeId}${employee.data.department ? ` · ${employee.data.department}` : ""}`
            : "Monthly attendance history and totals."
        }
      />

      <div className="w-48 space-y-1">
        <Label htmlFor="attendance-month">Month</Label>
        <Select value={monthOffset} onValueChange={setMonthOffset}>
          <SelectTrigger id="attendance-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AttendanceSummaryCards summary={summary} />

      {attendance.isLoading ? <LoadingState label="Loading attendance…" /> : null}

      {attendance.isError ? (
        <ErrorState
          description="We could not load this employee's attendance."
          onRetry={() => void attendance.refetch()}
        />
      ) : null}

      {attendance.data && rows.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="No attendance records found for this period."
        />
      ) : null}

      {rows.length > 0 ? <AttendanceHistoryTable rows={rows} /> : null}
    </div>
  );
}
