/**
 * Single source of truth for attendance business rules: the business timezone,
 * the standard working day, hour maths and display formatting.
 *
 * The same formulas exist in the database (attendance_work_hours /
 * attendance_extra_hours) so server-generated timestamps stay authoritative.
 * Never duplicate these calculations inside components.
 */

/** Business timezone used for every attendance date decision. */
export const BUSINESS_TIMEZONE = "Asia/Kolkata";

/** Standard working day in hours. */
export const STANDARD_WORK_HOURS = 8;

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
};

export type AttendanceRecordRow = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  work_hours: number;
  extra_hours: number;
  status: AttendanceStatus;
  notes: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO (yyyy-mm-dd) attendance date for an instant, in the business timezone. */
export function businessDate(instant: Date = new Date()): string {
  return dateFormatter.format(instant);
}

/** First day of the business month containing `instant`, as yyyy-mm-dd. */
export function businessMonthStart(instant: Date = new Date()): string {
  return `${businessDate(instant).slice(0, 7)}-01`;
}

/** Adds `months` to a yyyy-mm-01 style date string. */
export function shiftMonth(isoDate: string, months: number): string {
  const [year, month] = isoDate.split("-").map(Number) as [number, number];
  const zero = month - 1 + months;
  const nextYear = year + Math.floor(zero / 12);
  const nextMonth = ((zero % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
}

/** Last day of the month for a yyyy-mm-dd date string. */
export function monthEnd(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** work_hours = check_out - check_in, in decimal hours (never negative). */
export function computeWorkHours(checkIn: string | Date, checkOut: string | Date): number {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

/** extra_hours = max(work_hours - 8, 0) */
export function computeExtraHours(workHours: number): number {
  return Math.max(Math.round((workHours - STANDARD_WORK_HOURS) * 100) / 100, 0);
}

/** Decimal hours rendered as "8h 30m". */
export function formatHours(hours: number | null | undefined): string {
  const value = Math.max(Number(hours ?? 0), 0);
  const totalMinutes = Math.round(value * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Elapsed seconds rendered as "04h 32m 18s". */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(Math.floor(totalSeconds), 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** Timestamp rendered in the business timezone, e.g. "09:12 AM". */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return timeFormatter.format(new Date(value));
}

const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Attendance date rendered as "22 Aug 2026". */
export function formatAttendanceDate(isoDate: string): string {
  return longDateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export type AttendanceSummary = {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  workHours: number;
  extraHours: number;
};

/** Aggregates a set of attendance rows — used by both employee and admin views. */
export function summarise(rows: readonly AttendanceRecordRow[]): AttendanceSummary {
  return rows.reduce<AttendanceSummary>(
    (acc, row) => ({
      presentDays: acc.presentDays + (row.status === "PRESENT" ? 1 : 0),
      absentDays: acc.absentDays + (row.status === "ABSENT" ? 1 : 0),
      leaveDays: acc.leaveDays + (row.status === "LEAVE" ? 1 : 0),
      halfDays: acc.halfDays + (row.status === "HALF_DAY" ? 1 : 0),
      workHours: Math.round((acc.workHours + Number(row.work_hours ?? 0)) * 100) / 100,
      extraHours: Math.round((acc.extraHours + Number(row.extra_hours ?? 0)) * 100) / 100,
    }),
    {
      presentDays: 0,
      absentDays: 0,
      leaveDays: 0,
      halfDays: 0,
      workHours: 0,
      extraHours: 0,
    },
  );
}

export type TodayState = "NOT_CHECKED_IN" | "WORKING" | "COMPLETED";

export function todayState(record: AttendanceRecordRow | null): TodayState {
  if (!record?.check_in) return "NOT_CHECKED_IN";
  return record.check_out ? "COMPLETED" : "WORKING";
}
