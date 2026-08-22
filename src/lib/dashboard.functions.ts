import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";

/** Business dates for the last `days` calendar days, oldest first. */
function recentDates(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - index);
    out.push(date.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Admin attendance overview for the dashboard chart. One ranged query over the
 * attendance table — no per-day round trips — aggregated on the server so the
 * browser only receives counts, never employee rows.
 */
export const getAttendanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const dates = recentDates(14);
    const start = dates[0]!;
    const end = dates[dates.length - 1]!;

    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("attendance_date, status, work_hours, extra_hours")
      .gte("attendance_date", start)
      .lte("attendance_date", end)
      .limit(5000);

    if (error) throw new Error("We could not load the attendance overview.");

    const byDate = new Map<
      string,
      { present: number; absent: number; halfDay: number; leave: number; hours: number }
    >();
    for (const date of dates) {
      byDate.set(date, { present: 0, absent: 0, halfDay: 0, leave: 0, hours: 0 });
    }

    for (const row of rows ?? []) {
      const bucket = byDate.get(row.attendance_date);
      if (!bucket) continue;
      if (row.status === "PRESENT") bucket.present += 1;
      else if (row.status === "ABSENT") bucket.absent += 1;
      else if (row.status === "HALF_DAY") bucket.halfDay += 1;
      else if (row.status === "LEAVE") bucket.leave += 1;
      bucket.hours += Number(row.work_hours ?? 0);
    }

    const series = dates.map((date) => {
      const bucket = byDate.get(date)!;
      return {
        date,
        label: new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        }),
        present: bucket.present,
        absent: bucket.absent,
        halfDay: bucket.halfDay,
        leave: bucket.leave,
        hours: Math.round(bucket.hours * 100) / 100,
      };
    });

    const totalHours = series.reduce((sum, point) => sum + point.hours, 0);
    return {
      series,
      totals: {
        present: series.reduce((sum, point) => sum + point.present, 0),
        absent: series.reduce((sum, point) => sum + point.absent, 0),
        halfDay: series.reduce((sum, point) => sum + point.halfDay, 0),
        leave: series.reduce((sum, point) => sum + point.leave, 0),
        hours: Math.round(totalHours * 100) / 100,
      },
    };
  });

/**
 * Admin time-off overview: request status mix plus the leave types most used in
 * the current year. Counts only — no employee identities.
 */
export const getTimeOffOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const year = new Date().getUTCFullYear();

    const { data: rows, error } = await context.supabase
      .from("leave_requests")
      .select("status, total_days, leave_type_id, leave_types(name), start_date")
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .limit(5000);

    if (error) throw new Error("We could not load the time-off overview.");

    const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    const byType = new Map<string, { name: string; days: number; requests: number }>();

    for (const row of rows ?? []) {
      const status = row.status as keyof typeof statusCounts;
      if (status in statusCounts) statusCounts[status] += 1;

      const name = row.leave_types?.name ?? "Other";
      const bucket = byType.get(name) ?? { name, days: 0, requests: 0 };
      bucket.requests += 1;
      if (row.status === "APPROVED") bucket.days += Number(row.total_days ?? 0);
      byType.set(name, bucket);
    }

    return {
      year,
      statuses: [
        { key: "PENDING", label: "Pending", value: statusCounts.PENDING },
        { key: "APPROVED", label: "Approved", value: statusCounts.APPROVED },
        { key: "REJECTED", label: "Rejected", value: statusCounts.REJECTED },
        { key: "CANCELLED", label: "Cancelled", value: statusCounts.CANCELLED },
      ],
      byType: [...byType.values()].sort((a, b) => b.requests - a.requests).slice(0, 6),
      totalRequests: (rows ?? []).length,
    };
  });

/**
 * Admin payroll headline for the dashboard: the most recent period that has
 * generated records, with its totals and status mix.
 */
export const getLatestPayrollOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const { data: latest, error: latestError } = await context.supabase
      .from("payroll_records")
      .select("period_year, period_month")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw new Error("We could not load the payroll overview.");
    if (!latest) return null;

    const { data: rows, error } = await context.supabase
      .from("payroll_records")
      .select("gross_earnings, total_deductions, net_salary, status, currency")
      .eq("period_year", latest.period_year)
      .eq("period_month", latest.period_month)
      .limit(2000);

    if (error) throw new Error("We could not load the payroll overview.");

    const list = rows ?? [];
    const nets = list.map((row) => Number(row.net_salary ?? 0));

    return {
      year: latest.period_year,
      month: latest.period_month,
      currency: list[0]?.currency ?? "INR",
      employees: list.length,
      totalGross: list.reduce((sum, row) => sum + Number(row.gross_earnings ?? 0), 0),
      totalDeductions: list.reduce((sum, row) => sum + Number(row.total_deductions ?? 0), 0),
      totalNet: nets.reduce((sum, value) => sum + value, 0),
      highestNet: nets.length ? Math.max(...nets) : 0,
      averageNet: nets.length ? nets.reduce((sum, value) => sum + value, 0) / nets.length : 0,
      generated: list.filter((row) => row.status === "GENERATED").length,
      processed: list.filter((row) => row.status === "PROCESSED").length,
      paid: list.filter((row) => row.status === "PAID").length,
    };
  });

/**
 * The signed-in employee's latest payslip headline. Scoped by the employee's
 * own record; row-level security blocks anything else.
 */
export const getMyLatestPayslip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: employee } = await context.supabase
      .from("employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!employee) return null;

    const { data: row, error } = await context.supabase
      .from("payroll_records")
      .select("id, period_year, period_month, gross_earnings, total_deductions, net_salary, status, currency")
      .eq("employee_id", employee.id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("We could not load your latest payslip.");
    return row;
  });
