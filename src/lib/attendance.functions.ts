import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";
import { businessDate } from "@/lib/attendance/rules";

const ATTENDANCE_COLUMNS =
  "id, employee_id, attendance_date, check_in, check_out, work_hours, extra_hours, status, notes";

const EMPLOYEE_JOIN = "employees!inner(id, login_id, first_name, last_name, department)";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a yyyy-mm-dd date");

const rangeSchema = z.object({
  from: isoDate,
  to: isoDate,
});

const statusSchema = z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]);

/** Maps database exceptions to messages users can act on. */
function friendlyError(message: string): Error {
  if (message.includes("ALREADY_CHECKED_IN"))
    return new Error("Today's attendance has already been recorded.");
  if (message.includes("ALREADY_CHECKED_OUT"))
    return new Error("You have already checked out for today.");
  if (message.includes("NOT_CHECKED_IN"))
    return new Error("You need to check in before you can check out.");
  if (message.includes("NO_EMPLOYEE_RECORD"))
    return new Error("We could not find an employee record for your account. Contact HR.");
  if (message.includes("INVALID_RANGE"))
    return new Error("Check-out time must be after the check-in time.");
  if (message.includes("FORBIDDEN")) return new Error("You are not authorised to do that.");
  if (message.includes("NOT_FOUND")) return new Error("That attendance record no longer exists.");
  return new Error("We could not complete the attendance operation. Please try again.");
}

/** Today's attendance for the signed-in employee (RLS scopes it to their row). */
export const getMyTodayAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance")
      .select(ATTENDANCE_COLUMNS)
      .eq("attendance_date", businessDate())
      .maybeSingle();

    if (error) throw new Error("We could not load today's attendance.");
    return data;
  });

/** The signed-in employee's own attendance history for a date range. */
export const listMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select(ATTENDANCE_COLUMNS)
      .gte("attendance_date", data.from)
      .lte("attendance_date", data.to)
      .order("attendance_date", { ascending: false })
      .limit(200);

    if (error) throw new Error("We could not load your attendance history.");
    return rows ?? [];
  });

const pagedRangeSchema = rangeSchema.extend({
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(5).max(100).default(10),
});

/**
 * Paginated own-attendance history. Filtering, ordering and paging all happen
 * in the database so the browser never downloads the full history.
 */
export const listMyAttendancePage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pagedRangeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const offset = data.page * data.pageSize;
    const {
      data: rows,
      error,
      count,
    } = await context.supabase
      .from("attendance")
      .select(ATTENDANCE_COLUMNS, { count: "exact" })
      .gte("attendance_date", data.from)
      .lte("attendance_date", data.to)
      .order("attendance_date", { ascending: false })
      .range(offset, offset + data.pageSize - 1);

    if (error) throw new Error("We could not load your attendance history.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Check in. The database resolves the employee and stamps the time. */
export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("attendance_check_in");
    if (error) throw friendlyError(error.message);
    return data;
  });

/** Check out. Work and extra hours are recalculated server-side. */
export const checkOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("attendance_check_out");
    if (error) throw friendlyError(error.message);
    return data;
  });

const adminFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  department: z.string().trim().max(80).optional(),
  status: statusSchema.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(5).max(100).default(25),
});

export type AdminAttendanceFilters = z.input<typeof adminFilterSchema>;

/** Admin-only attendance list. Filtering and paging happen in the database. */
export const listAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminFilterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const from = data.page * data.pageSize;
    let query = context.supabase
      .from("attendance")
      .select(`${ATTENDANCE_COLUMNS}, ${EMPLOYEE_JOIN}`, { count: "exact" })
      .order("attendance_date", { ascending: false })
      .order("check_in", { ascending: false, nullsFirst: false })
      .range(from, from + data.pageSize - 1);

    if (data.from) query = query.gte("attendance_date", data.from);
    if (data.to) query = query.lte("attendance_date", data.to);
    if (data.status) query = query.eq("status", data.status);
    if (data.department)
      query = query.ilike("employees.department", data.department);

    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        [
          `first_name.ilike.${term}`,
          `last_name.ilike.${term}`,
          `login_id.ilike.${term}`,
          `department.ilike.${term}`,
        ].join(","),
        { referencedTable: "employees" },
      );
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error("We could not load attendance records.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Admin-only summary of today's attendance across the organisation. */
export const getTodayAttendanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const today = businessDate();

    const [employees, records] = await Promise.all([
      context.supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .neq("status", "INACTIVE"),
      context.supabase.from("attendance").select("status, check_in").eq("attendance_date", today),
    ]);

    if (employees.error || records.error)
      throw new Error("We could not load today's attendance summary.");

    const rows = records.data ?? [];
    const totalEmployees = employees.count ?? 0;
    const present = rows.filter((row) => row.status === "PRESENT" && row.check_in).length;
    const halfDay = rows.filter((row) => row.status === "HALF_DAY").length;
    const absent = rows.filter((row) => row.status === "ABSENT").length;
    const onLeave = rows.filter((row) => row.status === "LEAVE").length;
    const notCheckedIn = Math.max(totalEmployees - present - halfDay - absent - onLeave, 0);

    return { date: today, totalEmployees, present, halfDay, absent, onLeave, notCheckedIn };
  });

/** Admin-only attendance history for one employee, identified by id. */
export const getEmployeeAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    rangeSchema.extend({ employeeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select(ATTENDANCE_COLUMNS)
      .eq("employee_id", data.employeeId)
      .gte("attendance_date", data.from)
      .lte("attendance_date", data.to)
      .order("attendance_date", { ascending: false })
      .limit(200);

    if (error) throw new Error("We could not load this employee's attendance.");
    return rows ?? [];
  });

const correctionSchema = z.object({
  id: z.string().uuid(),
  checkIn: z.string().datetime().nullable(),
  checkOut: z.string().datetime().nullable(),
  status: statusSchema,
  notes: z.string().trim().max(500).optional(),
});

export type AttendanceCorrectionInput = z.input<typeof correctionSchema>;

/**
 * Admin-only attendance correction. The database validates the range and
 * recalculates work/extra hours, so corrected rows stay consistent.
 */
export const correctAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => correctionSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    if (data.checkIn && data.checkOut && new Date(data.checkOut) < new Date(data.checkIn)) {
      throw new Error("Check-out time must be after the check-in time.");
    }

    // The generated RPC types mark these as required strings; the SQL function
    // accepts NULL to clear a timestamp or keep the existing note.
    const { data: row, error } = await context.supabase.rpc("attendance_admin_update", {
      _id: data.id,
      _check_in: data.checkIn,
      _check_out: data.checkOut,
      _status: data.status,
      _notes: data.notes ?? null,
    } as unknown as {
      _id: string;
      _check_in: string;
      _check_out: string;
      _status: typeof data.status;
      _notes: string;
    });


    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "attendance.corrected",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "attendance",
      entityId: data.id,
      summary: `Corrected attendance record (status ${data.status})`,
    });

    return row;
  });
