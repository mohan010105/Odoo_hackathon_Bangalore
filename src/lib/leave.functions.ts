import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";
import {
  leaveAllocationSchema,
  leaveDecisionSchema,
  leaveRequestSchema,
  leaveTypeSchema,
} from "@/lib/validation/leave";

const REQUEST_COLUMNS =
  "id, employee_id, leave_type_id, start_date, end_date, total_days, remarks, attachment_url, status, reviewed_at, review_comment, created_at";

const TYPE_JOIN = "leave_types!inner(id, code, name, description, is_paid, requires_attachment)";
const EMPLOYEE_JOIN = "employees!inner(id, login_id, first_name, last_name, department, email)";

/** Maps database exceptions to messages employees and HR can act on. */
function friendlyError(message: string): Error {
  if (message.includes("NO_EMPLOYEE_RECORD"))
    return new Error("We could not find an employee record for your account. Contact HR.");
  if (message.includes("INVALID_RANGE"))
    return new Error("The end date must be on or after the start date.");
  if (message.includes("RANGE_TOO_LONG"))
    return new Error("A single request cannot cover more than 90 days.");
  if (message.includes("UNKNOWN_LEAVE_TYPE")) return new Error("That leave type is not available.");
  if (message.includes("ATTACHMENT_REQUIRED"))
    return new Error("Supporting documentation is required for this leave type.");
  if (message.includes("OVERLAPPING_REQUEST"))
    return new Error("This leave period overlaps with an existing request.");
  if (message.includes("INSUFFICIENT_BALANCE")) return new Error("Insufficient leave balance.");
  if (message.includes("NO_ALLOCATION"))
    return new Error("No leave has been allocated for that leave type and period. Contact HR.");
  if (message.includes("ALREADY_PROCESSED"))
    return new Error("This request has already been processed.");
  if (message.includes("REASON_REQUIRED"))
    return new Error("Please provide a reason for rejection.");
  if (message.includes("NOT_PENDING"))
    return new Error("That request has already been decided or cancelled.");
  if (message.includes("DUPLICATE_ALLOCATION"))
    return new Error("An allocation already exists for that employee, leave type and period.");
  if (message.includes("BELOW_USED"))
    return new Error("Allocated days cannot be fewer than the days already used.");
  if (message.includes("DUPLICATE_CODE")) return new Error("That leave type code is already used.");
  if (message.includes("INVALID_PERIOD")) return new Error("Valid to must be on or after valid from.");
  if (message.includes("INVALID_DAYS")) return new Error("Allocated days cannot be negative.");
  if (message.includes("NOT_FOUND")) return new Error("We could not find that record.");
  if (message.includes("FORBIDDEN")) return new Error("You are not authorised to do that.");
  return new Error("We could not complete the leave operation. Please try again.");
}




/** Active leave policies. Readable by every signed-in user. */
export const listLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("leave_types")
      .select("id, code, name, description, is_paid, requires_attachment, is_active")
      .order("name");

    if (!data.includeInactive) query = query.eq("is_active", true);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the leave policies.");
    return rows ?? [];
  });

/** The signed-in employee's allocations, with pending days, for today. */
export const getMyLeaveBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: employee, error: employeeError } = await context.supabase
      .from("employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (employeeError) throw new Error("We could not load your employee record.");
    if (!employee) return [];

    const { data, error } = await context.supabase.rpc("leave_balance", {
      _employee_id: employee.id,
    });

    if (error) throw friendlyError(error.message);
    return data ?? [];
  });

/** The signed-in employee's own requests (RLS scopes the rows). */
export const listMyLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select(`${REQUEST_COLUMNS}, ${TYPE_JOIN}`)
      .order("start_date", { ascending: false })
      .limit(200);

    if (error) throw new Error("We could not load your leave requests.");
    return data ?? [];
  });

/**
 * Submit a request. Dates, total days, overlaps, balance and the attachment
 * requirement are all validated inside the database function, so a direct API
 * call cannot bypass them. The employee id is resolved from auth.uid().
 */
export const submitLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leaveRequestSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.rpc("leave_submit", {
      _leave_type_id: data.leaveTypeId,
      _start: data.startDate,
      _end: data.endDate,
      _remarks: data.remarks ?? "",
      _attachment_url: data.attachmentPath ?? "",
    });

    if (error) throw friendlyError(error.message);
    return row;
  });

/** Cancel one of your own pending requests. Approved history is never removed. */
export const cancelLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.rpc("leave_cancel", { _id: data.id });
    if (error) throw friendlyError(error.message);
    return row;
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const adminFilterSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  leaveTypeId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  department: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(5).max(100).default(25),
});

export type AdminLeaveFilters = z.input<typeof adminFilterSchema>;

