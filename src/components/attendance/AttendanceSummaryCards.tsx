import { Card, CardContent } from "@/components/ui/card";
import { formatHours, type AttendanceSummary } from "@/lib/attendance/rules";

function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" | "muted" }) {
  const toneClasses = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    muted: "text-muted-foreground",
  };

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="space-y-1 p-3.5 sm:p-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className={`font-display text-xl font-bold tracking-tight ${toneClasses[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

/** Employee-facing period summary, calculated from real attendance rows. */
export function AttendanceSummaryCards({ summary }: { summary: AttendanceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Present" value={summary.presentDays} tone="success" />
      <Stat label="Half day / late" value={summary.halfDays} tone="warning" />
      <Stat label="Absent" value={summary.absentDays} tone="danger" />
      <Stat label="Leave" value={summary.leaveDays} tone="muted" />
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Total employees" value={summary.totalEmployees} />
      <Stat label="Present" value={summary.present} tone="success" />
      <Stat label="Absent" value={summary.absent} tone="danger" />
      <Stat label="On leave" value={summary.onLeave} tone="muted" />
      <Stat label="Not checked in" value={summary.notCheckedIn} tone="warning" />
    </div>
  );
}
