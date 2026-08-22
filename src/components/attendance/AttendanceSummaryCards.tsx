import { Card, CardContent } from "@/components/ui/card";
import { formatHours, type AttendanceSummary } from "@/lib/attendance/rules";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/** Employee-facing period summary, calculated from real attendance rows. */
export function AttendanceSummaryCards({ summary }: { summary: AttendanceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Stat label="Present" value={summary.presentDays} />
      {/* HALF_DAY is the only shortfall state the database records; there is no LATE status. */}
      <Stat label="Half day / late" value={summary.halfDays} />
      <Stat label="Absent" value={summary.absentDays} />
      <Stat label="Leave" value={summary.leaveDays} />
      <Stat label="Work hours" value={formatHours(summary.workHours)} />
      <Stat label="Extra hours" value={formatHours(summary.extraHours)} />
    </div>
  );
}

export function AdminTodayStats({
  summary,
}: {
  summary: {
    totalEmployees: number;
    present: number;
    absent: number;
    onLeave: number;
    notCheckedIn: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat label="Total employees" value={summary.totalEmployees} />
      <Stat label="Present" value={summary.present} />
      <Stat label="Absent" value={summary.absent} />
      <Stat label="On leave" value={summary.onLeave} />
      <Stat label="Not checked in" value={summary.notCheckedIn} />
    </div>
  );
}