/** Admin-only approval queue: database-side filtering, searching and paging. */
export const listLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminFilterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const from = data.page * data.pageSize;
    let query = context.supabase
      .from("leave_requests")
      .select(`${REQUEST_COLUMNS}, ${TYPE_JOIN}, ${EMPLOYEE_JOIN}`, { count: "exact" })
      .order("start_date", { ascending: false })
      .range(from, from + data.pageSize - 1);

    if (data.status) query = query.eq("status", data.status);
    if (data.leaveTypeId) query = query.eq("leave_type_id", data.leaveTypeId);
    if (data.employeeId) query = query.eq("employee_id", data.employeeId);
    if (data.from) query = query.gte("end_date", data.from);
    if (data.to) query = query.lte("start_date", data.to);
    if (data.department) query = query.ilike("employees.department", data.department);

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
    if (error) throw new Error("We could not load the leave requests.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Admin-only leave statistics for the dashboard header. Real data only. */
export const getLeaveStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const today = new Date().toISOString().slice(0, 10);

    const counters = await Promise.all(
      (["PENDING", "APPROVED", "REJECTED"] as const).map((status) =>
        context.supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", status),
      ),
    );

    const onLeave = await context.supabase
      .from("leave_requests")
      .select("employee_id", { count: "exact", head: true })
      .eq("status", "APPROVED")
      .lte("start_date", today)
      .gte("end_date", today);

    if (counters.some((row) => row.error) || onLeave.error)
      throw new Error("We could not load the leave statistics.");

    return {
      pending: counters[0]?.count ?? 0,
      approved: counters[1]?.count ?? 0,
      rejected: counters[2]?.count ?? 0,
      onLeaveToday: onLeave.count ?? 0,
    };
  });

/** Admin-only count of requests still waiting for a decision. */
export const getPendingLeaveCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { count, error } = await context.supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING");

    if (error) throw new Error("We could not load the pending request count.");
    return count ?? 0;
  });

/**
 * Admin-only decision. One atomic database call moves the request out of
 * PENDING, updates used days, reflects approved leave in attendance and
 * notifies the employee, so balances cannot drift on a partial failure.
 */
export const reviewLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leaveDecisionSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("leave_review", {
      _id: data.id,
      _decision: data.decision,
      _comment: data.comment ?? "",
    });

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "leave.reviewed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "leave_request",
      entityId: data.id,
      summary: `Leave request ${data.decision.toLowerCase()}`,
    });

    return row;
  });

/** Admin-only allocation directory with filters. */
export const listLeaveAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid().optional(),
        leaveTypeId: z.string().uuid().optional(),
        search: z.string().trim().max(120).optional(),
        page: z.number().int().min(0).max(500).default(0),
        pageSize: z.number().int().min(5).max(100).default(25),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const from = data.page * data.pageSize;
    let query = context.supabase
      .from("leave_allocations")
      .select(
        `id, employee_id, leave_type_id, allocated_days, used_days, remaining_days, valid_from, valid_to, ${TYPE_JOIN}, ${EMPLOYEE_JOIN}`,
        { count: "exact" },
      )
      .order("valid_from", { ascending: false })
      .range(from, from + data.pageSize - 1);

    if (data.employeeId) query = query.eq("employee_id", data.employeeId);
    if (data.leaveTypeId) query = query.eq("leave_type_id", data.leaveTypeId);

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
    if (error) throw new Error("We could not load the leave allocations.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Admin-only allocate/update. Remaining days stay database-generated. */
export const saveLeaveAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leaveAllocationSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("leave_allocation_upsert", {
      _employee_id: data.employeeId,
      _leave_type_id: data.leaveTypeId,
      _allocated_days: data.allocatedDays,
      _valid_from: data.validFrom,
      _valid_to: data.validTo,
      _allocation_id: data.allocationId ?? null,
    } as never);

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "leave.allocation_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "leave_allocation",
      entityId: data.allocationId ?? null,
      summary: `Allocated ${data.allocatedDays} days (${data.validFrom} → ${data.validTo})`,
    });

    return row;
  });

/** Admin-only leave-type create/update. Types are deactivated, never deleted. */
export const saveLeaveType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leaveTypeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("leave_type_upsert", {
      _code: data.code,
      _name: data.name,
      _description: data.description ?? "",
      _requires_attachment: data.requiresAttachment,
      _is_paid: data.isPaid,
      _is_active: data.isActive,
      _id: data.id ?? null,
    } as never);

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "leave.type_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "leave_type",
      entityId: data.id ?? null,
      summary: `${data.id ? "Updated" : "Created"} leave type ${data.code}`,
    });

    return row;
  });

/** Admin-only leave history for one employee: balances plus every request. */
export const getEmployeeLeaveHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employeeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const [employee, balance, requests] = await Promise.all([
      context.supabase
        .from("employees")
        .select("id, login_id, first_name, last_name, department, job_position, email")
        .eq("id", data.employeeId)
        .maybeSingle(),
      context.supabase.rpc("leave_balance", { _employee_id: data.employeeId }),
      context.supabase
        .from("leave_requests")
        .select(`${REQUEST_COLUMNS}, ${TYPE_JOIN}`)
        .eq("employee_id", data.employeeId)
        .order("start_date", { ascending: false })
        .limit(200),
    ]);

    if (employee.error || requests.error)
      throw new Error("We could not load this employee's leave history.");
    if (balance.error) throw friendlyError(balance.error.message);

    return {
      employee: employee.data,
      balances: balance.data ?? [],
      requests: requests.data ?? [],
    };
  });
